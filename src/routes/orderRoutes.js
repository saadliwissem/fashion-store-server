const express = require("express");
const router = express.Router();
const {
  createOrder,
  getMyOrders,
  getOrderById,
  updateOrderToPaid,
  cancelOrder,
  getOrderTracking,
} = require("../controllers/orderController");
const { protect } = require("../middleware/authMiddleware");

// All routes are protected
router.use(protect);

router.post("/", createOrder);
router.get("/", getMyOrders);
router.get("/:id", getOrderById);
router.put("/:id/pay", updateOrderToPaid);
router.put("/:id/cancel", cancelOrder);
router.get("/:id/tracking", getOrderTracking);

module.exports = router;
