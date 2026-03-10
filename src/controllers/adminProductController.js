const cloudinary = require("../config/cloudinary");
const Product = require("../models/Product");
const Category = require("../models/Category");
const { validationResult } = require("express-validator");
const Inventory = require("../models/Inventory");

// Helper function to upload image to Cloudinary
const uploadImageToCloudinary = async (file, productId, index) => {
  try {
    // Convert buffer to base64
    const b64 = Buffer.from(file.buffer).toString("base64");
    const dataURI = `data:${file.mimetype};base64,${b64}`;

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(dataURI, {
      folder: `products/${productId}`,
      public_id: `image-${index + 1}`,
      overwrite: true,
      transformation: [
        { width: 1000, height: 1000, crop: "limit" }, // Resize if too large
        { quality: "auto" }, // Automatic quality optimization
      ],
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
    };
  } catch (error) {
    console.error(`Error uploading image ${index}:`, error);
    throw new Error(`Failed to upload image ${index + 1}`);
  }
};
// @desc    Get all products with filtering, sorting, and pagination
// @route   GET /api/admin/products
// @access  Private/Admin
// @desc    Get all products with filtering, sorting, and pagination
// @route   GET /api/admin/products
// @access  Private/Admin
exports.getProducts = async (req, res) => {
  try {
    const {
      category,
      status,
      featured,
      search,
      minPrice,
      maxPrice,
      stockStatus, // Add this for filtering by stock status
      sortBy = "createdAt",
      sortOrder = "desc",
      limit = 10,
      page = 1,
    } = req.query;

    // Build query
    let query = {};

    // Category filter
    if (category) {
      query.category = category;
    }

    // Status filter
    if (status && status !== "all") {
      query.status = status;
    }

    // Featured filter
    if (featured !== undefined) {
      query.featured = featured === "true";
    }

    // Price range filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { tags: { $in: [new RegExp(search, "i")] } },
      ];
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Execute query to get products first
    let products = await Product.find(query)
      .populate("category", "name slug")
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get inventory data for all products
    const productIds = products.map((p) => p._id);

    // Aggregate inventory data
    const inventoryData = await Inventory.aggregate([
      {
        $match: {
          product: { $in: productIds },
        },
      },
      {
        $group: {
          _id: "$product",
          totalStock: { $sum: "$currentStock" },
          variantCount: { $sum: 1 },
          lowStockThreshold: { $first: "$lowStockThreshold" },
          variants: {
            $push: {
              color: "$variant.color",
              size: "$variant.size",
              stock: "$currentStock",
              location: "$location",
              status: "$status",
            },
          },
          // Get min stock for low stock detection
          minStock: { $min: "$currentStock" },
          // Get max stock
          maxStock: { $max: "$currentStock" },
        },
      },
    ]);

    // Create a map for easy lookup
    const inventoryMap = {};
    inventoryData.forEach((item) => {
      inventoryMap[item._id.toString()] = item;
    });

    // Add inventory data to each product
    products = products.map((product) => {
      const inventory = inventoryMap[product._id.toString()] || {
        totalStock: 0,
        variantCount: 0,
        lowStockThreshold: 10,
        variants: [],
      };

      // Determine stock status
      let stockStatus = "in-stock";
      if (inventory.totalStock === 0) {
        stockStatus = "out-of-stock";
      } else if (inventory.totalStock <= inventory.lowStockThreshold) {
        stockStatus = "low-stock";
      }

      return {
        ...product,
        stock: inventory.totalStock,
        stockStatus: stockStatus,
        lowStockThreshold: inventory.lowStockThreshold,
        variantCount: inventory.variantCount,
        variants: inventory.variants,
        inventorySummary: {
          total: inventory.totalStock,
          variants: inventory.variantCount,
          minStock: inventory.minStock || 0,
          maxStock: inventory.maxStock || 0,
        },
      };
    });

    // Filter by stock status if provided
    if (stockStatus && stockStatus !== "all") {
      products = products.filter((p) => p.stockStatus === stockStatus);
    }

    // Get total count for pagination (considering stock filter if applied)
    let total;
    if (stockStatus && stockStatus !== "all") {
      // If stock filter is applied, we need to count filtered results
      total = products.length;
    } else {
      total = await Product.countDocuments(query);
    }

    // Calculate additional stats for the response
    const stats = {
      totalProducts: total,
      totalStock: products.reduce((sum, p) => sum + p.stock, 0),
      productsWithStock: products.filter((p) => p.stock > 0).length,
      productsOutOfStock: products.filter((p) => p.stock === 0).length,
      productsLowStock: products.filter(
        (p) => p.stock > 0 && p.stock <= (p.lowStockThreshold || 10)
      ).length,
      totalInventoryValue: products.reduce(
        (sum, p) => sum + p.price * p.stock,
        0
      ),
    };

    res.json({
      success: true,
      count: products.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      products,
      stats, // Send stats for the dashboard
    });
  } catch (error) {
    console.error("Get products error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Get single product by ID
// @route   GET /api/admin/products/:id
// @access  Private/Admin
exports.getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("category", "name slug")
      .lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.json({
      success: true,
      product,
    });
  } catch (error) {
    console.error("Get product error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Create new product
// @route   POST /api/admin/products
// @access  Private/Admin
// @desc    Create new product with inventory
// @route   POST /api/admin/products
// @access  Private/Admin
exports.createProduct = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { sku, category, variants = [] } = req.body;

    // Check if there are files uploaded (multer handles these)
    const uploadedFiles = req.files || [];

    // Check for base64 images in the request body
    const base64Images = req.body.images || [];

    // Check if SKU exists
    const existingProduct = await Product.findOne({ sku });
    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message: "Product with this SKU already exists",
      });
    }

    // Check category
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(400).json({
        success: false,
        message: "Category not found",
      });
    }

    // Create a copy of req.body without the images field
    const productData = { ...req.body };
    delete productData.images; // Remove images from product data initially

    // Create product first to get the ID
    const product = new Product({
      ...productData,
      images: [], // Temporary empty array
    });

    await product.save();

    try {
      // Upload images to Cloudinary
      const uploadedImageUrls = [];

      // 1. Upload file images from multer (if any)
      if (uploadedFiles && uploadedFiles.length > 0) {
        for (let i = 0; i < uploadedFiles.length; i++) {
          const file = uploadedFiles[i];
          const imageData = await uploadImageToCloudinary(file, product._id, i);
          uploadedImageUrls.push(imageData.url);
        }
      }

      // 2. Upload base64 images from request body (if any)
      if (base64Images && base64Images.length > 0) {
        for (let i = 0; i < base64Images.length; i++) {
          const base64Image = base64Images[i];

          // Skip if it's empty or not a valid base64 string
          if (
            !base64Image ||
            typeof base64Image !== "string" ||
            !base64Image.startsWith("data:image")
          ) {
            continue;
          }

          try {
            // Extract the base64 data
            const base64Data = base64Image.split(",")[1] || base64Image;

            // Determine mimetype from the base64 string
            let mimetype = "image/jpeg"; // default
            if (base64Image.startsWith("data:image/png")) {
              mimetype = "image/png";
            } else if (base64Image.startsWith("data:image/gif")) {
              mimetype = "image/gif";
            } else if (base64Image.startsWith("data:image/webp")) {
              mimetype = "image/webp";
            } else if (
              base64Image.startsWith("data:image/jpeg") ||
              base64Image.startsWith("data:image/jpg")
            ) {
              mimetype = "image/jpeg";
            }

            // Convert base64 to buffer
            const buffer = Buffer.from(base64Data, "base64");

            // Create a file-like object for the upload function
            const fileObject = {
              buffer: buffer,
              mimetype: mimetype,
              originalname: `image-${uploadedFiles.length + i + 1}.jpg`,
            };

            const imageData = await uploadImageToCloudinary(
              fileObject,
              product._id,
              uploadedFiles.length + i
            );
            uploadedImageUrls.push(imageData.url);
          } catch (imageError) {
            console.error(`Error uploading base64 image ${i}:`, imageError);
            // Continue with other images even if one fails
          }
        }
      }

      // Update product with uploaded images
      if (uploadedImageUrls.length > 0) {
        product.images = uploadedImageUrls;
        await product.save();
      }

      // Create inventory records (rest of your code remains the same)
      if (variants.length > 0) {
        const inventoryPromises = variants.map((variant, index) => {
          const row = String.fromCharCode(65 + Math.floor(index / 10));
          const bay = (index % 10) + 1;
          const location = `${row}${bay}-${String(index + 1).padStart(2, "0")}`;

          return Inventory.create({
            product: product._id,
            variant: {
              color: variant.color,
              size: variant.size,
            },
            currentStock: variant.stock || 0,
            unitCost: req.body.costPrice || 0,
            lowStockThreshold: 10,
            location: location,
            warehouse: "Main Warehouse",
            status: (variant.stock || 0) > 0 ? "in-stock" : "out-of-stock",
            reorderPoint: 5,
            reorderQuantity: 50,
            supplier: "Default Supplier",
            leadTime: 7,
          });
        });

        await Promise.all(inventoryPromises);
      } else {
        await Inventory.create({
          product: product._id,
          currentStock: 0,
          unitCost: req.body.costPrice || 0,
          lowStockThreshold: 10,
          location: "A1-01",
          warehouse: "Main Warehouse",
          status: "out-of-stock",
          reorderPoint: 5,
          reorderQuantity: 50,
          supplier: "Default Supplier",
          leadTime: 7,
        });
      }

      // Populate for response
      await product.populate("category", "name slug");

      res.status(201).json({
        success: true,
        message: "Product created successfully",
        product,
      });
    } catch (uploadError) {
      // If image upload fails, delete the product we created
      await Product.findByIdAndDelete(product._id);

      console.error("Image upload error:", uploadError);
      return res.status(400).json({
        success: false,
        message: uploadError.message || "Failed to upload images",
      });
    }
  } catch (error) {
    console.error("Create product error:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Product with this SKU or slug already exists",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: Object.values(error.errors).map((err) => err.message),
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Update product
// @route   PUT /api/admin/products/:id
// @access  Private/Admin
exports.updateProduct = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    // Check if product exists
    let product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Check if new SKU conflicts with another product
    if (req.body.sku && req.body.sku !== product.sku) {
      const existingProduct = await Product.findOne({ sku: req.body.sku });
      if (existingProduct) {
        return res.status(400).json({
          success: false,
          message: "Product with this SKU already exists",
        });
      }
    }

    // Check if category exists
    if (req.body.category) {
      const categoryExists = await Category.findById(req.body.category);
      if (!categoryExists) {
        return res.status(400).json({
          success: false,
          message: "Category not found",
        });
      }
    }

    // Handle image updates
    const uploadedFiles = req.files || [];
    const base64Images = req.body.images || [];
    const existingImageUrls = req.body.existingImages || []; // You might send this from frontend
    const imagesToKeep = [];

    // Determine which images to keep from existing ones
    if (existingImageUrls.length > 0) {
      // If frontend sends list of existing images to keep
      imagesToKeep.push(...existingImageUrls);
    } else {
      // If no existingImages sent, keep all current images (default behavior)
      imagesToKeep.push(...product.images);
    }

    // Upload new images
    const newImageUrls = [];

    // Upload file images from multer
    if (uploadedFiles && uploadedFiles.length > 0) {
      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        const imageData = await uploadImageToCloudinary(
          file,
          product._id,
          Date.now() + i
        );
        newImageUrls.push(imageData.url);
      }
    }

    // Upload base64 images
    if (base64Images && base64Images.length > 0) {
      for (let i = 0; i < base64Images.length; i++) {
        const base64Image = base64Images[i];

        if (
          !base64Image ||
          typeof base64Image !== "string" ||
          !base64Image.startsWith("data:image")
        ) {
          continue;
        }

        try {
          const base64Data = base64Image.split(",")[1] || base64Image;

          let mimetype = "image/jpeg";
          if (base64Image.startsWith("data:image/png")) {
            mimetype = "image/png";
          } else if (base64Image.startsWith("data:image/gif")) {
            mimetype = "image/gif";
          } else if (base64Image.startsWith("data:image/webp")) {
            mimetype = "image/webp";
          }

          const buffer = Buffer.from(base64Data, "base64");

          const fileObject = {
            buffer: buffer,
            mimetype: mimetype,
            originalname: `image-${uploadedFiles.length + i + 1}.jpg`,
          };

          const imageData = await uploadImageToCloudinary(
            fileObject,
            product._id,
            Date.now() + uploadedFiles.length + i
          );
          newImageUrls.push(imageData.url);
        } catch (imageError) {
          console.error(`Error uploading base64 image ${i}:`, imageError);
        }
      }
    }

    // Combine kept images with new ones
    const finalImages = [...imagesToKeep, ...newImageUrls];

    // Prepare update data
    const updateData = { ...req.body };

    // Handle images in update
    if (finalImages.length > 0) {
      updateData.images = finalImages;
    } else if (req.body.images === null || req.body.images === undefined) {
      // If images field is explicitly set to null/undefined, keep existing
      delete updateData.images;
    }

    // Remove the images field from req.body if it exists to avoid conflicts
    delete updateData.images; // We already set it above if needed

    // Update product
    product = await Product.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    }).populate("category", "name slug");

    res.json({
      success: true,
      message: "Product updated successfully",
      product,
    });
  } catch (error) {
    console.error("Update product error:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Product with this SKU or slug already exists",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: Object.values(error.errors).map((err) => err.message),
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Delete product
// @route   DELETE /api/admin/products/:id
// @access  Private/Admin
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Check if product has any orders (optional)
    // const orderCount = await Order.countDocuments({ 'items.product': req.params.id });
    // if (orderCount > 0) {
    //   return res.status(400).json({
    //     success: false,
    //     message: `Cannot delete product with ${orderCount} orders`,
    //   });
    // }

    // Delete images from Cloudinary
    if (product.images && product.images.length > 0) {
      try {
        for (const imageUrl of product.images) {
          // Extract public_id from Cloudinary URL
          // Cloudinary URL format: https://res.cloudinary.com/cloud-name/image/upload/v1234567890/products/product-id/image-1.jpg
          const urlParts = imageUrl.split("/");
          const publicIdWithExtension = urlParts[urlParts.length - 1];
          const publicId = publicIdWithExtension.split(".")[0]; // Remove file extension

          // Get the folder path
          const folderPath = urlParts[urlParts.length - 2];

          if (folderPath === "upload") {
            // For images in the main folder
            await cloudinary.uploader.destroy(publicId);
          } else {
            // For images in product folder
            const fullPublicId = `${folderPath}/${publicId}`;
            await cloudinary.uploader.destroy(fullPublicId);
          }
        }

        // Optional: Delete the entire product folder from Cloudinary
        await cloudinary.api.delete_folder(`products/${product._id}`);
      } catch (cloudinaryError) {
        console.error(
          "Error deleting images from Cloudinary:",
          cloudinaryError
        );
        // Continue with product deletion even if image deletion fails
        // You might want to log this but not block the product deletion
      }
    }

    // Delete inventory records associated with this product
    await Inventory.deleteMany({ product: product._id });

    // Delete the product
    await Product.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Product and associated images deleted successfully",
    });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Bulk update products
// @route   PUT /api/admin/products/bulk
// @access  Private/Admin
exports.bulkUpdateProducts = async (req, res) => {
  try {
    const { productIds, updateData } = req.body;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No products selected",
      });
    }

    // Validate update data
    const allowedUpdates = [
      "status",
      "featured",
      "onSale",
      "isNewArrival",
      "price",
      "stock",
    ];

    const updates = {};
    Object.keys(updateData).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        updates[key] = updateData[key];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields to update",
      });
    }

    // Update products
    const result = await Product.updateMany(
      { _id: { $in: productIds } },
      updates
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} products updated successfully`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Bulk update products error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Get product statistics
// @route   GET /api/admin/products/stats
// @access  Private/Admin
exports.getProductStats = async (req, res) => {
  try {
    const total = await Product.countDocuments();
    const active = await Product.countDocuments({ status: "active" });
    const draft = await Product.countDocuments({ status: "draft" });
    const outOfStock = await Product.countDocuments({ status: "out-of-stock" });
    const featured = await Product.countDocuments({ featured: true });
    const onSale = await Product.countDocuments({ onSale: true });

    // Get total inventory value
    const inventoryValue = await Product.aggregate([
      {
        $group: {
          _id: null,
          totalValue: { $sum: { $multiply: ["$price", "$stock"] } },
          totalCost: { $sum: { $multiply: ["$costPrice", "$stock"] } },
          totalStock: { $sum: "$stock" },
        },
      },
    ]);

    // Get sales data (this would typically come from orders collection)
    const salesData = {
      totalSales: 0,
      totalRevenue: 0,
      bestSellers: [],
    };

    res.json({
      success: true,
      data: {
        total,
        active,
        draft,
        outOfStock,
        featured,
        onSale,
        inventoryValue: inventoryValue[0]?.totalValue || 0,
        totalCost: inventoryValue[0]?.totalCost || 0,
        totalStock: inventoryValue[0]?.totalStock || 0,
        salesData,
      },
    });
  } catch (error) {
    console.error("Get product stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Update product stock
// @route   PUT /api/admin/products/:id/stock
// @access  Private/Admin
exports.updateProductStock = async (req, res) => {
  try {
    const { stock, operation } = req.body; // operation: 'add', 'subtract', 'set'

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    let newStock = product.stock;

    switch (operation) {
      case "add":
        newStock += parseInt(stock);
        break;
      case "subtract":
        newStock = Math.max(0, newStock - parseInt(stock));
        break;
      case "set":
        newStock = parseInt(stock);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: "Invalid operation. Use 'add', 'subtract', or 'set'",
        });
    }

    // Update stock
    product.stock = newStock;

    // Update status if needed
    if (newStock === 0) {
      product.status = "out-of-stock";
    } else if (newStock > 0 && product.status === "out-of-stock") {
      product.status = "active";
    }

    await product.save();

    res.json({
      success: true,
      message: `Stock updated to ${newStock}`,
      stock: newStock,
    });
  } catch (error) {
    console.error("Update product stock error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Upload product images
// @route   POST /api/admin/products/:id/images
// @access  Private/Admin
exports.uploadProductImages = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Assuming images are uploaded via multer and available in req.files
    const images = req.files?.map((file) => file.path) || [];

    // Add new images to product
    product.images = [...product.images, ...images];
    await product.save();

    res.json({
      success: true,
      message: "Images uploaded successfully",
      images: product.images,
    });
  } catch (error) {
    console.error("Upload product images error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
