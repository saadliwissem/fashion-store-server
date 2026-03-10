const asyncHandler = require("express-async-handler");
const Category = require("../models/Category");
const Product = require("../models/Product");
const Inventory = require("../models/Inventory");

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Update category statistics based on its products and their inventory
 */
const updateCategoryStats = async (categoryId) => {
  try {
    if (!categoryId) return;

    // Get all products in this category
    const products = await Product.find({
      category: categoryId,
    }).select(
      "_id price costPrice status featured onSale isNewArrival averageRating viewCount purchaseCount variants"
    );

    const productIds = products.map((p) => p._id);

    // Get inventory stats for all products in this category
    const inventoryStats = await Inventory.aggregate([
      {
        $match: {
          product: { $in: productIds },
        },
      },
      {
        $group: {
          _id: null,
          totalStock: { $sum: "$currentStock" },
          totalReserved: { $sum: "$reservedStock" },
          totalAvailable: { $sum: "$availableStock" },
          inStockCount: {
            $sum: {
              $cond: [{ $gt: ["$currentStock", 0] }, 1, 0],
            },
          },
          lowStockCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: ["$currentStock", 0] },
                    { $lte: ["$currentStock", "$lowStockThreshold"] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          outOfStockCount: {
            $sum: {
              $cond: [{ $eq: ["$currentStock", 0] }, 1, 0],
            },
          },
          discontinuedCount: {
            $sum: {
              $cond: [{ $eq: ["$status", "discontinued"] }, 1, 0],
            },
          },
          totalInventoryValue: {
            $sum: { $multiply: ["$currentStock", "$unitCost"] },
          },
          totalCost: {
            $sum: { $multiply: ["$currentStock", "$unitCost"] },
          },
          totalVariants: { $sum: 1 },
          warehouseDistribution: {
            $push: {
              warehouse: "$warehouse",
              stock: "$currentStock",
            },
          },
          locations: {
            $push: {
              warehouse: "$warehouse",
              location: "$location",
              stock: "$currentStock",
            },
          },
        },
      },
    ]);

    // Calculate product stats
    const productStats = {
      totalProducts: products.length,
      activeProducts: products.filter((p) => p.status === "active").length,
      draftProducts: products.filter((p) => p.status === "draft").length,
      archivedProducts: products.filter((p) => p.status === "archived").length,
      featuredProducts: products.filter((p) => p.featured).length,
      onSaleProducts: products.filter((p) => p.onSale).length,
      newArrivals: products.filter((p) => p.isNewArrival).length,
      productsWithVariants: products.filter(
        (p) => p.variants && p.variants.length > 0
      ).length,
      totalViews: products.reduce((sum, p) => sum + (p.viewCount || 0), 0),
      totalPurchases: products.reduce(
        (sum, p) => sum + (p.purchaseCount || 0),
        0
      ),
      totalProductValue: products.reduce((sum, p) => sum + (p.price || 0), 0),
      averageRating:
        products.length > 0
          ? products.reduce((sum, p) => sum + (p.averageRating || 0), 0) /
            products.length
          : 0,
      priceRange: {
        min:
          products.length > 0 ? Math.min(...products.map((p) => p.price)) : 0,
        max:
          products.length > 0 ? Math.max(...products.map((p) => p.price)) : 0,
        average:
          products.length > 0
            ? products.reduce((sum, p) => sum + p.price, 0) / products.length
            : 0,
      },
    };

    // Calculate revenue and profit
    const totalRevenue = products.reduce(
      (sum, p) => sum + (p.purchaseCount || 0) * p.price,
      0
    );

    const totalProfit = products.reduce(
      (sum, p) => sum + (p.purchaseCount || 0) * (p.price - (p.costPrice || 0)),
      0
    );

    const inventoryData = inventoryStats[0] || {};

    // Calculate profit margin
    const averageProfitMargin =
      totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    // Aggregate warehouse distribution
    const warehouseMap = {};
    if (inventoryData.warehouseDistribution) {
      inventoryData.warehouseDistribution.forEach((item) => {
        warehouseMap[item.warehouse] =
          (warehouseMap[item.warehouse] || 0) + item.stock;
      });
    }

    // Update category with all computed stats
    await Category.findByIdAndUpdate(categoryId, {
      $set: {
        // Basic counts
        productCount: productStats.totalProducts,
        activeProductCount: productStats.activeProducts,
        draftProductCount: productStats.draftProducts,
        archivedProductCount: productStats.archivedProducts,

        // Feature counts
        featuredProductCount: productStats.featuredProducts,
        onSaleProductCount: productStats.onSaleProducts,
        newArrivalCount: productStats.newArrivals,

        // Inventory stats
        totalStock: inventoryData.totalStock || 0,
        totalReserved: inventoryData.totalReserved || 0,
        totalAvailable: inventoryData.totalAvailable || 0,

        // Stock status counts
        inStockCount: inventoryData.inStockCount || 0,
        lowStockCount: inventoryData.lowStockCount || 0,
        outOfStockCount: inventoryData.outOfStockCount || 0,
        discontinuedCount: inventoryData.discontinuedCount || 0,

        // Value stats
        inventoryValue: inventoryData.totalInventoryValue || 0,
        productValue: productStats.totalProductValue || 0,
        totalCost: inventoryData.totalCost || 0,
        potentialProfit:
          productStats.totalProductValue - (inventoryData.totalCost || 0) || 0,
        averageProfitMargin: averageProfitMargin,

        // Price range
        priceRange: {
          min: productStats.priceRange.min,
          max: productStats.priceRange.max,
          average: productStats.priceRange.average,
        },

        // Variants stats
        totalVariants: inventoryData.totalVariants || 0,
        productsWithVariants: productStats.productsWithVariants,

        // Performance metrics
        totalViews: productStats.totalViews,
        totalPurchases: productStats.totalPurchases,
        totalRevenue: totalRevenue,
        averageRating: productStats.averageRating,
        totalReviews: 0, // You can add review count if you have reviews model

        // Warehouse distribution
        warehouseDistribution: warehouseMap,
        locations: inventoryData.locations || [],

        // Flags
        hasLowStock: (inventoryData.lowStockCount || 0) > 0,
        hasOutOfStock: (inventoryData.outOfStockCount || 0) > 0,
        needsAttention:
          (inventoryData.lowStockCount || 0) > 0 ||
          (inventoryData.outOfStockCount || 0) > 0,

        // Timestamps
        lastStatsUpdate: new Date(),
        ...(productStats.totalPurchases > 0 && { lastProductSold: new Date() }),
        ...(inventoryData.lastRestocked && {
          lastRestockDate: inventoryData.lastRestocked,
        }),
      },
    });

    // If category has parent, update parent stats too
    const category = await Category.findById(categoryId);
    if (category && category.parent) {
      await updateCategoryStats(category.parent);
    }
  } catch (error) {
    console.error(`Error updating category stats for ${categoryId}:`, error);
  }
};

/**
 * Update stats for multiple categories
 */
const updateMultipleCategoryStats = async (categoryIds) => {
  const uniqueIds = [...new Set(categoryIds.filter((id) => id))];
  await Promise.all(
    uniqueIds.map((categoryId) => updateCategoryStats(categoryId))
  );
};

// ============================================
// CONTROLLER FUNCTIONS
// ============================================

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
const getCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({ status: "active" })
    .select(
      "name slug description image parent featured productCount activeProductCount totalStock lowStockCount outOfStockCount priceRange averageRating"
    )
    .sort({ displayOrder: 1, name: 1 })
    .lean();

  // Build category tree
  const buildTree = (categories, parentId = null) => {
    const tree = [];

    categories
      .filter((category) => {
        if (parentId === null) {
          return !category.parent;
        }
        return category.parent && category.parent.toString() === parentId;
      })
      .forEach((category) => {
        const children = buildTree(categories, category._id.toString());
        if (children.length) {
          category.children = children;
        }
        tree.push(category);
      });

    return tree;
  };

  const categoryTree = buildTree(categories);

  res.json({
    success: true,
    categories: categoryTree,
  });
});

// @desc    Get category by slug
// @route   GET /api/categories/:slug
// @access  Public
const getCategoryBySlug = asyncHandler(async (req, res) => {
  const category = await Category.findOne({
    slug: req.params.slug,
    status: "active",
  }).lean();

  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }

  // Update view count
  await Category.findByIdAndUpdate(category._id, {
    $inc: { viewCount: 1 },
  });

  // Get category products with pagination
  const pageSize = 12;
  const page = Number(req.query.page) || 1;

  // Get all subcategories recursively
  const getAllSubcategories = async (categoryId) => {
    const subcategories = await Category.find({ parent: categoryId })
      .select("_id")
      .lean();

    let categoryIds = [categoryId];

    for (const sub of subcategories) {
      const subIds = await getAllSubcategories(sub._id);
      categoryIds = [...categoryIds, ...subIds];
    }

    return categoryIds;
  };

  const categoryIds = await getAllSubcategories(category._id);

  // Build query
  let query = {
    category: { $in: categoryIds },
    status: "active",
  };

  // Sort options
  let sort = { createdAt: -1 };
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

  // Execute query
  const count = await Product.countDocuments(query);
  const products = await Product.find(query)
    .select("name price images slug originalPrice averageRating")
    .sort(sort)
    .limit(pageSize)
    .skip(pageSize * (page - 1))
    .lean();

  // Calculate pagination
  const pages = Math.ceil(count / pageSize);

  // Get subcategories with their stats
  const subcategories = await Category.find({
    parent: category._id,
    status: "active",
  })
    .select(
      "name slug image productCount activeProductCount totalStock priceRange averageRating"
    )
    .sort({ displayOrder: 1 })
    .lean();

  res.json({
    success: true,
    category: {
      ...category,
      subcategories,
      products,
      page,
      pages,
      count,
      hasMore: page < pages,
    },
  });
});

// @desc    Get featured categories
// @route   GET /api/categories/featured
// @access  Public
const getFeaturedCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({
    featured: true,
    status: "active",
    parent: null, // Only top-level categories
  })
    .select(
      "name slug image description productCount activeProductCount totalStock priceRange"
    )
    .limit(6)
    .sort({ displayOrder: 1 })
    .lean();

  res.json({
    success: true,
    categories,
  });
});

// @desc    Get category breadcrumbs
// @route   GET /api/categories/:slug/breadcrumbs
// @access  Public
const getCategoryBreadcrumbs = asyncHandler(async (req, res) => {
  const category = await Category.findOne({ slug: req.params.slug });

  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }

  // Build breadcrumbs
  const breadcrumbs = [];
  let currentCategory = category;

  while (currentCategory) {
    breadcrumbs.unshift({
      name: currentCategory.name,
      slug: currentCategory.slug,
    });

    if (currentCategory.parent) {
      currentCategory = await Category.findById(currentCategory.parent);
    } else {
      currentCategory = null;
    }
  }

  // Add home as first breadcrumb
  breadcrumbs.unshift({
    name: "Home",
    slug: "",
  });

  res.json({
    success: true,
    breadcrumbs,
  });
});

// @desc    Get category stats (for admin)
// @route   GET /api/categories/:id/stats
// @access  Private/Admin
const getCategoryStats = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id)
    .select(
      "productCount activeProductCount totalStock lowStockCount outOfStockCount inventoryValue totalRevenue averageRating priceRange lastStatsUpdate"
    )
    .lean();

  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }

  res.json({
    success: true,
    stats: category,
  });
});

// @desc    Manually refresh category stats
// @route   POST /api/categories/:id/refresh-stats
// @access  Private/Admin
const refreshCategoryStats = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);

  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }

  await updateCategoryStats(category._id);

  const updatedCategory = await Category.findById(category._id)
    .select(
      "productCount activeProductCount totalStock lowStockCount outOfStockCount inventoryValue totalRevenue lastStatsUpdate"
    )
    .lean();

  res.json({
    success: true,
    message: "Category stats refreshed successfully",
    stats: updatedCategory,
  });
});

// @desc    Get categories needing attention
// @route   GET /api/categories/needing-attention
// @access  Private/Admin
const getNeedingAttention = asyncHandler(async (req, res) => {
  const categories = await Category.find({
    needsAttention: true,
    status: "active",
  })
    .select("name slug productCount lowStockCount outOfStockCount")
    .sort({ lowStockCount: -1, outOfStockCount: -1 })
    .limit(10)
    .lean();

  res.json({
    success: true,
    categories,
  });
});

// @desc    Get category performance summary
// @route   GET /api/categories/summary
// @access  Private/Admin
const getCategorySummary = asyncHandler(async (req, res) => {
  const summary = await Category.aggregate([
    {
      $group: {
        _id: null,
        totalCategories: { $sum: 1 },
        activeCategories: {
          $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
        },
        totalProducts: { $sum: "$productCount" },
        totalStock: { $sum: "$totalStock" },
        totalInventoryValue: { $sum: "$inventoryValue" },
        totalRevenue: { $sum: "$totalRevenue" },
        categoriesWithLowStock: {
          $sum: { $cond: [{ $gt: ["$lowStockCount", 0] }, 1, 0] },
        },
        categoriesWithOutOfStock: {
          $sum: { $cond: [{ $gt: ["$outOfStockCount", 0] }, 1, 0] },
        },
      },
    },
  ]);

  res.json({
    success: true,
    summary: summary[0] || {
      totalCategories: 0,
      activeCategories: 0,
      totalProducts: 0,
      totalStock: 0,
      totalInventoryValue: 0,
      totalRevenue: 0,
      categoriesWithLowStock: 0,
      categoriesWithOutOfStock: 0,
    },
  });
});

module.exports = {
  getCategories,
  getCategoryBySlug,
  getFeaturedCategories,
  getCategoryBreadcrumbs,
  getCategoryStats,
  refreshCategoryStats,
  getNeedingAttention,
  getCategorySummary,
  // Export helpers for use in other controllers
  updateCategoryStats,
  updateMultipleCategoryStats,
};
