// controllers/adminchronicleController.js
const Chronicle = require("../models/Chronicle");
const Enigma = require("../models/Enigma");
const Fragment = require("../models/Fragment");
const asyncHandler = require("../middleware/async");
const ErrorResponse = require("../utils/ErrorResponse");
const { uploadImageToCloudinary } = require("../utils/cloudinaryUpload");
const cloudinary = require("../config/cloudinary");
const mongoose = require("mongoose");

// @desc    Get all chronicles with filtering
// @route   GET /api/admin/chronicles
// @access  Private/Admin
exports.getChronicles = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    sort = "-createdAt",
    status,
    difficulty,
    enigmaId,
    featured,
    search,
  } = req.query;

  const query = {};

  if (status) query.status = status;
  if (difficulty) query.difficulty = difficulty;
  if (enigmaId) query.enigma = enigmaId;
  if (featured !== undefined) query.featured = featured === "true";
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { "author.name": { $regex: search, $options: "i" } },
    ];
  }

  const chronicles = await Chronicle.find(query)
    .populate("enigma", "name status")
    .sort(sort)
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

  const total = await Chronicle.countDocuments(query);

  // Get fragment counts for each chronicle
  const chronicleIds = chronicles.map((c) => c._id);
  const fragmentCounts = await Fragment.aggregate([
    { $match: { chronicle: { $in: chronicleIds } } },
    {
      $group: {
        _id: "$chronicle",
        totalFragments: { $sum: 1 },
        claimedFragments: {
          $sum: { $cond: [{ $eq: ["$status", "claimed"] }, 1, 0] },
        },
      },
    },
  ]);

  // Merge fragment counts with chronicles
  const chroniclesWithCounts = chronicles.map((chronicle) => {
    const counts = fragmentCounts.find(
      (fc) => fc._id.toString() === chronicle._id.toString()
    ) || { totalFragments: 0, claimedFragments: 0 };

    return {
      ...chronicle.toObject(),
      fragmentCount: counts.totalFragments,
      fragmentsClaimed: counts.claimedFragments,
    };
  });

  res.json({
    success: true,
    count: chronicles.length,
    total,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    },
    data: chroniclesWithCounts,
  });
});

// @desc    Get single chronicle
// @route   GET /api/admin/chronicles/:id
// @access  Private/Admin
exports.getChronicle = asyncHandler(async (req, res) => {
  const chronicle = await Chronicle.findById(req.params.id)
    .populate("enigma", "name description status")
    .populate({
      path: "fragments",
      options: { sort: { number: 1 } },
    });

  if (!chronicle) {
    return res.status(404).json({
      success: false,
      message: "Chronicle not found",
    });
  }

  res.json({
    success: true,
    data: chronicle,
  });
});

// @desc    Create new chronicle
// @route   POST /api/admin/chronicles
// @access  Private/Admin
exports.createChronicle = asyncHandler(async (req, res) => {
  const chronicleData = { ...req.body };

  // Handle cover image upload if it's base64
  if (
    chronicleData.coverImage &&
    chronicleData.coverImage.url &&
    chronicleData.coverImage.url.startsWith("data:image")
  ) {
    try {
      // Create a folder name based on the chronicle name
      const folderName = `chronicles/${chronicleData.name
        .replace(/\s+/g, "-")
        .toLowerCase()}`;

      const uploadedCover = await uploadImageToCloudinary(
        chronicleData.coverImage.url,
        folderName,
        "cover"
      );
      chronicleData.coverImage = {
        url: uploadedCover.url,
        publicId: uploadedCover.publicId,
        alt: chronicleData.coverImage.alt || chronicleData.name,
      };
    } catch (error) {
      console.error("Cover image upload failed:", error);
      // Remove the cover image if upload fails
      delete chronicleData.coverImage;
    }
  }

  // Remove any fields that shouldn't be saved
  delete chronicleData._id;

  const chronicle = await Chronicle.create(chronicleData);

  // Update enigma metadata
  await Enigma.findByIdAndUpdate(chronicle.enigma, {
    $inc: { "metadata.totalChronicles": 1 },
  });

  res.status(201).json({
    success: true,
    data: chronicle,
  });
});

// @desc    Update chronicle
// @route   PUT /api/admin/chronicles/:id
// @access  Private/Admin
exports.updateChronicle = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = { ...req.body };

  // Find existing chronicle
  const existingChronicle = await Chronicle.findById(id);
  if (!existingChronicle) {
    return res.status(404).json({
      success: false,
      message: "Chronicle not found",
    });
  }

  // Handle cover image update
  if (updateData.coverImage) {
    // If it's a new base64 image, upload to Cloudinary
    if (
      updateData.coverImage.url &&
      updateData.coverImage.url.startsWith("data:image")
    ) {
      try {
        // Delete old image if exists
        if (existingChronicle.coverImage?.publicId) {
          await cloudinary.uploader.destroy(
            existingChronicle.coverImage.publicId
          );
        }

        const folderName = `chronicles/${
          updateData.name || existingChronicle.name
        }`;
        const uploadedCover = await uploadImageToCloudinary(
          updateData.coverImage.url,
          folderName,
          "cover"
        );
        updateData.coverImage = {
          url: uploadedCover.url,
          publicId: uploadedCover.publicId,
          alt:
            updateData.coverImage.alt ||
            updateData.name ||
            existingChronicle.name,
        };
      } catch (error) {
        console.error("Cover image upload failed:", error);
        delete updateData.coverImage;
      }
    }
    // If coverImage is being removed or set to empty
    else if (!updateData.coverImage.url) {
      if (existingChronicle.coverImage?.publicId) {
        await cloudinary.uploader.destroy(
          existingChronicle.coverImage.publicId
        );
      }
      updateData.coverImage = { url: "", alt: "", publicId: "" };
    }
    // If coverImage URL is already a Cloudinary URL, keep it as is
    else if (
      updateData.coverImage.url &&
      updateData.coverImage.url.includes("cloudinary")
    ) {
      // Keep existing Cloudinary URL, no changes needed
    }
  }

  // Handle rewards: Remove any temporary _id fields if they exist
  if (updateData.rewards && Array.isArray(updateData.rewards)) {
    updateData.rewards = updateData.rewards.map((reward) => {
      const { _id, tempId, ...cleanReward } = reward;
      return cleanReward;
    });
  }

  // Remove fields that shouldn't be updated
  delete updateData._id;
  delete updateData.createdAt;
  delete updateData.__v;

  const chronicle = await Chronicle.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  }).populate("enigma", "name status");

  res.json({
    success: true,
    data: chronicle,
  });
});

// @desc    Delete chronicle
// @route   DELETE /api/admin/chronicles/:id
// @access  Private/Admin
exports.deleteChronicle = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const chronicle = await Chronicle.findById(id);
  if (!chronicle) {
    return res.status(404).json({
      success: false,
      message: "Chronicle not found",
    });
  }

  // Check if chronicle has fragments
  const fragmentsCount = await Fragment.countDocuments({
    chronicle: chronicle._id,
  });
  if (fragmentsCount > 0) {
    return res.status(400).json({
      success: false,
      message:
        "Cannot delete chronicle with existing fragments. Delete fragments first.",
    });
  }

  // Delete associated image from Cloudinary
  if (chronicle.coverImage?.publicId) {
    try {
      await cloudinary.uploader.destroy(chronicle.coverImage.publicId);
    } catch (error) {
      console.error("Failed to delete cover image from Cloudinary:", error);
      // Continue with deletion even if image deletion fails
    }
  }

  await chronicle.deleteOne();

  // Update enigma metadata
  await Enigma.findByIdAndUpdate(chronicle.enigma, {
    $inc: { "metadata.totalChronicles": -1 },
  });

  res.json({
    success: true,
    data: {},
  });
});

// @desc    Bulk update chronicles
// @route   PUT /api/admin/chronicles/bulk
// @access  Private/Admin
exports.bulkUpdateChronicles = asyncHandler(async (req, res) => {
  const { chronicleIds, updateData } = req.body;

  if (
    !chronicleIds ||
    !Array.isArray(chronicleIds) ||
    chronicleIds.length === 0
  ) {
    return res.status(400).json({
      success: false,
      message: "Please provide an array of chronicle IDs",
    });
  }

  const result = await Chronicle.updateMany(
    { _id: { $in: chronicleIds } },
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

// @desc    Get chronicle stats
// @route   GET /api/admin/chronicles/stats
// @access  Private/Admin
exports.getChronicleStats = asyncHandler(async (req, res) => {
  const [
    totalChronicles,
    availableChronicles,
    forgingChronicles,
    cipherChronicles,
    solvedChronicles,
    totalFragments,
    claimedFragments,
  ] = await Promise.all([
    Chronicle.countDocuments(),
    Chronicle.countDocuments({ status: "available" }),
    Chronicle.countDocuments({ status: "forging" }),
    Chronicle.countDocuments({ status: "cipher" }),
    Chronicle.countDocuments({ status: "solved" }),
    mongoose.model("Fragment").countDocuments(),
    mongoose.model("Fragment").countDocuments({ status: "claimed" }),
  ]);

  // Get production status breakdown
  const productionStatus = await Chronicle.aggregate([
    {
      $group: {
        _id: "$productionStatus",
        count: { $sum: 1 },
      },
    },
  ]);

  res.json({
    success: true,
    data: {
      totalChronicles,
      byStatus: {
        available: availableChronicles,
        forging: forgingChronicles,
        cipher: cipherChronicles,
        solved: solvedChronicles,
      },
      productionStatus: productionStatus.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {}),
      totalFragments,
      claimedFragments,
      claimRate:
        totalFragments > 0
          ? ((claimedFragments / totalFragments) * 100).toFixed(2)
          : 0,
    },
  });
});

// @desc    Update production status
// @route   PUT /api/admin/chronicles/:id/production-status
// @access  Private/Admin
exports.updateProductionStatus = asyncHandler(async (req, res) => {
  const { status, estimatedCompletion, notes } = req.body;

  const chronicle = await Chronicle.findByIdAndUpdate(
    req.params.id,
    {
      productionStatus: status,
      ...(estimatedCompletion && { estimatedCompletion }),
      ...(notes && {
        $push: { adminNotes: { text: notes, addedBy: req.user.id } },
      }),
    },
    { new: true }
  );

  if (!chronicle) {
    return res.status(404).json({
      success: false,
      message: "Chronicle not found",
    });
  }

  res.json({
    success: true,
    data: chronicle,
  });
});
