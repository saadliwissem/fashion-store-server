const express = require("express");
const router = express.Router();
const {
  createClaim,
  getUserClaims,
  getClaim,
  updateClaimStatus,
} = require("../controllers/claimController");
const { protect, admin, manager } = require("../middleware/authMiddleware");
const {
  validateClaim,
  validateIdParam,
} = require("../middleware/enigmaValidation");
const handleValidationErrors = require("../middleware/validationErrorHandler");
const { claimLimiter } = require("../middleware/rateLimiter");

router
  .route("/")
  .post(
    protect,
    claimLimiter,
    validateClaim,
    handleValidationErrors,
    createClaim
  );

router.get("/user", protect, getUserClaims);

router
  .route("/:id")
  .get(protect, validateIdParam, handleValidationErrors, getClaim);

router.patch(
  "/:id/status",
  protect,
  manager,
  validateIdParam,
  handleValidationErrors,
  updateClaimStatus
);

module.exports = router;
