const express = require("express");
const router = express.Router();
const {
  getFragments,
  getFragment,
  checkAvailability,
  claimFragment,
} = require("../controllers/fragmentController");
const { protect } = require("../middleware/authMiddleware");
const {
  validateFragment,
  validateIdParam,
  validateFragmentQuery,
  validateClaim,
} = require("../middleware/enigmaValidation");
const handleValidationErrors = require("../middleware/validationErrorHandler");
const { claimLimiter } = require("../middleware/rateLimiter");

router
  .route("/")
  .get(validateFragmentQuery, handleValidationErrors, getFragments);

router.route("/:id").get(validateIdParam, handleValidationErrors, getFragment);

router.get(
  "/:id/availability",
  validateIdParam,
  handleValidationErrors,
  checkAvailability
);
router.post(
  "/:id/claim",
  protect,
  claimLimiter,
  validateIdParam,
  validateClaim,
  handleValidationErrors,
  claimFragment
);

module.exports = router;
