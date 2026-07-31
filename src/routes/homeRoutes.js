// routes/admin/homeRoutes.js
const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload"); // Import your existing upload
const {
  getHomeSettings,
  updateHomeSettings,
  resetHomeSettings,
} = require("../controllers/homePageController");
const { protect, admin } = require("../middleware/authMiddleware");

// Public route
router.get("/settings", getHomeSettings);

// ✅ FIXED: Admin routes with explicit upload handling
router.put(
  "/settings",
  protect,
  admin,
  upload.fields([
    { name: "heroImage", maxCount: 1 },
    { name: "mysteryImage", maxCount: 1 },
  ]),
  updateHomeSettings
);

router.delete("/settings/reset", protect, admin, resetHomeSettings);

module.exports = router;
