// utils/categoryUtils.js
const Category = require("../models/Category");
const Product = require("../models/Product");
const Inventory = require("../models/Inventory");

/**
 * Update category statistics based on its products and their inventory
 */
exports.updateCategoryStats = async (categoryId) => {
  try {
    if (!categoryId) return;

    // Get all products in this category
    const products = await Product.find({
      category: categoryId,
      status: { $ne: "archived" }, // Only count active/draft products
    }).select("_id");

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
          productCount: { $addToSet: "$product" },
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
          totalValue: {
            $sum: { $multiply: ["$currentStock", "$unitCost"] },
          },
        },
      },
    ]);

    // Get product-specific stats
    const productStats = await Product.aggregate([
      {
        $match: {
          category: categoryId,
          status: { $ne: "archived" },
        },
      },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          activeProducts: {
            $sum: {
              $cond: [{ $eq: ["$status", "active"] }, 1, 0],
            },
          },
          draftProducts: {
            $sum: {
              $cond: [{ $eq: ["$status", "draft"] }, 1, 0],
            },
          },
          featuredProducts: {
            $sum: {
              $cond: ["$featured", 1, 0],
            },
          },
          onSaleProducts: {
            $sum: {
              $cond: ["$onSale", 1, 0],
            },
          },
          averagePrice: { $avg: "$price" },
          minPrice: { $min: "$price" },
          maxPrice: { $max: "$price" },
          totalValue: { $sum: "$price" },
        },
      },
    ]);

    const inventoryData = inventoryStats[0] || {};
    const productData = productStats[0] || {};

    // Update category with computed stats
    await Category.findByIdAndUpdate(categoryId, {
      $set: {
        // Product counts
        productCount: productData.totalProducts || 0,
        activeProductCount: productData.activeProducts || 0,
        draftProductCount: productData.draftProducts || 0,
        featuredProductCount: productData.featuredProducts || 0,
        onSaleProductCount: productData.onSaleProducts || 0,

        // Inventory stats
        totalStock: inventoryData.totalStock || 0,
        totalReserved: inventoryData.totalReserved || 0,
        totalAvailable: inventoryData.totalAvailable || 0,
        lowStockCount: inventoryData.lowStockCount || 0,
        outOfStockCount: inventoryData.outOfStockCount || 0,

        // Value stats
        inventoryValue: inventoryData.totalValue || 0,
        productValue: productData.totalValue || 0,

        // Price ranges
        priceRange: {
          min: productData.minPrice || 0,
          max: productData.maxPrice || 0,
          average: productData.averagePrice || 0,
        },

        // Timestamp of last update
        lastStatsUpdate: new Date(),
      },
      $inc: {
        // You can add increment fields if needed
      },
    });

    console.log(`✅ Updated stats for category: ${categoryId}`);
  } catch (error) {
    console.error(`❌ Error updating category stats for ${categoryId}:`, error);
  }
};

/**
 * Update stats for multiple categories (bulk update)
 */
exports.updateMultipleCategoryStats = async (categoryIds) => {
  const uniqueIds = [...new Set(categoryIds.filter((id) => id))];

  await Promise.all(
    uniqueIds.map((categoryId) => exports.updateCategoryStats(categoryId))
  );
};

/**
 * Update all categories (for initial setup or full refresh)
 */
exports.updateAllCategories = async () => {
  try {
    const categories = await Category.find({}).select("_id");
    const categoryIds = categories.map((c) => c._id);

    console.log(`🔄 Updating stats for ${categoryIds.length} categories...`);
    await exports.updateMultipleCategoryStats(categoryIds);
    console.log("✅ All categories updated successfully");
  } catch (error) {
    console.error("❌ Error updating all categories:", error);
  }
};
