const Product = require("../models/Product");
const Category = require("../models/Category");
const { validationResult } = require("express-validator");
const Inventory = require("../models/Inventory");

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

    // Execute query with population
    const products = await Product.find(query)
      .populate("category", "name slug")
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get total count for pagination
    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      count: products.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      products,
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

    // Create product
    const product = new Product(req.body);
    await product.save();

    // Create inventory records
    if (variants.length > 0) {
      const inventoryPromises = variants.map((variant, index) => {
        // Generate location code (e.g., A1-01, A1-02, etc.)
        const row = String.fromCharCode(65 + Math.floor(index / 10)); // A, B, C, etc.
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
      // For products without variants
      await Inventory.create({
        product: product._id,
        currentStock: 0, // Start with 0 stock
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

    // Update product
    product = await Product.findByIdAndUpdate(req.params.id, req.body, {
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

    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Product with this SKU or slug already exists",
      });
    }

    // Handle validation errors
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

    // Check if product has any orders (optional - you might want to check this)
    // const orderCount = await Order.countDocuments({ 'items.product': req.params.id });
    // if (orderCount > 0) {
    //   return res.status(400).json({
    //     success: false,
    //     message: `Cannot delete product with ${orderCount} orders`,
    //   });
    // }

    // Delete the product
    await Product.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Product deleted successfully",
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
