const express = require("express");
const router = express.Router();
const {
  register,
  login,
  getProfile,
  updateProfile,
  updatePassword,
  forgotPassword,
  resetPassword,
  addAddress,
  deleteAddress,
  logout,
  googleAuth,
  googleCallback,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const { uploadSingle } = require("../middleware/uploadMiddleware");

// Public routes
router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.put("/reset-password/:token", resetPassword);
router.post("/google/callback", googleCallback);
router.post("/google", googleAuth);
// Protected routes
router.get("/profile", protect, getProfile);
router.put("/profile", protect, uploadSingle("avatar"), updateProfile);
router.put("/password", protect, updatePassword);
router.post("/address", protect, addAddress);
router.delete("/address/:id", protect, deleteAddress);
router.post("/logout", protect, logout);

module.exports = router;
