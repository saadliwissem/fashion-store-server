const express = require("express");
const router = express.Router();
const {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  applyCoupon,
} = require("../controllers/cartController");
const { protect } = require("../middleware/authMiddleware");

// All routes are protected
router.use(protect);

router.get("/", getCart);
router.post("/add", addToCart);
router.put("/:itemId", updateCartItem);
router.delete("/clear", clearCart);
router.delete("/:itemId", removeCartItem);
router.post("/coupon", applyCoupon);

module.exports = router;
