const express = require("express");
const router = express.Router();
const {
  joinWaitlist,
  getUserPosition,
  getWaitlistStats,
  leaveWaitlist,
  updatePreferences,
} = require("../controllers/waitlistController");
const { protect } = require("../middleware/authMiddleware");
const {
  validateWaitlist,
  validateIdParam,
} = require("../middleware/enigmaValidation");
const handleValidationErrors = require("../middleware/validationErrorHandler");
const { waitlistLimiter } = require("../middleware/rateLimiter");

router
  .route("/")
  .post(
    waitlistLimiter,
    validateWaitlist,
    handleValidationErrors,
    joinWaitlist
  );

router.get(
  "/position/:chronicleId",
  protect,
  validateIdParam,
  handleValidationErrors,
  getUserPosition
);
router.get(
  "/stats/:chronicleId",
  validateIdParam,
  handleValidationErrors,
  getWaitlistStats
);

router
  .route("/:id")
  .delete(protect, validateIdParam, handleValidationErrors, leaveWaitlist)
  .patch(protect, validateIdParam, handleValidationErrors, updatePreferences);

module.exports = router;
