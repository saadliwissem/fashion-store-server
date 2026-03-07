const express = require("express");
const router = express.Router();
const {
  getEnigmas,
  getEnigma,
  getEnigmaChronicles,
  getGlobalStats,
  createEnigma,
  updateEnigma,
} = require("../controllers/enigmaController");
const { protect, admin, editor } = require("../middleware/authMiddleware");
const {
  validateEnigma,
  validateIdParam,
} = require("../middleware/enigmaValidation");
const handleValidationErrors = require("../middleware/validationErrorHandler");
const { apiLimiter } = require("../middleware/rateLimiter");

// Public routes
router
  .route("/")
  .get(getEnigmas)
  .post(protect, admin, validateEnigma, handleValidationErrors, createEnigma);

router.get("/stats", getGlobalStats);

router
  .route("/:id")
  .get(validateIdParam, handleValidationErrors, getEnigma)
  .put(
    protect,
    admin,
    validateIdParam,
    validateEnigma,
    handleValidationErrors,
    updateEnigma
  );

router.get(
  "/:id/chronicles",
  validateIdParam,
  handleValidationErrors,
  getEnigmaChronicles
);

module.exports = router;
