// controllers/fragmentController.js
const Fragment = require("../models/Fragment");
const Chronicle = require("../models/Chronicle");
const asyncHandler = require("../middleware/async");
const { uploadImageToCloudinary } = require("../utils/cloudinaryUpload");
const cloudinary = require("../config/cloudinary");
const mongoose = require("mongoose");

// @desc    Get all fragments with filtering
// @route   GET /api/admin/fragments
// @access  Private/Admin
exports.getFragments = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    sort = "number",
    status,
    rarity,
    chronicleId,
    featured,
    search,
  } = req.query;

  const query = {};

  if (status) query.status = status;
  if (rarity) query.rarity = rarity;
  if (chronicleId) query.chronicle = chronicleId;
  if (featured !== undefined) query.isFeatured = featured === "true";
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  const fragments = await Fragment.find(query)
    .populate("chronicle", "name enigma")
    .populate("claimedBy", "firstName lastName email")
    .sort(sort)
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

  const total = await Fragment.countDocuments(query);

  res.json({
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
// @route   GET /api/admin/fragments/:id
// @access  Private/Admin
exports.getFragment = asyncHandler(async (req, res) => {
  const fragment = await Fragment.findById(req.params.id)
    .populate("chronicle", "name enigma")
    .populate("claimedBy", "firstName lastName email");

  if (!fragment) {
    return res.status(404).json({
      success: false,
      message: "Fragment not found",
    });
  }

  res.json({
    success: true,
    data: fragment,
  });
});

// @desc    Create new fragment
// @route   POST /api/admin/fragments
// @access  Private/Admin
exports.createFragment = asyncHandler(async (req, res) => {
  const fragmentData = { ...req.body };

  // Handle image upload if it's base64
  if (
    fragmentData.imageUrl &&
    fragmentData.imageUrl.url &&
    fragmentData.imageUrl.url.startsWith("data:image")
  ) {
    try {
      // Get chronicle info for folder structure
      const chronicle = await Chronicle.findById(fragmentData.chronicle);
      if (chronicle) {
        const folderName = `fragments/${chronicle.name
          .replace(/\s+/g, "-")
          .toLowerCase()}`;

        const uploadedImage = await uploadImageToCloudinary(
          fragmentData.imageUrl.url,
          folderName,
          `fragment-${fragmentData.number}`
        );
        fragmentData.imageUrl = {
          url: uploadedImage.url,
          publicId: uploadedImage.publicId,
          alt: fragmentData.imageUrl.alt || fragmentData.name,
        };
      }
    } catch (error) {
      console.error("Fragment image upload failed:", error);
      delete fragmentData.imageUrl;
    }
  }

  // Remove any temporary fields
  delete fragmentData._id;

  const fragment = await Fragment.create(fragmentData);

  // Update chronicle fragment count
  await Chronicle.findByIdAndUpdate(fragment.chronicle, {
    $inc: { "stats.fragmentCount": 1 },
  });

  res.status(201).json({
    success: true,
    data: fragment,
  });
});

// @desc    Update fragment
// @route   PUT /api/admin/fragments/:id
// @access  Private/Admin
exports.updateFragment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = { ...req.body };

  // Find existing fragment
  const existingFragment = await Fragment.findById(id);
  if (!existingFragment) {
    return res.status(404).json({
      success: false,
      message: "Fragment not found",
    });
  }

  // Handle image update
  if (updateData.imageUrl) {
    // If it's a new base64 image, upload to Cloudinary
    if (
      updateData.imageUrl.url &&
      updateData.imageUrl.url.startsWith("data:image")
    ) {
      try {
        // Delete old image if exists
        if (existingFragment.imageUrl?.publicId) {
          await cloudinary.uploader.destroy(existingFragment.imageUrl.publicId);
        }

        const chronicle = await Chronicle.findById(
          updateData.chronicle || existingFragment.chronicle
        );
        const folderName = `fragments/${chronicle.name
          .replace(/\s+/g, "-")
          .toLowerCase()}`;

        const uploadedImage = await uploadImageToCloudinary(
          updateData.imageUrl.url,
          folderName,
          `fragment-${updateData.number || existingFragment.number}`
        );
        updateData.imageUrl = {
          url: uploadedImage.url,
          publicId: uploadedImage.publicId,
          alt:
            updateData.imageUrl.alt || updateData.name || existingFragment.name,
        };
      } catch (error) {
        console.error("Fragment image upload failed:", error);
        delete updateData.imageUrl;
      }
    }
    // If imageUrl is being removed or set to empty
    else if (!updateData.imageUrl.url) {
      if (existingFragment.imageUrl?.publicId) {
        await cloudinary.uploader.destroy(existingFragment.imageUrl.publicId);
      }
      updateData.imageUrl = { url: "", alt: "", publicId: "" };
    }
    // If imageUrl URL is already a Cloudinary URL, keep it as is
    else if (
      updateData.imageUrl.url &&
      updateData.imageUrl.url.includes("cloudinary")
    ) {
      // Keep existing Cloudinary URL, no changes needed
    }
  }

  // Remove fields that shouldn't be updated
  delete updateData._id;
  delete updateData.createdAt;
  delete updateData.__v;

  const fragment = await Fragment.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  }).populate("chronicle", "name enigma");

  res.json({
    success: true,
    data: fragment,
  });
});

// @desc    Delete fragment
// @route   DELETE /api/admin/fragments/:id
// @access  Private/Admin
exports.deleteFragment = asyncHandler(async (req, res) => {
  const fragment = await Fragment.findById(req.params.id);

  if (!fragment) {
    return res.status(404).json({
      success: false,
      message: "Fragment not found",
    });
  }

  // Delete associated image from Cloudinary
  if (fragment.imageUrl?.publicId) {
    try {
      await cloudinary.uploader.destroy(fragment.imageUrl.publicId);
    } catch (error) {
      console.error("Failed to delete fragment image from Cloudinary:", error);
      // Continue with deletion even if image deletion fails
    }
  }

  await fragment.deleteOne();

  // Update chronicle fragment count
  await Chronicle.findByIdAndUpdate(fragment.chronicle, {
    $inc: { "stats.fragmentCount": -1 },
  });

  res.json({
    success: true,
    data: {},
  });
});

// @desc    Bulk update fragments
// @route   PUT /api/admin/fragments/bulk
// @access  Private/Admin
exports.bulkUpdateFragments = asyncHandler(async (req, res) => {
  const { fragmentIds, updateData } = req.body;

  if (!fragmentIds || !Array.isArray(fragmentIds) || fragmentIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Please provide an array of fragment IDs",
    });
  }

  const result = await Fragment.updateMany(
    { _id: { $in: fragmentIds } },
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

// @desc    Get fragment stats
// @route   GET /api/admin/fragments/stats
// @access  Private/Admin
exports.getFragmentStats = asyncHandler(async (req, res) => {
  const [
    totalFragments,
    availableFragments,
    claimedFragments,
    reservedFragments,
    byRarity,
  ] = await Promise.all([
    Fragment.countDocuments(),
    Fragment.countDocuments({ status: "available" }),
    Fragment.countDocuments({ status: "claimed" }),
    Fragment.countDocuments({ status: "reserved" }),
    Fragment.aggregate([
      {
        $group: {
          _id: "$rarity",
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  res.json({
    success: true,
    data: {
      totalFragments,
      byStatus: {
        available: availableFragments,
        claimed: claimedFragments,
        reserved: reservedFragments,
      },
      byRarity: byRarity.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {}),
    },
  });
});
