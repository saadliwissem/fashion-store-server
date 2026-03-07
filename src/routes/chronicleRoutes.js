const express = require("express");
const router = express.Router();
const {
  getChronicles,
  getChronicle,
  getChronicleFragments,
  getChronicleProgress,
  updateProductionStatus,
  getWaitlistStats,
} = require("../controllers/chronicleController");
const { protect, admin, manager } = require("../middleware/authMiddleware");
const {
  validateChronicle,
  validateIdParam,
  validateProductionStatus,
  validateChronicleQuery,
} = require("../middleware/enigmaValidation");
const handleValidationErrors = require("../middleware/validationErrorHandler");

router
  .route("/")
  .get(validateChronicleQuery, handleValidationErrors, getChronicles);

router.route("/:id").get(validateIdParam, handleValidationErrors, getChronicle);

router.get(
  "/:id/fragments",
  validateIdParam,
  handleValidationErrors,
  getChronicleFragments
);
router.get(
  "/:id/progress",
  validateIdParam,
  handleValidationErrors,
  getChronicleProgress
);
router.get(
  "/:id/waitlist-stats",
  validateIdParam,
  handleValidationErrors,
  getWaitlistStats
);

router.patch(
  "/:id/production-status",
  protect,
  manager,
  validateIdParam,
  validateProductionStatus,
  handleValidationErrors,
  updateProductionStatus
);

module.exports = router;
