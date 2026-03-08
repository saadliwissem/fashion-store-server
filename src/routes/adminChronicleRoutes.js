const express = require("express");
const router = express.Router();
const {
  getChronicles,
  getChronicle,
  createChronicle,
  updateChronicle,
  deleteChronicle,
  bulkUpdateChronicles,
  getChronicleStats,
  updateProductionStatus,
} = require("../controllers/adminChronicleController");
const { protect, admin } = require("../middleware/authMiddleware");
const {
  validateChronicle,
  validateProductionStatus,
} = require("../middleware/enigmaValidation");
const handleValidationErrors = require("../middleware/validationErrorHandler");

router.use(protect);
router.use(admin);

router.get("/", getChronicles);
router.get("/stats", getChronicleStats);
router.post("/", validateChronicle, handleValidationErrors, createChronicle);
router.put("/bulk", bulkUpdateChronicles);
router.get("/:id", getChronicle);
router.put("/:id", validateChronicle, handleValidationErrors, updateChronicle);
router.delete("/:id", deleteChronicle);
router.put(
  "/:id/production-status",
  validateProductionStatus,
  handleValidationErrors,
  updateProductionStatus
);

module.exports = router;
