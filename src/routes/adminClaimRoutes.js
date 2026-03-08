const express = require("express");
const router = express.Router();
const {
  getClaims,
  getClaim,
  updateClaim,
  deleteClaim,
  bulkUpdateClaims,
  getClaimStats,
  exportClaims,
  updateClaimStatus,
  updatePaymentStatus,
  addTracking,
} = require("../controllers/adminClaimController");
const { protect, admin } = require("../middleware/authMiddleware");
const { validateClaim } = require("../middleware/enigmaValidation");
const handleValidationErrors = require("../middleware/validationErrorHandler");

router.use(protect);
router.use(admin);

router.get("/", getClaims);
router.get("/stats", getClaimStats);
router.get("/export", exportClaims);
router.put("/bulk", bulkUpdateClaims);
router.get("/:id", getClaim);
router.put("/:id", validateClaim, handleValidationErrors, updateClaim);
router.delete("/:id", deleteClaim);
router.put("/:id/status", updateClaimStatus);
router.put("/:id/payment", updatePaymentStatus);
router.put("/:id/tracking", addTracking);

module.exports = router;
