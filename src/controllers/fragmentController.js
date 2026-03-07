const Fragment = require("../models/Fragment");
const Chronicle = require("../models/Chronicle");
const Claim = require("../models/Claim");
const asyncHandler = require("../middleware/async");
const ErrorResponse = require("../utils/errorResponse");

// @desc    Get all fragments
// @route   GET /api/fragments
// @access  Public
exports.getFragments = asyncHandler(async (req, res, next) => {
  const {
    status,
    rarity,
    chronicle,
    featured,
    minPrice,
    maxPrice,
    sort = "-createdAt",
    limit = 20,
    page = 1,
  } = req.query;

  const query = {};

  if (status) query.status = status;
  if (rarity) query.rarity = rarity;
  if (chronicle) query.chronicle = chronicle;
  if (featured) query.isFeatured = featured === "true";
  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = parseInt(minPrice);
    if (maxPrice) query.price.$lte = parseInt(maxPrice);
  }

  const fragments = await Fragment.find(query)
    .populate("chronicle", "name enigma")
    .populate("claimedBy", "keeperProfile.displayName")
    .sort(sort)
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

  const total = await Fragment.countDocuments(query);

  res.status(200).json({
    success: true,
    count: fragments.length,
    total,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    },
    data: fragments,
  });
});

// @desc    Get single fragment
// @route   GET /api/fragments/:id
// @access  Public
exports.getFragment = asyncHandler(async (req, res, next) => {
  const fragment = await Fragment.findById(req.params.id)
    .populate("chronicle", "name description enigma")
    .populate("claimedBy", "keeperProfile.displayName keeperProfile.avatar");

  if (!fragment) {
    return next(
      new ErrorResponse(`Fragment not found with id ${req.params.id}`, 404)
    );
  }

  // Increment view count
  fragment.metadata.viewCount += 1;
  await fragment.save();

  res.status(200).json({
    success: true,
    data: fragment,
  });
});

// @desc    Check fragment availability
// @route   GET /api/fragments/:id/availability
// @access  Public
exports.checkAvailability = asyncHandler(async (req, res, next) => {
  const fragment = await Fragment.findById(req.params.id).select(
    "status chronicle price rarity"
  );

  if (!fragment) {
    return next(
      new ErrorResponse(`Fragment not found with id ${req.params.id}`, 404)
    );
  }

  const chronicle = await Chronicle.findById(fragment.chronicle).select(
    "stats.requiredFragments stats.fragmentsClaimed waitlist"
  );

  const availability = {
    isAvailable: fragment.status === "available",
    status: fragment.status,
    price: fragment.price,
    rarity: fragment.rarity,
    chronicleProgress: chronicle
      ? {
          required: chronicle.stats.requiredFragments,
          claimed: chronicle.stats.fragmentsClaimed,
          remaining:
            chronicle.stats.requiredFragments -
            chronicle.stats.fragmentsClaimed,
        }
      : null,
    waitlistEnabled: chronicle?.waitlist?.enabled || false,
    estimatedDelivery: fragment.estimatedDelivery,
  };

  res.status(200).json({
    success: true,
    data: availability,
  });
});

// @desc    Claim a fragment
// @route   POST /api/fragments/:id/claim
// @access  Private
exports.claimFragment = asyncHandler(async (req, res, next) => {
  const fragment = await Fragment.findById(req.params.id);

  if (!fragment) {
    return next(
      new ErrorResponse(`Fragment not found with id ${req.params.id}`, 404)
    );
  }

  if (fragment.status !== "available") {
    return next(new ErrorResponse("Fragment is no longer available", 400));
  }

  // Check if user already has a pending claim for this fragment
  const existingClaim = await Claim.findOne({
    fragment: fragment._id,
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

  // Create claim with user data from request body
  const claimData = {
    fragment: fragment._id,
    user: req.user.id,
    userData: {
      fullName:
        req.body.fullName || `${req.user.firstName} ${req.user.lastName}`,
      email: req.body.email || req.user.email,
      phone: req.body.phone || req.user.phone,
      shippingAddress:
        req.body.shippingAddress ||
        req.user.addresses?.find((a) => a.isDefault),
      size: req.body.size,
      customization: req.body.customization,
      acceptTerms: req.body.acceptTerms,
      acceptUpdates: req.body.acceptUpdates,
    },
    payment: {
      method: req.body.paymentMethod,
      amount: fragment.price,
      status: "pending",
    },
    status: "pending",
  };

  const claim = await Claim.create(claimData);

  // Update fragment status to reserved
  fragment.status = "reserved";
  fragment.claimedBy = req.user.id;
  await fragment.save();

  // TODO: Process payment based on payment method
  // This would integrate with Stripe/PayPal/etc.

  res.status(201).json({
    success: true,
    data: {
      claimId: claim.claimId,
      fragment: {
        id: fragment._id,
        name: fragment.name,
        number: fragment.number,
        price: fragment.price,
      },
      status: claim.status,
      message: "Claim initiated successfully. Please complete payment.",
    },
  });
});
