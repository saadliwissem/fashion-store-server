const Claim = require("../models/Claim");
const Fragment = require("../models/Fragment");
const KeeperProfile = require("../models/KeeperProfile");
const asyncHandler = require("../middleware/async");
const ErrorResponse = require("../utils/ErrorResponse");

// Helper function to generate transaction ID
const generateTransactionId = () => {
  return `TXN-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 9)
    .toUpperCase()}`;
};

// Helper function to update chronicle statistics
const updateChronicleStats = async (chronicleId) => {
  const Chronicle = require("../models/Chronicle");
  const Fragment = require("../models/Fragment");

  const stats = await Fragment.aggregate([
    { $match: { chronicle: chronicleId } },
    {
      $group: {
        _id: null,
        totalFragments: { $sum: 1 },
        claimedFragments: {
          $sum: { $cond: [{ $eq: ["$status", "reserved"] }, 1, 0] },
        },
        uniqueKeepers: { $addToSet: "$claimedBy" },
      },
    },
  ]);

  if (stats.length > 0) {
    await Chronicle.findByIdAndUpdate(chronicleId, {
      "stats.fragmentCount": stats[0].totalFragments,
      "stats.fragmentsClaimed": stats[0].claimedFragments,
      "stats.uniqueKeepers": stats[0].uniqueKeepers.filter((k) => k).length,
    });
  }
};

// Helper function to notify all owners when production is ready
const notifyProductionStart = async (fragment, chronicle) => {
  const Notification = require("../models/Notification");

  for (const sale of fragment.soldAt || []) {
    if (sale.userId) {
      await Notification.create({
        userId: sale.userId,
        type: "PRODUCTION_STARTED",
        title: "Production Started!",
        message: `All fragments for "${chronicle.name}" have been sold! Production is now starting.`,
        data: {
          fragmentId: fragment._id,
          chronicleId: chronicle._id,
          estimatedCompletion: "6-8 weeks",
        },
      });
    }
  }
};

// Helper function to send confirmation email
const sendClaimConfirmationEmail = async ({
  claim,
  fragment,
  user,
  totalAmount,
  paymentMethod,
}) => {
  console.log(`Sending confirmation email to ${user.email}`);
  console.log(`Claim ID: ${claim.claimId}`);
  console.log(`Fragment: ${fragment.name}`);
  console.log(`Total: ${totalAmount} TND`);
  console.log(`Payment Method: ${paymentMethod}`);
  // Implement actual email sending here
};

// Helper function to get next steps based on claim status
const getNextSteps = (isComplete, fragment, paymentMethod, totalAmount) => {
  const steps = [];

  if (paymentMethod === "cash_on_delivery") {
    steps.push(
      `Prepare exact cash amount for delivery (${totalAmount || 0} TND)`
    );
    steps.push("Ensure someone is available to receive the package");
  }

  steps.push("Check your email for confirmation and tracking updates");
  steps.push("Join the puzzle collaboration room to connect with other owners");

  if (isComplete) {
    steps.push("Production will begin immediately on all fragments");
    steps.push("You'll receive updates every 2 weeks on production progress");
    steps.push("Estimated delivery: 6-8 weeks from production start");
  } else {
    const remaining =
      (fragment.requiredFragmentsToStart || fragment.totalSupply || 1) -
      (fragment.currentSoldCount || 0);
    steps.push(
      `Waiting for ${remaining} more fragment purchase${
        remaining !== 1 ? "s" : ""
      } to start production`
    );
    steps.push(
      "Share the puzzle with friends to help complete the collection faster"
    );
    steps.push("You'll be notified as soon as all fragments are sold");
  }

  return steps;
};

// @desc    Create new claim
// @route   POST /api/claims
// @access  Private
exports.createClaim = asyncHandler(async (req, res, next) => {
  const {
    fragmentId,
    userData,
    paymentMethod,
    customization,
    size,
    specialRequests,
  } = req.body;

  // Validate required fields
  if (!fragmentId) {
    return next(new ErrorResponse("Fragment ID is required", 400));
  }

  if (!paymentMethod) {
    return next(new ErrorResponse("Payment method is required", 400));
  }

  const fragment = await Fragment.findById(fragmentId).populate("chronicle");

  if (!fragment) {
    return next(new ErrorResponse("Fragment not found", 404));
  }

  // Check if fragment is available
  if (fragment.status !== "available") {
    return next(
      new ErrorResponse(
        `Fragment is not available for claim. Current status: ${fragment.status}`,
        400
      )
    );
  }

  // Check if user already has a claim for this fragment
  const existingClaim = await Claim.findOne({
    fragment: fragmentId,
    user: req.user.id,
    status: { $in: ["pending", "confirmed", "processing"] },
  });

  if (existingClaim) {
    return next(
      new ErrorResponse(
        "You already have an active claim for this fragment. Check your dashboard.",
        400
      )
    );
  }

  // Calculate amount based on Tunisian pricing
  const basePrice = fragment.price || 0;
  const taxRate = 0.19; // 19% TVA Tunisia
  const taxAmount = basePrice * taxRate;
  const shippingCost = 15; // Fixed shipping cost in TND
  const totalAmount = basePrice + taxAmount + shippingCost;

  // Generate transaction ID
  const transactionId = generateTransactionId();
  const generateClaimId = () => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9).toUpperCase();
    return `CLM-${timestamp}-${random}`;
  };
  // Create the claim with full details
  const claim = await Claim.create({
    claimId: generateClaimId(),
    fragment: fragmentId,
    user: req.user.id,
    userData: {
      fullName:
        userData?.fullName || `${req.user.firstName} ${req.user.lastName}`,
      email: userData?.email || req.user.email,
      phone: userData?.phone || req.user.phone,
      shippingAddress: {
        address: userData?.address || "",
        city: userData?.city || "",
        state: userData?.state || "",
        postalCode: userData?.postalCode || "",
        country: userData?.country || "TN",
      },
      size: size || userData?.size || "M",
      customization: customization || userData?.customization || "",
      acceptTerms: userData?.acceptTerms || false,
      acceptUpdates: userData?.acceptUpdates || true,
    },
    payment: {
      method: paymentMethod,
      transactionId: transactionId,
      amount: totalAmount,
      currency: "TND",
      status: paymentMethod === "cash_on_delivery" ? "pending_cod" : "pending",
    },
  });

  // Update fragment status to reserved
  fragment.status = "reserved";
  fragment.claimedBy = req.user.id;
  fragment.claimedAt = new Date();
  fragment.reservedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000); // Reserve for 24 hours

  // Add to soldAt array for production tracking
  if (!fragment.soldAt) {
    fragment.soldAt = [];
  }
  fragment.soldAt.push({
    userId: req.user.id,
    size: size || userData?.size || "M",
    gender: userData?.gender || "Unisex",
    shippingAddress: userData?.address || "",
    purchasedAt: new Date(),
    transactionId: transactionId,
    claimId: claim._id,
  });

  fragment.currentSoldCount = (fragment.currentSoldCount || 0) + 1;

  // Check if this completes the required fragments to start production
  const requiredTotal =
    fragment.requiredFragmentsToStart || fragment.totalSupply || 1;
  const isComplete = fragment.currentSoldCount >= requiredTotal;

  if (isComplete) {
    fragment.productionStatus = "fully_sold";
    fragment.productionReady = true;

    // Trigger production start notification to all owners
    // await notifyProductionStart(fragment, fragment.chronicle);
  } else {
    fragment.productionStatus = "partial_sold";
  }

  await fragment.save();

  // Update chronicle stats
  await updateChronicleStats(fragment.chronicle._id);

  // Send confirmation email
  await sendClaimConfirmationEmail({
    claim,
    fragment,
    user: req.user,
    totalAmount,
    paymentMethod,
  });

  res.status(201).json({
    success: true,
    message: isComplete
      ? "Congratulations! You bought the last fragment! Production will begin soon."
      : "Fragment claimed successfully! You will be notified when production starts.",
    data: {
      claim: {
        id: claim._id,
        claimCode: claim.claimId,
        claimId: claim.claimId,
        status: claim.status,
        amount: totalAmount,
        currency: "TND",
      },
      fragment: {
        id: fragment._id,
        name: fragment.name,
        number: fragment.number,
        status: fragment.status,
        productionStatus: fragment.productionStatus,
        currentSoldCount: fragment.currentSoldCount,
        requiredToStart: fragment.requiredFragmentsToStart,
        remainingToStart: Math.max(
          0,
          (fragment.requiredFragmentsToStart || fragment.totalSupply || 1) -
            fragment.currentSoldCount
        ),
        isProductionReady: isComplete,
      },
      chronicle: {
        id: fragment.chronicle._id,
        name: fragment.chronicle.name,
      },
      nextSteps: getNextSteps(isComplete, fragment, paymentMethod, totalAmount),
    },
  });
});

// @desc    Get user's claims
// @route   GET /api/claims/user
// @access  Private
exports.getUserClaims = asyncHandler(async (req, res, next) => {
  const { status, limit = 10, page = 1 } = req.query;

  const query = { user: req.user.id };
  if (status) query.status = status;

  const claims = await Claim.find(query)
    .populate({
      path: "fragment",
      populate: {
        path: "chronicle",
        select: "name enigma coverImage",
      },
    })
    .sort("-createdAt")
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

  const total = await Claim.countDocuments(query);

  res.status(200).json({
    success: true,
    count: claims.length,
    total,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    },
    data: claims,
  });
});

// @desc    Get single claim
// @route   GET /api/claims/:id
// @access  Private
exports.getClaim = asyncHandler(async (req, res, next) => {
  const claim = await Claim.findById(req.params.id)
    .populate({
      path: "fragment",
      populate: {
        path: "chronicle",
        populate: {
          path: "enigma",
        },
      },
    })
    .populate("user", "firstName lastName email");

  if (!claim) {
    return next(
      new ErrorResponse(`Claim not found with id ${req.params.id}`, 404)
    );
  }

  // Check if user owns this claim or is admin
  if (claim.user._id.toString() !== req.user.id && req.user.role !== "admin") {
    return next(new ErrorResponse("Not authorized to access this claim", 403));
  }

  res.status(200).json({
    success: true,
    data: claim,
  });
});

// @desc    Get claim status
// @route   GET /api/claims/status/:claimId
// @access  Private
exports.getClaimStatus = asyncHandler(async (req, res, next) => {
  const { claimId } = req.params;

  const claim = await Claim.findOne({ claimId: claimId })
    .populate(
      "fragment",
      "name number status productionStatus currentSoldCount"
    )
    .populate("chronicle", "name");

  if (!claim) {
    return next(new ErrorResponse("Claim not found", 404));
  }

  // Check if user owns this claim
  if (claim.user.toString() !== req.user.id && req.user.role !== "admin") {
    return next(new ErrorResponse("Unauthorized to view this claim", 403));
  }

  res.json({
    success: true,
    data: {
      claim: {
        id: claim._id,
        code: claim.claimId,
        status: claim.status,
        createdAt: claim.createdAt,
      },
      fragment: {
        id: claim.fragment._id,
        name: claim.fragment.name,
        number: claim.fragment.number,
        status: claim.fragment.status,
        productionStatus: claim.fragment.productionStatus,
        currentSoldCount: claim.fragment.currentSoldCount,
      },
      chronicle: claim.chronicle?.name,
      payment: claim.payment,
    },
  });
});

// @desc    Update claim status (admin)
// @route   PATCH /api/claims/:id/status
// @access  Private/Admin
exports.updateClaimStatus = asyncHandler(async (req, res, next) => {
  const { status, trackingInfo, notes } = req.body;

  const claim = await Claim.findById(req.params.id);

  if (!claim) {
    return next(
      new ErrorResponse(`Claim not found with id ${req.params.id}`, 404)
    );
  }

  claim.status = status;
  if (trackingInfo) {
    claim.trackingInfo = {
      ...claim.trackingInfo,
      ...trackingInfo,
      ...(status === "shipped" && { shippedAt: new Date() }),
      ...(status === "delivered" && { deliveredAt: new Date() }),
    };
  }
  if (notes) {
    claim.adminNotes.push({
      text: notes,
      addedBy: req.user.id,
    });
  }

  await claim.save();

  // Update keeper stats if claim is delivered
  if (status === "delivered") {
    const KeeperProfile = require("../models/KeeperProfile");
    const keeperProfile = await KeeperProfile.findOne({ user: claim.user });
    if (keeperProfile) {
      keeperProfile.stats.claimsCount += 1;
      keeperProfile.stats.totalSpent += claim.payment.amount;
      await keeperProfile.save();
    }
  }

  res.status(200).json({
    success: true,
    data: claim,
  });
});
