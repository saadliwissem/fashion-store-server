const express = require("express");
const router = express.Router();
const {
  getFragments,
  getFragment,
  createFragment,
  updateFragment,
  deleteFragment,
  bulkUpdateFragments,
  getFragmentStats,
} = require("../controllers/adminFragmentController");
const { protect, admin } = require("../middleware/authMiddleware");
const { validateFragment } = require("../middleware/enigmaValidation");
const handleValidationErrors = require("../middleware/validationErrorHandler");

router.use(protect);
router.use(admin);

router.get("/", getFragments);
router.get("/stats", getFragmentStats);
router.post("/", validateFragment, handleValidationErrors, createFragment);
router.put("/bulk", bulkUpdateFragments);
router.get("/:id", getFragment);
router.put("/:id", validateFragment, handleValidationErrors, updateFragment);
router.delete("/:id", deleteFragment);

module.exports = router;
