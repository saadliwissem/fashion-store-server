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
  verifyEmail,
  resendVerificationCode,
  resendVerificationCodePublic,
  verifyEmailPublic,
  updatePasswordWithVerification,
  sendPasswordChangeVerification,
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
router.post("/resend-verification-code", resendVerificationCodePublic);
router.post("/verify-email", verifyEmailPublic);
// Protected routes
router.post("/verify-email", protect, verifyEmail);
router.post("/resend-verification", protect, resendVerificationCode);
router.get("/profile", protect, getProfile);
router.put("/profile", protect, uploadSingle("avatar"), updateProfile);
router.put("/password", protect, updatePassword);
router.post("/address", protect, addAddress);
router.delete("/address/:id", protect, deleteAddress);
router.post("/logout", protect, logout);
router.post(
  "/send-password-change-code",
  protect,
  sendPasswordChangeVerification
);
router.post(
  "/update-password-with-verification",
  protect,
  updatePasswordWithVerification
);

module.exports = router;
