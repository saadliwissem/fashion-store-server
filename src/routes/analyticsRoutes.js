const express = require("express");
const router = express.Router();
const {
  getChronicleAnalytics,
  getEnigmaAnalytics,
  getTrending,
} = require("../controllers/analyticsController");
const { validateIdParam } = require("../middleware/enigmaValidation");
const handleValidationErrors = require("../middleware/validationErrorHandler");

router.get(
  "/chronicle/:id",
  validateIdParam,
  handleValidationErrors,
  getChronicleAnalytics
);
router.get(
  "/enigma/:id",
  validateIdParam,
  handleValidationErrors,
  getEnigmaAnalytics
);
router.get("/trending", getTrending);

module.exports = router;
