const mongoose = require("mongoose");
const Enigma = require("../models/Enigma");
const Chronicle = require("../models/Chronicle");
const asyncHandler = require("../middleware/async");
const ErrorResponse = require("../utils/errorResponse");

// @desc    Get all enigmas with filtering and pagination
// @route   GET /api/admin/enigmas
// @access  Private/Admin
exports.getEnigmas = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    sort = "-createdAt",
    status,
    difficulty,
    featured,
    search,
  } = req.query;

  const query = {};

  if (status) query.status = status;
  if (difficulty) query.difficulty = difficulty;
  if (featured !== undefined) query.featured = featured === "true";
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { "creator.name": { $regex: search, $options: "i" } },
    ];
  }

  const enigmas = await Enigma.find(query)
    .sort(sort)
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit))
    .populate({
      path: "chronicles",
      select: "name status stats.fragmentCount stats.fragmentsClaimed",
    });

  const total = await Enigma.countDocuments(query);

  res.json({
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
// @route   GET /api/admin/enigmas/:id
// @access  Private/Admin
exports.getEnigma = asyncHandler(async (req, res) => {
  const enigma = await Enigma.findById(req.params.id).populate({
    path: "chronicles",
    populate: {
      path: "fragments",
      select: "name number status rarity price",
    },
  });

  if (!enigma) {
    return res.status(404).json({
      success: false,
      message: "Enigma not found",
    });
  }

  res.json({
    success: true,
    data: enigma,
  });
});

// @desc    Create new enigma
// @route   POST /api/admin/enigmas
// @access  Private/Admin
exports.createEnigma = asyncHandler(async (req, res) => {
  const enigma = await Enigma.create(req.body);

  res.status(201).json({
    success: true,
    data: enigma,
  });
});

// @desc    Update enigma
// @route   PUT /api/admin/enigmas/:id
// @access  Private/Admin
exports.updateEnigma = asyncHandler(async (req, res) => {
  const enigma = await Enigma.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!enigma) {
    return res.status(404).json({
      success: false,
      message: "Enigma not found",
    });
  }

  res.json({
    success: true,
    data: enigma,
  });
});

// @desc    Delete enigma
// @route   DELETE /api/admin/enigmas/:id
// @access  Private/Admin
exports.deleteEnigma = asyncHandler(async (req, res) => {
  const enigma = await Enigma.findById(req.params.id);

  if (!enigma) {
    return res.status(404).json({
      success: false,
      message: "Enigma not found",
    });
  }

  // Check if enigma has chronicles
  const chroniclesCount = await Chronicle.countDocuments({
    enigma: enigma._id,
  });
  if (chroniclesCount > 0) {
    return res.status(400).json({
      success: false,
      message:
        "Cannot delete enigma with existing chronicles. Delete chronicles first.",
    });
  }

  await enigma.deleteOne();

  res.json({
    success: true,
    data: {},
  });
});

// @desc    Bulk update enigmas
// @route   PUT /api/admin/enigmas/bulk
// @access  Private/Admin
exports.bulkUpdateEnigmas = asyncHandler(async (req, res) => {
  const { enigmaIds, updateData } = req.body;

  if (!enigmaIds || !Array.isArray(enigmaIds) || enigmaIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Please provide an array of enigma IDs",
    });
  }

  const result = await Enigma.updateMany(
    { _id: { $in: enigmaIds } },
    updateData,
    { runValidators: true }
  );

  res.json({
    success: true,
    data: {
      matched: result.matchedCount,
      modified: result.modifiedCount,
    },
  });
});

// @desc    Get enigma stats for dashboard
// @route   GET /api/admin/enigmas/stats
// @access  Private/Admin
exports.getEnigmaStats = asyncHandler(async (req, res) => {
  const [
    totalEnigmas,
    activeEnigmas,
    upcomingEnigmas,
    solvedEnigmas,
    totalChronicles,
    totalFragments,
    claimedFragments,
  ] = await Promise.all([
    Enigma.countDocuments(),
    Enigma.countDocuments({ status: "active" }),
    Enigma.countDocuments({ status: "upcoming" }),
    Enigma.countDocuments({ status: "solved" }),
    Chronicle.countDocuments(),
    mongoose.model("Fragment").countDocuments(),
    mongoose.model("Fragment").countDocuments({ status: "claimed" }),
  ]);

  res.json({
    success: true,
    data: {
      totalEnigmas,
      activeEnigmas,
      upcomingEnigmas,
      solvedEnigmas,
      totalChronicles,
      totalFragments,
      claimedFragments,
      claimRate:
        totalFragments > 0
          ? ((claimedFragments / totalFragments) * 100).toFixed(2)
          : 0,
    },
  });
});

// @desc    Export enigmas
// @route   GET /api/admin/enigmas/export
// @access  Private/Admin
exports.exportEnigmas = asyncHandler(async (req, res) => {
  const { format = "json" } = req.query;

  const enigmas = await Enigma.find()
    .populate({
      path: "chronicles",
      select: "name stats.fragmentCount stats.fragmentsClaimed",
    })
    .lean();

  if (format === "csv") {
    // Flatten data for CSV
    const flattened = enigmas.map((e) => ({
      id: e._id,
      name: e.name,
      description: e.description,
      status: e.status,
      difficulty: e.difficulty,
      featured: e.featured,
      totalChronicles: e.metadata?.totalChronicles || 0,
      totalFragments: e.metadata?.totalFragments || 0,
      fragmentsClaimed: e.metadata?.fragmentsClaimed || 0,
      created: e.createdAt,
      updated: e.updatedAt,
    }));

    // Convert to CSV
    const headers = Object.keys(flattened[0]).join(",");
    const rows = flattened
      .map((item) => Object.values(item).join(","))
      .join("\n");
    const csv = `${headers}\n${rows}`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=enigmasexport-${Date.now()}.csv`
    );
    return res.send(csv);
  }

  // Default JSON export
  res.setHeader("Content-Type", "application/json");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=enigmasexport-${Date.now()}.json`
  );
  res.json(enigmas);
});

// @desc    Update enigma order (for drag-and-drop)
// @route   PUT /api/admin/enigmas/order
// @access  Private/Admin
exports.updateEnigmasOrder = asyncHandler(async (req, res) => {
  const { enigmas } = req.body;

  if (!Array.isArray(enigmas)) {
    return res.status(400).json({
      success: false,
      message: "Please provide an array of enigmas with order",
    });
  }

  const operations = enigmas.map((enigma, index) => ({
    updateOne: {
      filter: { _id: enigma.id },
      update: { displayOrder: index + 1 },
    },
  }));

  await Enigma.bulkWrite(operations);

  res.json({
    success: true,
    data: { message: "Order updated successfully" },
  });
});
