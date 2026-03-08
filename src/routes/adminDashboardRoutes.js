const express = require("express");
const router = express.Router();
const {
  getDashboardStats,
  getRecentActivity,
  getSalesData,
  getTopChronicles,
  getEnigmaPerformance,
} = require("../controllers/adminDashboardController");
const { protect, admin } = require("../middleware/authMiddleware");

router.use(protect);
router.use(admin);

router.get("/stats", getDashboardStats);
router.get("/recent-activity", getRecentActivity);
router.get("/sales-data", getSalesData);
router.get("/top-chronicles", getTopChronicles);
router.get("/enigma-performance", getEnigmaPerformance);

module.exports = router;
