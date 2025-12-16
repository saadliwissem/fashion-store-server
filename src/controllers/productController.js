const asyncHandler = require("express-async-handler");
const Product = require("../models/Product");
const Category = require("../models/Category");
const Review = require("../models/Review");
const Inventory = require("../models/Inventory");

// @desc    Get all products
// @route   GET /api/products
// @access  Public
const getProducts = asyncHandler(async (req, res) => {
  const pageSize = 12;
  const page = Number(req.query.page) || 1;

  // Build query
  let query = {};
  let sort = { createdAt: -1 };

  // Category filter
  if (req.query.category) {
    const category = await Category.findOne({ slug: req.query.category });
    if (category) {
      query.category = category._id;
    }
  }

  // Search filter
  if (req.query.search) {
    query.$text = { $search: req.query.search };
  }

  // Price filter
  if (req.query.minPrice || req.query.maxPrice) {
    query.price = {};
    if (req.query.minPrice) {
      query.price.$gte = Number(req.query.minPrice);
    }
    if (req.query.maxPrice) {
      query.price.$lte = Number(req.query.maxPrice);
    }
  }

  // Status filter (default to active)
  if (!req.query.status) {
    query.status = "active";
  } else if (req.query.status !== "all") {
    query.status = req.query.status;
  }

  // Featured filter
  if (req.query.featured) {
    query.featured = req.query.featured === "true";
  }

  // On sale filter
  if (req.query.onSale) {
    query.onSale = req.query.onSale === "true";
  }

  // New arrivals filter
  if (req.query.new) {
    query.isNewArrival = true;
  }

  // Sort options
  if (req.query.sort) {
    switch (req.query.sort) {
      case "price-asc":
        sort = { price: 1 };
        break;
      case "price-desc":
        sort = { price: -1 };
        break;
      case "name-asc":
        sort = { name: 1 };
        break;
      case "name-desc":
        sort = { name: -1 };
        break;
      case "rating":
        sort = { averageRating: -1 };
        break;
      case "popular":
        sort = { purchaseCount: -1 };
        break;
      default:
        sort = { createdAt: -1 };
    }
  }

  // Execute query with pagination
  const count = await Product.countDocuments(query);
  const products = await Product.find(query)
    .populate("category", "name slug")
    .sort(sort)
    .limit(pageSize)
    .skip(pageSize * (page - 1))
    .lean();

  // Calculate pagination
  const pages = Math.ceil(count / pageSize);

  res.json({
    success: true,
    products,
    page,
    pages,
    count,
    hasMore: page < pages,
  });
});

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id)
    .populate("category", "name slug")
    .lean();

  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  // Get inventory for this product
  const inventory = await Inventory.find({ product: product._id })
    .select("variant currentStock availableStock status location")
    .lean();

  // Calculate total stock from inventory
  const totalStock = inventory.reduce(
    (sum, item) => sum + item.currentStock,
    0
  );

  // Update product with inventory data
  const productWithInventory = {
    ...product,
    stock: totalStock, // Keep for backward compatibility
    inventory: inventory,
    inventorySummary: {
      totalStock,
      availableStock: inventory.reduce(
        (sum, item) => sum + item.availableStock,
        0
      ),
      inStockCount: inventory.filter((item) => item.status === "in-stock")
        .length,
      lowStockCount: inventory.filter((item) => item.status === "low-stock")
        .length,
      outOfStockCount: inventory.filter(
        (item) => item.status === "out-of-stock"
      ).length,
    },
  };

  // Increment view count
  await Product.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } });

  // Get related products
  const relatedProducts = await Product.find({
    category: product.category,
    _id: { $ne: product._id },
    status: "active",
  })
    .limit(4)
    .select("name price images slug averageRating")
    .lean();

  // Get reviews
  const reviews = await Review.find({ product: product._id })
    .populate("user", "firstName lastName")
    .sort({ createdAt: -1 })
    .lean();

  res.json({
    success: true,
    product: productWithInventory,
    relatedProducts,
    reviews,
  });
});
// @desc    Get inventory for product
// @route   GET /api/inventory/product/:productId
// @access  Public
const getInventoryByProductId = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  const inventory = await Inventory.find({ product: productId })
    .populate({
      path: "product",
      select: "name sku",
    })
    .lean();

  if (!inventory.length) {
    return res.json({
      success: true,
      message: "No inventory found for this product",
      variants: [],
      summary: {
        totalStock: 0,
        availableStock: 0,
        inStockCount: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
      },
    });
  }

  // Transform data
  const variants = inventory.map((item) => ({
    id: item._id,
    color: item.variant?.color || "Default",
    size: item.variant?.size || "One Size",
    currentStock: item.currentStock,
    availableStock: item.availableStock,
    status: item.status,
    location: item.location,
    lowStockThreshold: item.lowStockThreshold,
  }));

  res.json({
    success: true,
    variants,
    summary: {
      totalStock: variants.reduce((sum, v) => sum + v.currentStock, 0),
      availableStock: variants.reduce((sum, v) => sum + v.availableStock, 0),
      inStockCount: variants.filter((v) => v.status === "in-stock").length,
      lowStockCount: variants.filter((v) => v.status === "low-stock").length,
      outOfStockCount: variants.filter((v) => v.status === "out-of-stock")
        .length,
    },
  });
});

// @desc    Get product by slug
// @route   GET /api/products/slug/:slug
// @access  Public
const getProductBySlug = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug })
    .populate("category", "name slug")
    .lean();

  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  // Increment view count
  await Product.findOneAndUpdate(
    { slug: req.params.slug },
    { $inc: { viewCount: 1 } }
  );

  // Get related products
  const relatedProducts = await Product.find({
    category: product.category,
    _id: { $ne: product._id },
    status: "active",
  })
    .limit(4)
    .select("name price images slug averageRating")
    .lean();

  // Get reviews
  const reviews = await Review.find({ product: product._id })
    .populate("user", "firstName lastName")
    .sort({ createdAt: -1 })
    .lean();

  res.json({
    success: true,
    product: {
      ...product,
      relatedProducts,
      reviews,
    },
  });
});

// @desc    Search products
// @route   GET /api/products/search/:keyword
// @access  Public
const searchProducts = asyncHandler(async (req, res) => {
  const keyword = req.params.keyword;

  const products = await Product.find({
    $or: [
      { name: { $regex: keyword, $options: "i" } },
      { description: { $regex: keyword, $options: "i" } },
      { tags: { $regex: keyword, $options: "i" } },
    ],
    status: "active",
  })
    .select("name price images slug averageRating")
    .limit(20)
    .lean();

  res.json({
    success: true,
    products,
  });
});

// @desc    Get featured products
// @route   GET /api/products/featured
// @access  Public
const getFeaturedProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({
    featured: true,
    status: "active",
  })
    .limit(8)
    .select("name price images slug originalPrice averageRating")
    .lean();

  res.json({
    success: true,
    products,
  });
});

// @desc    Get new arrivals
// @route   GET /api/products/new
// @access  Public
const getNewArrivals = asyncHandler(async (req, res) => {
  const products = await Product.find({
    isNewArrival: true,
    status: "active",
  })
    .limit(8)
    .select("name price images slug originalPrice averageRating isNewArrival")
    .sort({ createdAt: -1 })
    .lean();

  res.json({
    success: true,
    products,
  });
});

// @desc    Get products on sale
// @route   GET /api/products/sale
// @access  Public
const getProductsOnSale = asyncHandler(async (req, res) => {
  const products = await Product.find({
    onSale: true,
    status: "active",
  })
    .limit(8)
    .select("name price images slug originalPrice averageRating")
    .lean();

  res.json({
    success: true,
    products,
  });
});

// @desc    Create product review
// @route   POST /api/products/:id/reviews
// @access  Private
const createProductReview = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;

  const product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  // Check if already reviewed
  const alreadyReviewed = await Review.findOne({
    product: req.params.id,
    user: req.user._id,
  });

  if (alreadyReviewed) {
    res.status(400);
    throw new Error("Product already reviewed");
  }

  // Create review
  const review = await Review.create({
    product: req.params.id,
    user: req.user._id,
    rating: Number(rating),
    comment,
    verifiedPurchase: true, // You can add logic to check if user purchased this product
  });

  // Update product rating
  const reviews = await Review.find({ product: req.params.id });
  const averageRating =
    reviews.reduce((acc, item) => item.rating + acc, 0) / reviews.length;

  product.averageRating = parseFloat(averageRating.toFixed(1));
  product.reviewCount = reviews.length;
  await product.save();

  res.status(201).json({
    success: true,
    message: "Review added",
    review,
  });
});

// @desc    Get product filters
// @route   GET /api/products/filters/categories
// @access  Public
const getCategoryFilters = asyncHandler(async (req, res) => {
  const categories = await Category.find({ status: "active" })
    .select("name slug productCount")
    .sort({ displayOrder: 1 })
    .lean();

  // Get price ranges
  const priceStats = await Product.aggregate([
    { $match: { status: "active" } },
    {
      $group: {
        _id: null,
        minPrice: { $min: "$price" },
        maxPrice: { $max: "$price" },
      },
    },
  ]);

  res.json({
    success: true,
    categories,
    priceRange:
      priceStats.length > 0
        ? {
            min: Math.floor(priceStats[0].minPrice / 10) * 10,
            max: Math.ceil(priceStats[0].maxPrice / 10) * 10,
          }
        : { min: 0, max: 1000 },
  });
});

module.exports = {
  getProducts,
  getProductById,
  getProductBySlug,
  searchProducts,
  getFeaturedProducts,
  getNewArrivals,
  getProductsOnSale,
  createProductReview,
  getCategoryFilters,
  getInventoryByProductId,
};
