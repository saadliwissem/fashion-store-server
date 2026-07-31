// controllers/admin/homePageController.js
const HomePageSettings = require("../models/HomePageSettings");
const asyncHandler = require("../middleware/async");
const ErrorResponse = require("../utils/ErrorResponse");
const { uploadImageToCloudinary } = require("../utils/cloudinaryUpload");
const cloudinary = require("../config/cloudinary");

// @desc    Get home page settings
// @route   GET /api/home/settings
// @access  Public
exports.getHomeSettings = asyncHandler(async (req, res) => {
  const settings = await HomePageSettings.getSettings();

  res.json({
    success: true,
    data: settings,
  });
});

// @desc    Update home page settings
// @route   PUT /api/admin/home/settings
// @access  Private/Admin

exports.updateHomeSettings = asyncHandler(async (req, res) => {
  console.log("=== UPDATE HOME SETTINGS ===");
  console.log("Request body:", req.body);
  console.log("Files:", req.files);

  const settings = await HomePageSettings.getSettings();
  let updateData = {};

  // Parse the data from FormData
  if (req.body.data) {
    try {
      updateData = JSON.parse(req.body.data);
    } catch (error) {
      console.error("Error parsing data:", error);
      return res.status(400).json({
        success: false,
        message: "Invalid data format",
      });
    }
  } else {
    updateData = { ...req.body };
  }

  const files = req.files || {};

  // Handle hero image upload
  if (files.heroImage && files.heroImage[0]) {
    try {
      if (settings.hero?.image?.publicId) {
        await cloudinary.uploader.destroy(settings.hero.image.publicId);
      }

      const uploadedImage = await uploadImageToCloudinary(
        files.heroImage[0],
        "home/hero",
        "hero-image"
      );

      updateData.hero = {
        ...updateData.hero,
        image: {
          url: uploadedImage.url,
          publicId: uploadedImage.publicId,
          alt: updateData.hero?.image?.alt || "Hero Image",
        },
      };
    } catch (error) {
      console.error("Hero image upload failed:", error);
    }
  }

  // Handle mystery image upload
  if (files.mysteryImage && files.mysteryImage[0]) {
    try {
      if (settings.mysteries?.featuredMystery?.image?.publicId) {
        await cloudinary.uploader.destroy(
          settings.mysteries.featuredMystery.image.publicId
        );
      }

      const uploadedImage = await uploadImageToCloudinary(
        files.mysteryImage[0],
        "home/mystery",
        "featured-mystery"
      );

      updateData.mysteries = {
        ...updateData.mysteries,
        featuredMystery: {
          ...updateData.mysteries?.featuredMystery,
          image: {
            url: uploadedImage.url,
            publicId: uploadedImage.publicId,
            alt:
              updateData.mysteries?.featuredMystery?.image?.alt ||
              "Featured Mystery",
          },
        },
      };
    } catch (error) {
      console.error("Mystery image upload failed:", error);
    }
  }

  // Remove fields that shouldn't be updated
  delete updateData._id;
  delete updateData.createdAt;
  delete updateData.__v;

  updateData.updatedBy = req.user.id;

  console.log("Final update data:", JSON.stringify(updateData, null, 2));

  const updatedSettings = await HomePageSettings.findByIdAndUpdate(
    settings._id,
    updateData,
    {
      new: true,
      runValidators: true,
    }
  );

  res.json({
    success: true,
    data: updatedSettings,
  });
});

// @desc    Reset home page settings to default
// @route   DELETE /api/admin/home/settings/reset
// @access  Private/Admin
exports.resetHomeSettings = asyncHandler(async (req, res) => {
  const settings = await HomePageSettings.getSettings();

  // Delete uploaded images
  if (settings.hero?.image?.publicId) {
    await cloudinary.uploader.destroy(settings.hero.image.publicId);
  }
  if (settings.mysteries?.featuredMystery?.image?.publicId) {
    await cloudinary.uploader.destroy(
      settings.mysteries.featuredMystery.image.publicId
    );
  }

  await HomePageSettings.deleteMany();
  const newSettings = await HomePageSettings.create({});

  res.json({
    success: true,
    data: newSettings,
  });
});
