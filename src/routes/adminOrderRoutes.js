// routes/admin/orderRoutes.js
const express = require("express");
const router = express.Router();
const {
  getOrders,
  getOrder,
  updateOrderStatus,
  updateOrder,
  deleteOrder,
  bulkUpdateOrders,
  getOrderStats,
  updateTracking,
  updatePaymentStatus,
  getOrdersAnalytics,
  getSalesReport,
  exportOrders,
} = require("../controllers/adminOrderController");
const { protect, admin } = require("../middleware/authMiddleware");

// All routes are protected and admin-only
router.use(protect);
router.use(admin);

router.get("/", getOrders);
router.get("/stats", getOrderStats);
router.get("/analytics", getOrdersAnalytics);
router.get("/sales-report", getSalesReport);
router.get("/export", exportOrders);
router.get("/:id", getOrder);
router.put("/:id/status", updateOrderStatus);
router.put("/:id/tracking", updateTracking);
router.put("/:id/payment", updatePaymentStatus);
router.put("/:id", updateOrder);
router.put("/bulk", bulkUpdateOrders);
router.delete("/:id", deleteOrder);

module.exports = router;
