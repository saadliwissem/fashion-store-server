const express = require("express");
const router = express.Router();
const {
  getWaitlistEntries,
  getWaitlistEntry,
  updateWaitlistEntry,
  deleteWaitlistEntry,
  bulkUpdateWaitlist,
  getWaitlistStats,
  notifyWaitlist,
  clearWaitlist,
} = require("../controllers/adminWaitlistController");
const { protect, admin } = require("../middleware/authMiddleware");
const handleValidationErrors = require("../middleware/validationErrorHandler");

router.use(protect);
router.use(admin);

router.get("/", getWaitlistEntries);
router.get("/stats", getWaitlistStats);
router.post("/notify", notifyWaitlist);
router.post("/clear/:chronicleId", clearWaitlist);
router.get("/:id", getWaitlistEntry);
router.put("/:id", updateWaitlistEntry);
router.delete("/:id", deleteWaitlistEntry);
router.put("/bulk", bulkUpdateWaitlist);

module.exports = router;
