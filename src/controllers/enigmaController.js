const mongoose = require("mongoose");
const Enigma = require("../models/Enigma");
const Chronicle = require("../models/Chronicle");
const asyncHandler = require("../middleware/async");
const ErrorResponse = require("../utils/errorResponse");

// @desc    Get all enigmas
// @route   GET /api/enigmas
// @access  Public
exports.getEnigmas = asyncHandler(async (req, res, next) => {
  const {
    status,
    featured,
    difficulty,
    limit = 10,
    page = 1,
    sort = "-createdAt",
  } = req.query;

  const query = {};

  if (status) query.status = status;
  if (featured) query.featured = featured === "true";
  if (difficulty) query.difficulty = difficulty;

  const enigmas = await Enigma.find(query)
    .sort(sort)
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit))
    .populate({
      path: "chronicles",
      select:
        "name coverImage difficulty status stats.fragmentCount stats.fragmentsClaimed",
    });

  const total = await Enigma.countDocuments(query);

  res.status(200).json({
    success: true,
    count: enigmas.length,
    total,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    },
    data: enigmas,
  });
});

// @desc    Get single enigma
// @route   GET /api/enigmas/:id
// @access  Public
exports.getEnigma = asyncHandler(async (req, res, next) => {
  const enigma = await Enigma.findById(req.params.id).populate({
    path: "chronicles",
    match: { status: { $ne: "archived" } },
    select:
      "name description coverImage difficulty status stats timeline basePrice featured productionStatus",
    options: { sort: { featured: -1, "stats.fragmentsClaimed": -1 } },
  });

  if (!enigma) {
    return next(
      new ErrorResponse(`Enigma not found with id ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: enigma,
  });
});

// @desc    Get chronicles for an enigma
// @route   GET /api/enigmas/:id/chronicles
// @access  Public
exports.getEnigmaChronicles = asyncHandler(async (req, res, next) => {
  const { status, featured, limit = 20, page = 1 } = req.query;

  const query = { enigma: req.params.id };
  if (status) query.status = status;
  if (featured) query.featured = featured === "true";

  const chronicles = await Chronicle.find(query)
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit))
    .sort({ featured: -1, "stats.fragmentsClaimed": -1 });

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

// @desc    Get global stats
// @route   GET /api/enigmas/stats
// @access  Public
exports.getGlobalStats = asyncHandler(async (req, res, next) => {
  const [enigmas, chronicles, fragments, users] = await Promise.all([
    Enigma.countDocuments(),
    Chronicle.countDocuments(),
    mongoose.model("Fragment").countDocuments(),
    mongoose.model("User").countDocuments(),
  ]);

  const claimedFragments = await mongoose
    .model("Fragment")
    .countDocuments({ status: "claimed" });
  const activeWaitlists = await mongoose
    .model("Waitlist")
    .countDocuments({ status: "active" });

  res.status(200).json({
    success: true,
    data: {
      totalEnigmas: enigmas,
      totalChronicles: chronicles,
      totalFragments: fragments,
      totalKeepers: users,
      fragmentsClaimed: claimedFragments,
      activeWaitlists,
      claimRate:
        fragments > 0 ? ((claimedFragments / fragments) * 100).toFixed(2) : 0,
    },
  });
});

// @desc    Create new enigma (admin)
// @route   POST /api/enigmas
// @access  Private/Admin
exports.createEnigma = asyncHandler(async (req, res, next) => {
  const enigma = await Enigma.create(req.body);

  res.status(201).json({
    success: true,
    data: enigma,
  });
});

// @desc    Update enigma (admin)
// @route   PUT /api/enigmas/:id
// @access  Private/Admin
exports.updateEnigma = asyncHandler(async (req, res, next) => {
  const enigma = await Enigma.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!enigma) {
    return next(
      new ErrorResponse(`Enigma not found with id ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: enigma,
  });
});
