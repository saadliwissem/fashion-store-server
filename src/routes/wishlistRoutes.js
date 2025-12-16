const express = require("express");
const router = express.Router();
const {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  moveToCart,
  clearWishlist,
} = require("../controllers/wishlistController");
const { protect } = require("../middleware/authMiddleware");

// All routes are protected
router.use(protect);

router.get("/", getWishlist);
router.post("/add", addToWishlist);
router.delete("/:itemId", removeFromWishlist);
router.post("/:itemId/move-to-cart", moveToCart);
router.delete("/clear", clearWishlist);

module.exports = router;
