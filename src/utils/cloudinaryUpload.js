const cloudinary = require("../config/cloudinary");

const uploadImageToCloudinary = async (file, folder, publicId = null) => {
  try {
    let uploadResult;

    // If file is a buffer (from multer)
    if (file.buffer) {
      const b64 = Buffer.from(file.buffer).toString("base64");
      const dataURI = `data:${file.mimetype};base64,${b64}`;

      uploadResult = await cloudinary.uploader.upload(dataURI, {
        folder: folder,
        public_id: publicId,
        overwrite: true,
        transformation: [
          { width: 1200, height: 800, crop: "limit" },
          { quality: "auto" },
        ],
      });
    }
    // If file is a base64 string
    else if (typeof file === "string" && file.startsWith("data:image")) {
      uploadResult = await cloudinary.uploader.upload(file, {
        folder: folder,
        public_id: publicId,
        overwrite: true,
        transformation: [
          { width: 1200, height: 800, crop: "limit" },
          { quality: "auto" },
        ],
      });
    } else {
      throw new Error("Invalid file format");
    }

    return {
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
    };
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw new Error(`Failed to upload image: ${error.message}`);
  }
};

module.exports = { uploadImageToCloudinary };
