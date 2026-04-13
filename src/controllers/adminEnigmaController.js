const mongoose = require("mongoose");
const Enigma = require("../models/Enigma");
const Chronicle = require("../models/Chronicle");
const asyncHandler = require("../middleware/async");
const ErrorResponse = require("../utils/ErrorResponse");
const { uploadImageToCloudinary } = require("../utils/cloudinaryUpload");

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
// @desc    Create new enigma
// @route   POST /api/admin/enigmas
// @access  Private/Admin
exports.createEnigma = asyncHandler(async (req, res) => {
  const enigmaData = { ...req.body };

  // Handle cover image upload if it's base64
  if (
    enigmaData.coverImage &&
    enigmaData.coverImage.url &&
    enigmaData.coverImage.url.startsWith("data:image")
  ) {
    try {
      const uploadedCover = await uploadImageToCloudinary(
        enigmaData.coverImage.url,
        `enigmas/${enigmaData.name.replace(/\s+/g, "-").toLowerCase()}`,
        "cover"
      );
      enigmaData.coverImage = {
        url: uploadedCover.url,
        publicId: uploadedCover.publicId,
        alt: enigmaData.coverImage.alt || enigmaData.name,
      };
    } catch (error) {
      console.error("Cover image upload failed:", error);
      // Keep the original base64 or remove it
      if (enigmaData.coverImage.url.startsWith("data:image")) {
        delete enigmaData.coverImage;
      }
    }
  }

  // Handle banner image upload if it's base64
  if (
    enigmaData.bannerImage &&
    enigmaData.bannerImage.url &&
    enigmaData.bannerImage.url.startsWith("data:image")
  ) {
    try {
      const uploadedBanner = await uploadImageToCloudinary(
        enigmaData.bannerImage.url,
        `enigmas/${enigmaData.name.replace(/\s+/g, "-").toLowerCase()}`,
        "banner"
      );
      enigmaData.bannerImage = {
        url: uploadedBanner.url,
        publicId: uploadedBanner.publicId,
        alt: enigmaData.bannerImage.alt || enigmaData.name,
      };
    } catch (error) {
      console.error("Banner image upload failed:", error);
      if (enigmaData.bannerImage.url.startsWith("data:image")) {
        delete enigmaData.bannerImage;
      }
    }
  }

  // Remove any fields that shouldn't be saved
  delete enigmaData._id;

  const enigma = await Enigma.create(enigmaData);

  res.status(201).json({
    success: true,
    data: enigma,
  });
});

// @desc    Update enigma
// @route   PUT /api/admin/enigmas/:id
// @access  Private/Admin
exports.updateEnigma = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = { ...req.body };

  // Find existing enigma
  const existingEnigma = await Enigma.findById(id);
  if (!existingEnigma) {
    return res.status(404).json({
      success: false,
      message: "Enigma not found",
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
        if (existingEnigma.coverImage?.publicId) {
          await cloudinary.uploader.destroy(existingEnigma.coverImage.publicId);
        }

        const uploadedCover = await uploadImageToCloudinary(
          updateData.coverImage.url,
          `enigmas/${updateData.name || existingEnigma.name}`,
          "cover"
        );
        updateData.coverImage = {
          url: uploadedCover.url,
          publicId: uploadedCover.publicId,
          alt:
            updateData.coverImage.alt || updateData.name || existingEnigma.name,
        };
      } catch (error) {
        console.error("Cover image upload failed:", error);
        delete updateData.coverImage;
      }
    }
    // If coverImage is being removed or set to empty
    else if (!updateData.coverImage.url) {
      if (existingEnigma.coverImage?.publicId) {
        await cloudinary.uploader.destroy(existingEnigma.coverImage.publicId);
      }
    }
  }

  // Handle banner image update (similar logic)
  if (updateData.bannerImage) {
    if (
      updateData.bannerImage.url &&
      updateData.bannerImage.url.startsWith("data:image")
    ) {
      try {
        if (existingEnigma.bannerImage?.publicId) {
          await cloudinary.uploader.destroy(
            existingEnigma.bannerImage.publicId
          );
        }

        const uploadedBanner = await uploadImageToCloudinary(
          updateData.bannerImage.url,
          `enigmas/${updateData.name || existingEnigma.name}`,
          "banner"
        );
        updateData.bannerImage = {
          url: uploadedBanner.url,
          publicId: uploadedBanner.publicId,
          alt:
            updateData.bannerImage.alt ||
            updateData.name ||
            existingEnigma.name,
        };
      } catch (error) {
        console.error("Banner image upload failed:", error);
        delete updateData.bannerImage;
      }
    }
  }

  // Remove fields that shouldn't be updated
  delete updateData._id;
  delete updateData.createdAt;
  delete updateData.__v;

  const enigma = await Enigma.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: enigma,
  });
});

// @desc    Delete enigma
// @route   DELETE /api/admin/enigmas/:id
// @access  Private/Admin
exports.deleteEnigma = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const enigma = await Enigma.findById(id);
  if (!enigma) {
    return res.status(404).json({
      success: false,
      message: "Enigma not found",
    });
  }

  // Delete associated images from Cloudinary
  const deletePromises = [];
  if (enigma.coverImage?.publicId) {
    deletePromises.push(
      cloudinary.uploader.destroy(enigma.coverImage.publicId)
    );
  }
  if (enigma.bannerImage?.publicId) {
    deletePromises.push(
      cloudinary.uploader.destroy(enigma.bannerImage.publicId)
    );
  }

  await Promise.all(deletePromises);

  await enigma.deleteOne();

  res.status(200).json({
    success: true,
    message: "Enigma deleted successfully",
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
