const express = require("express");
const router = express.Router();
const {
  getKeeperProfile,
  updateKeeperProfile,
  getKeeperCollection,
  getKeeperActivity,
  followKeeper,
  unfollowKeeper,
  getFollowers,
  getFollowing,
} = require("../controllers/keeperController");
const { protect } = require("../middleware/authMiddleware");
const { validateIdParam } = require("../middleware/enigmaValidation");
const handleValidationErrors = require("../middleware/validationErrorHandler");
router.get("/profile/me", protect, getKeeperProfile); // Get current user's profile

router.get(
  "/profile/:userId?",
  validateIdParam,
  handleValidationErrors,
  getKeeperProfile
);
router.put("/profile", protect, updateKeeperProfile);
router.get(
  "/:userId/collection",
  validateIdParam,
  handleValidationErrors,
  getKeeperCollection
);
router.get(
  "/:userId/activity",
  validateIdParam,
  handleValidationErrors,
  getKeeperActivity
);
router.post(
  "/:userId/follow",
  protect,
  validateIdParam,
  handleValidationErrors,
  followKeeper
);
router.delete(
  "/:userId/follow",
  protect,
  validateIdParam,
  handleValidationErrors,
  unfollowKeeper
);
router.get(
  "/:userId/followers",
  validateIdParam,
  handleValidationErrors,
  getFollowers
);
router.get(
  "/:userId/following",
  validateIdParam,
  handleValidationErrors,
  getFollowing
);

module.exports = router;
