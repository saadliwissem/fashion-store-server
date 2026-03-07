const Claim = require("../models/Claim");
const Fragment = require("../models/Fragment");
const KeeperProfile = require("../models/KeeperProfile");
const asyncHandler = require("../middleware/async");
const ErrorResponse = require("../utils/errorResponse");

// @desc    Create new claim
// @route   POST /api/claims
// @access  Private
exports.createClaim = asyncHandler(async (req, res, next) => {
  const { fragmentId, userData, paymentMethod } = req.body;

  const fragment = await Fragment.findById(fragmentId);
  if (!fragment) {
    return next(new ErrorResponse("Fragment not found", 404));
  }

  if (fragment.status !== "available") {
    return next(new ErrorResponse("Fragment is not available for claim", 400));
  }

  // Check if user already has a pending claim
  const existingClaim = await Claim.findOne({
    fragment: fragmentId,
    user: req.user.id,
    status: { $in: ["pending", "confirmed"] },
  });

  if (existingClaim) {
    return next(
      new ErrorResponse(
        "You already have a pending claim for this fragment",
        400
      )
    );
  }

  const claim = await Claim.create({
    fragment: fragmentId,
    user: req.user.id,
    userData: {
      fullName:
        userData.fullName || `${req.user.firstName} ${req.user.lastName}`,
      email: userData.email || req.user.email,
      phone: userData.phone || req.user.phone,
      shippingAddress: userData.shippingAddress,
      size: userData.size,
      customization: userData.customization,
      acceptTerms: userData.acceptTerms,
      acceptUpdates: userData.acceptUpdates,
    },
    payment: {
      method: paymentMethod,
      amount: fragment.price,
      status: "pending",
    },
  });

  // Reserve the fragment
  fragment.status = "reserved";
  fragment.claimedBy = req.user.id;
  await fragment.save();

  res.status(201).json({
    success: true,
    data: claim,
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
