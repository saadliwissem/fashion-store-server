const express = require("express");
const router = express.Router();
const {
  getDashboardStats,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  getOrders,
  updateOrderStatus,
  getAnalytics,
} = require("../controllers/adminController");
const { protect, admin } = require("../middleware/authMiddleware");

// All admin routes are protected and require admin role
router.use(protect);
router.use(admin);

// Dashboard
router.get("/dashboard", getDashboardStats);

// Users
router.get("/users", getUsers);
router.get("/users/:id", getUserById);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);

// Orders
router.get("/orders", getOrders);
router.put("/orders/:id/status", updateOrderStatus);

// Analytics
router.get("/analytics/:type", getAnalytics);

module.exports = router;
