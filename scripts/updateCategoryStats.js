// scripts/updateCategoryStats.js
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const Category = require("../src/models/Category");
const Product = require("../src/models/Product");
const Inventory = require("../src/models/Inventory");

// Copy the update functions here to avoid circular dependency
const updateCategoryStats = async (categoryId) => {
  try {
    if (!categoryId) return;

    console.log(`Updating stats for category: ${categoryId}`);

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

        // Flags
        hasLowStock: (inventoryData.lowStockCount || 0) > 0,
        hasOutOfStock: (inventoryData.outOfStockCount || 0) > 0,
        needsAttention:
          (inventoryData.lowStockCount || 0) > 0 ||
          (inventoryData.outOfStockCount || 0) > 0,

        // Timestamps
        lastStatsUpdate: new Date(),
      },
    });

    console.log(`✅ Updated stats for category: ${categoryId}`);

    // If category has parent, update parent stats too
    const category = await Category.findById(categoryId);
    if (category && category.parent) {
      await updateCategoryStats(category.parent);
    }
  } catch (error) {
    console.error(`❌ Error updating category stats for ${categoryId}:`, error);
  }
};

const updateAllCategories = async () => {
  try {
    const categories = await Category.find({}).select("_id");
    console.log(`🔄 Found ${categories.length} categories to update`);

    for (const category of categories) {
      await updateCategoryStats(category._id);
    }

    console.log("✅ All categories updated successfully");
  } catch (error) {
    console.error("❌ Error updating all categories:", error);
    throw error;
  }
};

const run = async () => {
  try {
    // Check if MONGODB_URI is defined
    if (!process.env.MONGODB_URI) {
      console.error("❌ MONGODB_URI is not defined in .env file");
      console.log("Current directory:", __dirname);
      console.log(
        "Please create a .env file with: MONGODB_URI=mongodb://localhost:27017/your_database_name"
      );
      process.exit(1);
    }

    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    await updateAllCategories();

    console.log("✅ Category stats update completed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

run();
