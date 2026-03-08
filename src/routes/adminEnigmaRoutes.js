const express = require("express");
const router = express.Router();
const {
  getEnigmas,
  getEnigma,
  createEnigma,
  updateEnigma,
  deleteEnigma,
  bulkUpdateEnigmas,
  getEnigmaStats,
  exportEnigmas,
  updateEnigmasOrder,
} = require("../controllers/adminEnigmaController");
const { protect, admin } = require("../middleware/authMiddleware");
const { validateEnigma } = require("../middleware/enigmaValidation");
const handleValidationErrors = require("../middleware/validationErrorHandler");

// All routes are protected and admin-only
router.use(protect);
router.use(admin);

router.get("/", getEnigmas);
router.get("/stats", getEnigmaStats);
router.get("/export", exportEnigmas);
router.post("/", validateEnigma, handleValidationErrors, createEnigma);
router.put("/bulk", bulkUpdateEnigmas);
router.put("/order", updateEnigmasOrder);
router.get("/:id", getEnigma);
router.put("/:id", validateEnigma, handleValidationErrors, updateEnigma);
router.delete("/:id", deleteEnigma);

module.exports = router;
