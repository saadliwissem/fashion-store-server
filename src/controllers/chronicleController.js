const Chronicle = require("../models/Chronicle");
const Fragment = require("../models/Fragment");
const Waitlist = require("../models/Waitlist");
const asyncHandler = require("../middleware/async");
const ErrorResponse = require("../utils/errorResponse");

// @desc    Get all chronicles
// @route   GET /api/chronicles
// @access  Public
exports.getChronicles = asyncHandler(async (req, res, next) => {
  const {
    status,
    difficulty,
    enigma,
    featured,
    minPrice,
    maxPrice,
    sort = "-createdAt",
    limit = 12,
    page = 1,
  } = req.query;

  const query = {};

  if (status) query.status = status;
  if (difficulty) query.difficulty = difficulty;
  if (enigma) query.enigma = enigma;
  if (featured) query.featured = featured === "true";
  if (minPrice || maxPrice) {
    query.basePrice = {};
    if (minPrice) query.basePrice.$gte = parseInt(minPrice);
    if (maxPrice) query.basePrice.$lte = parseInt(maxPrice);
  }

  const chronicles = await Chronicle.find(query)
    .populate("enigma", "name difficulty")
    .sort(sort)
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

  const total = await Chronicle.countDocuments(query);

  res.status(200).json({
    success: true,
    count: chronicles.length,
    total,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    },
    data: chronicles,
  });
});

// @desc    Get single chronicle
// @route   GET /api/chronicles/:id
// @access  Public
exports.getChronicle = asyncHandler(async (req, res, next) => {
  const chronicle = await Chronicle.findById(req.params.id)
    .populate("enigma", "name description lore difficulty")
    .populate({
      path: "fragments",
      match: { status: { $ne: "archived" } },
      options: { sort: { number: 1 } },
    });

  if (!chronicle) {
    return next(
      new ErrorResponse(`Chronicle not found with id ${req.params.id}`, 404)
    );
  }

  // Increment view count
  chronicle.metadata.viewCount += 1;
  await chronicle.save();

  res.status(200).json({
    success: true,
    data: chronicle,
  });
});

// @desc    Get fragments for a chronicle
// @route   GET /api/chronicles/:id/fragments
// @access  Public
exports.getChronicleFragments = asyncHandler(async (req, res, next) => {
  const { status, rarity, featured, limit = 50, page = 1 } = req.query;

  const query = { chronicle: req.params.id };
  if (status) query.status = status;
  if (rarity) query.rarity = rarity;
  if (featured) query.isFeatured = featured === "true";

  const fragments = await Fragment.find(query)
    .populate("claimedBy", "keeperProfile.displayName keeperProfile.avatar")
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit))
    .sort({ number: 1, isFeatured: -1 });

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

// @desc    Get chronicle progress
// @route   GET /api/chronicles/:id/progress
// @access  Public
exports.getChronicleProgress = asyncHandler(async (req, res, next) => {
  const chronicle = await Chronicle.findById(req.params.id).select(
    "productionStatus stats estimatedStartDate estimatedCompletion"
  );

  if (!chronicle) {
    return next(
      new ErrorResponse(`Chronicle not found with id ${req.params.id}`, 404)
    );
  }

  const fragments = await Fragment.find({ chronicle: req.params.id }).select(
    "status rarity"
  );

  const progress = {
    production: {
      status: chronicle.productionStatus,
      startDate: chronicle.estimatedStartDate,
      completionDate: chronicle.estimatedCompletion,
      percentComplete:
        (chronicle.stats.fragmentsClaimed / chronicle.stats.requiredFragments) *
        100,
    },
    fragments: {
      total: chronicle.stats.fragmentCount,
      claimed: chronicle.stats.fragmentsClaimed,
      remaining:
        chronicle.stats.fragmentCount - chronicle.stats.fragmentsClaimed,
      byRarity: {
        common: fragments.filter((f) => f.rarity === "common").length,
        rare: fragments.filter((f) => f.rarity === "rare").length,
        legendary: fragments.filter((f) => f.rarity === "legendary").length,
      },
      claimedByRarity: {
        common: fragments.filter(
          (f) => f.rarity === "common" && f.status === "claimed"
        ).length,
        rare: fragments.filter(
          (f) => f.rarity === "rare" && f.status === "claimed"
        ).length,
        legendary: fragments.filter(
          (f) => f.rarity === "legendary" && f.status === "claimed"
        ).length,
      },
    },
  };

  res.status(200).json({
    success: true,
    data: progress,
  });
});

// @desc    Update production status (admin)
// @route   PATCH /api/chronicles/:id/production-status
// @access  Private/Admin
exports.updateProductionStatus = asyncHandler(async (req, res, next) => {
  const { status, estimatedCompletion } = req.body;

  const chronicle = await Chronicle.findByIdAndUpdate(
    req.params.id,
    {
      productionStatus: status,
      ...(estimatedCompletion && { estimatedCompletion }),
    },
    { new: true, runValidators: true }
  );

  if (!chronicle) {
    return next(
      new ErrorResponse(`Chronicle not found with id ${req.params.id}`, 404)
    );
  }

  // TODO: Send notifications to waitlist and claim holders

  res.status(200).json({
    success: true,
    data: chronicle,
  });
});

// @desc    Get waitlist stats for chronicle
// @route   GET /api/chronicles/:id/waitlist-stats
// @access  Public
exports.getWaitlistStats = asyncHandler(async (req, res, next) => {
  const chronicle = await Chronicle.findById(req.params.id).select(
    "waitlist stats.requiredFragments stats.fragmentsClaimed"
  );

  if (!chronicle) {
    return next(
      new ErrorResponse(`Chronicle not found with id ${req.params.id}`, 404)
    );
  }

  const waitlistStats = await Waitlist.aggregate([
    { $match: { chronicle: chronicle._id, status: "active" } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        avgPosition: { $avg: "$position" },
        maxPosition: { $max: "$position" },
      },
    },
  ]);

  const lastAvailableFragment =
    chronicle.stats.requiredFragments - chronicle.stats.fragmentsClaimed;

  res.status(200).json({
    success: true,
    data: {
      chronicleId: chronicle._id,
      waitlistEnabled: chronicle.waitlist.enabled,
      waitlistCapacity: chronicle.waitlist.maxCapacity,
      currentWaitlist: waitlistStats[0]?.total || 0,
      averageWaitTime: "2-3 weeks", // This would be calculated from historical data
      lastAvailableFragment:
        lastAvailableFragment > 0 ? lastAvailableFragment : 0,
      nextExpectedRelease: chronicle.estimatedCompletion,
      positionsAhead: waitlistStats[0]?.maxPosition || 0,
    },
  });
});
