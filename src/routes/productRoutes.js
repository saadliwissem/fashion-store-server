const express = require("express");
const router = express.Router();
const {
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
} = require("../controllers/productController");
const { protect } = require("../middleware/authMiddleware");

// Public routes
router.get("/", getProducts);
router.get("/search/:keyword", searchProducts);
router.get("/featured", getFeaturedProducts);
router.get("/new", getNewArrivals);
router.get("/sale", getProductsOnSale);
router.get("/filters/categories", getCategoryFilters);
router.get("/:id", getProductById);
router.get("/product/:productId", getInventoryByProductId);
router.get("/slug/:slug", getProductBySlug);

// Protected routes
router.post("/:id/reviews", protect, createProductReview);

module.exports = router;
