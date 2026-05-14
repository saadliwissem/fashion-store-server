const asyncHandler = require("express-async-handler");
const crypto = require("crypto");
const User = require("../models/User");
const Cart = require("../models/Cart");
const Wishlist = require("../models/Wishlist");
const { generateToken } = require("../utils/generateToken");
const { sendEmail, emailTemplates } = require("../utils/sendEmail");
const { validateRegister, validateLogin } = require("../utils/validators");
const { OAuth2Client } = require("google-auth-library");
const axios = require("axios");
const KeeperProfile = require("../models/KeeperProfile");
const googleClient = new OAuth2Client({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
});

// @desc    Google OAuth
// @route   POST /api/auth/google
// @access  Public
const googleAuth = asyncHandler(async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    res.status(400);
    throw new Error("Google token is required");
  }

  try {
    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, given_name, family_name, picture } = payload;

    // Check if user exists
    let user = await User.findOne({
      $or: [{ email }, { googleId }],
    });

    if (!user) {
      // Create new user with Google auth
      user = await User.create({
        googleId,
        firstName: given_name || "User",
        lastName: family_name || "",
        email,
        avatar: picture || "",
        password: crypto.randomBytes(16).toString("hex"), // Random password for Google users
        emailVerified: true,
        newsletter: false,
      });

      // Create cart for user
      await Cart.create({ user: user._id });

      // Create wishlist for user
      await Wishlist.create({ user: user._id });

      // Send welcome email for Google signup
      try {
        await sendEmail({
          email: user.email,
          subject: "Welcome to FashionStore Tunisia",
          html: emailTemplates.welcome(user.firstName),
        });
      } catch (emailError) {
        console.error("Failed to send welcome email:", emailError);
      }
    } else {
      // Update existing user with Google ID if not already set
      if (!user.googleId) {
        user.googleId = googleId;
        user.avatar = picture || user.avatar;
        await user.save();
      }
    }

    // Check if user is active
    if (user.status !== "active") {
      res.status(403);
      throw new Error("Account is inactive. Please contact support.");
    }

    // Update last login
    user.lastLogin = Date.now();
    user.loginCount += 1;
    await user.save();

    // Generate token
    const token = generateToken(user._id, user.role);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatar: user.avatar,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(401);
    throw new Error("Invalid Google token");
  }
});
// @desc    Handle Google OAuth callback
// @route   POST /api/auth/google/callback
// @access  Public
const googleCallback = asyncHandler(async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({
      success: false,
      message: "Authorization code is required",
    });
  }

  try {
    // Exchange authorization code for access token
    const tokenResponse = await axios.post(
      "https://oauth2.googleapis.com/token",
      new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${process.env.FRONTEND_URL}/auth/google/callback`,
        grant_type: "authorization_code",
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const { access_token, id_token } = tokenResponse.data;

    // Get user info from Google
    const userInfoResponse = await axios.get(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    const {
      sub: googleId,
      email,
      given_name,
      family_name,
      picture,
    } = userInfoResponse.data;
    console.log(userInfoResponse.data);

    // Check if user exists
    let user = await User.findOne({
      $or: [{ email }, { googleId }],
    });

    if (!user) {
      // Create new user with Google auth
      user = await User.create({
        googleId,
        firstName: given_name || "User",
        lastName: family_name || "",
        email,
        avatar: picture || "",
        password: crypto.randomBytes(16).toString("hex"),
        emailVerified: true,
        newsletter: false,
      });

      // Create cart for user
      await Cart.create({ user: user._id });

      // Create wishlist for user
      await Wishlist.create({ user: user._id });

      // Send welcome email
      try {
        await sendEmail({
          email: user.email,
          subject: "Welcome to FashionStore Tunisia",
          html: emailTemplates.welcome(user.firstName),
        });
      } catch (emailError) {
        console.error("Failed to send welcome email:", emailError);
      }
    } else {
      // Update existing user with Google ID if not already set
      if (!user.googleId) {
        user.googleId = googleId;
        user.avatar = picture || user.avatar;
        await user.save();
      }
    }

    // Check if user is active
    if (user.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Account is inactive. Please contact support.",
      });
    }

    // Update last login
    user.lastLogin = Date.now();
    user.loginCount += 1;
    await user.save();

    // Generate JWT token
    const token = generateToken(user._id, user.role);

    return res.json({
      success: true,
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatar: user.avatar,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    console.error("Google callback error:", error);

    // Check for specific Google OAuth errors
    if (error.response?.data?.error === "invalid_grant") {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired authorization code",
      });
    }

    if (error.response?.status === 429) {
      return res.status(429).json({
        success: false,
        message: "Too many requests. Please try again later",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Google authentication failed",
    });
  }
});
// Helper function to generate verification code
const generateVerificationCode = () => {
  return crypto.randomInt(100000, 999999).toString();
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
// Register user
// controllers/authController.js - Register function

const register = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password, phone, newsletter } = req.body;

  // Validate input
  const validation = validateRegister(req.body);
  if (!validation.isValid) {
    res.status(400);
    throw new Error(Object.values(validation.errors).join(", "));
  }

  // Check if user exists
  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error("User already exists");
  }

  // Generate verification code
  const crypto = require("crypto");
  const verificationCode = crypto.randomInt(100000, 999999).toString();
  const verificationCodeExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

  // Create user with email_not_verified
  const user = await User.create({
    firstName,
    lastName,
    email,
    password,
    phone,
    newsletter: newsletter || false,
    emailVerified: false, // Important: Set to false initially
    verificationCode,
    verificationCodeExpires,
  });

  // Create cart for user
  await Cart.create({ user: user._id });

  // Create wishlist for user
  await Wishlist.create({ user: user._id });

  // Create keeper profile
  await KeeperProfile.create({
    user: user._id,
    stats: {
      fragmentsClaimed: 0,
      chroniclesCompleted: 0,
      mysteriesSolved: 0,
      totalSpent: 0,
      waitlistEntries: 0,
      claimsCount: 0,
      uniqueChronicles: 0,
      reputation: 0,
    },
  });

  try {
    await sendEmail({
      email: user.email,
      subject: "🔐 Verify Your PUZZLE Account",
      html: emailTemplates.welcome(user.firstName, verificationCode),
    });
    console.log("Verification email sent to:", user.email);
  } catch (emailError) {
    console.error("Failed to send verification email:", emailError);
    // Still create user but log error
  }

  // IMPORTANT: Do NOT generate token or set user as logged in
  // Return requiresVerification flag instead
  res.status(201).json({
    success: true,
    requiresVerification: true,
    message: "Please check your email for verification code",
    user: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      emailVerified: false,
    },
    // NO token returned here - user cannot login until verified
  });
});

// Verify email with code
const verifyEmail = asyncHandler(async (req, res) => {
  const { code } = req.body;
  const userId = req.user.id;

  const user = await User.findById(userId);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // Check if already verified
  if (user.emailVerified) {
    return res.status(400).json({
      success: false,
      message: "Email already verified",
    });
  }

  // Check if code matches and not expired
  if (
    user.verificationCode !== code ||
    user.verificationCodeExpires < Date.now()
  ) {
    // Check if code expired
    if (user.verificationCodeExpires < Date.now()) {
      return res.status(400).json({
        success: false,
        message: "Verification code has expired. Please request a new one.",
      });
    }

    return res.status(400).json({
      success: false,
      message: "Invalid verification code",
    });
  }

  // Update user
  user.emailVerified = true;
  user.verificationCode = undefined;
  user.verificationCodeExpires = undefined;
  await user.save();

  // Send confirmation email
  try {
    await sendEmail({
      email: user.email,
      subject: "🎉 Email Verified - Welcome to PUZZLE!",
      html: emailTemplates.emailVerified(user.firstName),
    });
  } catch (emailError) {
    console.error(
      "Failed to send verification confirmation email:",
      emailError
    );
  }

  res.status(200).json({
    success: true,
    message: "Email verified successfully",
    user: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      emailVerified: true,
    },
  });
});
const verifyEmailPublic = asyncHandler(async (req, res) => {
  const { email, code } = req.body;

  // Validate input
  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email is required",
    });
  }

  if (!code || code.length !== 6) {
    return res.status(400).json({
      success: false,
      message: "Valid 6-digit verification code is required",
    });
  }

  // Find user by email
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  // Check if already verified
  if (user.emailVerified) {
    return res.status(400).json({
      success: false,
      message: "Email already verified. Please login.",
    });
  }

  // Check if code matches
  if (user.verificationCode !== code) {
    return res.status(400).json({
      success: false,
      message: "Invalid verification code",
    });
  }

  // Check if code is expired
  if (user.verificationCodeExpires < Date.now()) {
    return res.status(400).json({
      success: false,
      message: "Verification code has expired. Please request a new one.",
    });
  }

  // Update user as verified
  user.emailVerified = true;
  user.verificationCode = undefined;
  user.verificationCodeExpires = undefined;
  await user.save();

  try {
    await sendEmail({
      email: user.email,
      subject: "🎉 Email Verified - Welcome to PUZZLE!",
      html: emailTemplates.emailVerified(user.firstName),
    });
  } catch (emailError) {
    console.error(
      "Failed to send verification confirmation email:",
      emailError
    );
    // Don't fail the request if email fails, user is already verified
  }

  // Generate token for auto-login (optional)

  const token = generateToken(user._id, user.role);

  res.status(200).json({
    success: true,
    message: "Email verified successfully! You can now log in.",
    token,
    user: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      emailVerified: true,
      role: user.role,
    },
  });
});

// Resend verification code
const resendVerificationCode = asyncHandler(async (req, res) => {
  // Get user ID from req.user (added by protect middleware)
  const userId = req.user;
  console.log(userId);

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "User not authenticated",
    });
  }

  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  if (user.emailVerified) {
    return res.status(400).json({
      success: false,
      message: "Email already verified",
    });
  }

  // Generate new verification code
  const crypto = require("crypto");
  const verificationCode = crypto.randomInt(100000, 999999).toString();
  const verificationCodeExpires = Date.now() + 24 * 60 * 60 * 1000;

  user.verificationCode = verificationCode;
  user.verificationCodeExpires = verificationCodeExpires;
  await user.save();

  // Send new verification email
  // const sendEmail = require("../utils/sendEmail");
  // const emailTemplates = require("../utils/emailTemplates");

  try {
    await sendEmail({
      email: user.email,
      subject: "🔐 Your New PUZZLE Verification Code",
      html: emailTemplates.verificationCode(user.firstName, verificationCode),
    });
  } catch (emailError) {
    console.error("Failed to send verification email:", emailError);
    return res.status(500).json({
      success: false,
      message: "Failed to send verification email. Please try again.",
    });
  }

  res.status(200).json({
    success: true,
    message: "Verification code sent to your email",
  });
});
const resendVerificationCodePublic = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email is required",
    });
  }

  const user = await User.findOne({ email });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  if (user.emailVerified) {
    return res.status(400).json({
      success: false,
      message: "Email already verified",
    });
  }

  // Generate new verification code
  const crypto = require("crypto");
  const verificationCode = crypto.randomInt(100000, 999999).toString();
  const verificationCodeExpires = Date.now() + 24 * 60 * 60 * 1000;

  user.verificationCode = verificationCode;
  user.verificationCodeExpires = verificationCodeExpires;
  await user.save();

  // Send new verification email
  // const sendEmail = require("../utils/sendEmail");
  // const emailTemplates = require("../utils/emailTemplates");

  try {
    await sendEmail({
      email: user.email,
      subject: "🔐 Your PUZZLE Verification Code",
      html: emailTemplates.verificationCode(user.firstName, verificationCode),
    });
  } catch (emailError) {
    console.error("Failed to send verification email:", emailError);
    return res.status(500).json({
      success: false,
      message: "Failed to send verification email. Please try again.",
    });
  }

  res.status(200).json({
    success: true,
    message: "Verification code sent to your email",
  });
});
// @desc    Login user
// @route   POST /api/auth/login
// @access  Public

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  console.log("=== LOGIN ATTEMPT ===");
  console.log("Email:", email);
  console.log("Password provided:", password ? "Yes" : "No");

  // Validate input
  const validation = validateLogin(req.body);
  console.log("Validation result:", validation);

  if (!validation.isValid) {
    console.log("Validation failed:", validation.errors);
    res.status(400);
    throw new Error(Object.values(validation.errors).join(", "));
  }

  // Check for user
  console.log("Searching for user with email:", email);
  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    console.log("User not found for email:", email);
    res.status(401);
    throw new Error("Invalid credentials");
  }

  console.log("User found:", {
    id: user._id,
    email: user.email,
    hasPassword: !!user.password,
    emailVerified: user.emailVerified,
    status: user.status,
  });

  // Check password
  console.log("Checking password...");
  const isPasswordMatch = await user.matchPassword(password);
  console.log("Password match result:", isPasswordMatch);

  if (!isPasswordMatch) {
    console.log("Password does not match");
    res.status(401);
    throw new Error("Invalid credentials");
  }

  // Check if user is active
  if (user.status !== "active") {
    console.log("User account is inactive:", user.status);
    res.status(403);
    throw new Error("Account is inactive. Please contact support.");
  }

  // Check if email is verified
  if (!user.emailVerified) {
    console.log("Email not verified for user:", user.email);

    // Generate new verification code if needed
    if (!user.verificationCode || user.verificationCodeExpires < Date.now()) {
      console.log("Generating new verification code...");
      const crypto = require("crypto");
      const verificationCode = crypto.randomInt(100000, 999999).toString();
      const verificationCodeExpires = Date.now() + 24 * 60 * 60 * 1000;

      user.verificationCode = verificationCode;
      user.verificationCodeExpires = verificationCodeExpires;
      await user.save();

      console.log("Verification code generated:", verificationCode);
      console.log("Expires at:", new Date(verificationCodeExpires));

      try {
        await sendEmail({
          email: user.email,
          subject: "🔐 Verify Your PUZZLE Account",
          html: emailTemplates.verificationCode(
            user.firstName,
            verificationCode
          ),
        });
        console.log("Verification email sent successfully");
      } catch (emailError) {
        console.error("Failed to send verification email:", emailError);
      }
    } else {
      console.log(
        "Existing verification code found, expires:",
        new Date(user.verificationCodeExpires)
      );
    }

    // Return response WITHOUT throwing an error
    return res.status(403).json({
      success: false,
      message:
        "Please verify your email address before logging in. A verification code has been sent to your email.",
    });
  }

  console.log("Login successful for user:", user.email);

  // Update last login
  user.lastLogin = Date.now();
  user.loginCount += 1;
  await user.save();

  // Generate token
  const token = generateToken(user._id, user.role);
  console.log("Token generated:", token ? "Yes" : "No");

  res.json({
    success: true,
    token,
    user: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      avatar: user.avatar,
      emailVerified: user.emailVerified,
    },
  });
});

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).populate({
    path: "addresses",
    options: { sort: { isDefault: -1 } },
  });

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // Get cart count
  const cart = await Cart.findOne({ user: user._id });
  const cartCount = cart ? cart.itemsCount : 0;

  // Get wishlist count
  const wishlist = await Wishlist.findOne({ user: user._id });
  const wishlistCount = wishlist ? wishlist.items.length : 0;

  res.json({
    success: true,
    user: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      avatar: user.avatar,
      emailVerified: user.emailVerified,
      addresses: user.addresses,
      orderCount: user.orderCount,
      totalSpent: user.totalSpent,
      cartCount,
      wishlistCount,
      createdAt: user.createdAt,
    },
  });
});

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const {
    firstName,
    lastName,
    phone,
    dateOfBirth,
    newsletter,
    marketingEmails,
  } = req.body;

  // Update fields
  if (firstName) user.firstName = firstName;
  if (lastName) user.lastName = lastName;
  if (phone) user.phone = phone;
  if (dateOfBirth) user.dateOfBirth = dateOfBirth;
  if (newsletter !== undefined) user.newsletter = newsletter;
  if (marketingEmails !== undefined) user.marketingEmails = marketingEmails;

  // Handle avatar upload
  if (req.file) {
    user.avatar = `/uploads/${req.file.filename}`;
  }

  const updatedUser = await user.save();

  res.json({
    success: true,
    user: {
      id: updatedUser._id,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      email: updatedUser.email,
      phone: updatedUser.phone,
      role: updatedUser.role,
      avatar: updatedUser.avatar,
      emailVerified: updatedUser.emailVerified,
    },
  });
});
// controllers/authController.js

// Step 1: Send verification code to user's email
const sendPasswordChangeVerification = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // Generate verification code
  const crypto = require("crypto");
  const verificationCode = crypto.randomInt(100000, 999999).toString();
  const verificationCodeExpires = Date.now() + 15 * 60 * 1000; // 15 minutes expiry

  // Store verification code temporarily (you can add a separate field or reuse)
  user.passwordChangeCode = verificationCode;
  user.passwordChangeCodeExpires = verificationCodeExpires;
  await user.save();

  try {
    await sendEmail({
      email: user.email,
      subject: "🔐 Password Change Verification - PUZZLE",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Password Change Verification</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; margin: 0; padding: 20px; }
            .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; }
            .code { font-size: 40px; font-weight: bold; letter-spacing: 8px; color: #7c3aed; background: #f5f3ff; padding: 20px; border-radius: 12px; margin: 20px 0; }
            .warning { background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px; border-radius: 8px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div style="font-size: 48px;">🧩</div>
            <h2 style="color: #1f2937;">Password Change Request</h2>
            <p>Hello ${user.firstName},</p>
            <p>We received a request to change your password. Use the verification code below to proceed:</p>
            <div class="code">${verificationCode}</div>
            <p>This code will expire in <strong>15 minutes</strong>.</p>
            <div class="warning">
              <p style="color: #991b1b; margin: 0;">⚠️ If you didn't request this, please ignore this email and contact support immediately.</p>
            </div>
            <hr style="margin: 24px 0;">
            <p style="color: #6b7280; font-size: 12px;">PUZZLE - Where Fashion Meets Mystery</p>
          </div>
        </body>
        </html>
      `,
    });
    console.log("Password change verification email sent to:", user.email);
  } catch (emailError) {
    console.error("Failed to send verification email:", emailError);
    res.status(500);
    throw new Error("Failed to send verification email");
  }

  res.json({
    success: true,
    message: "Verification code sent to your email",
  });
});

// Step 2: Verify code and update password
const updatePasswordWithVerification = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select("+password");

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const { currentPassword, newPassword, verificationCode } = req.body;

  // Check current password
  const isPasswordMatch = await user.matchPassword(currentPassword);
  if (!isPasswordMatch) {
    res.status(400);
    throw new Error("Current password is incorrect");
  }

  // Validate verification code
  if (!verificationCode) {
    res.status(400);
    throw new Error("Verification code is required");
  }

  if (user.passwordChangeCode !== verificationCode) {
    res.status(400);
    throw new Error("Invalid verification code");
  }

  if (user.passwordChangeCodeExpires < Date.now()) {
    res.status(400);
    throw new Error("Verification code has expired. Please request a new one.");
  }

  // Validate new password strength
  if (newPassword.length < 8) {
    res.status(400);
    throw new Error("Password must be at least 8 characters");
  }

  if (!/[A-Z]/.test(newPassword)) {
    res.status(400);
    throw new Error("Password must contain at least one uppercase letter");
  }

  if (!/[0-9]/.test(newPassword)) {
    res.status(400);
    throw new Error("Password must contain at least one number");
  }

  if (!/[^A-Za-z0-9]/.test(newPassword)) {
    res.status(400);
    throw new Error("Password must contain at least one special character");
  }

  // Update password
  user.password = newPassword;
  user.passwordChangeCode = undefined;
  user.passwordChangeCodeExpires = undefined;
  await user.save();

  try {
    await sendEmail({
      email: user.email,
      subject: "✅ Password Changed - PUZZLE",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Password Changed</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; margin: 0; padding: 20px; }
            .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; }
            .success { font-size: 64px; margin-bottom: 16px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success">✅</div>
            <h2 style="color: #1f2937;">Password Changed Successfully</h2>
            <p>Hello ${user.firstName},</p>
            <p>Your PUZZLE account password has been changed.</p>
            <p>If you did not make this change, please contact our support team immediately.</p>
            <hr style="margin: 24px 0;">
            <p style="color: #6b7280; font-size: 12px;">PUZZLE - Where Fashion Meets Mystery</p>
          </div>
        </body>
        </html>
      `,
    });
  } catch (emailError) {
    console.error("Failed to send confirmation email:", emailError);
    // Don't throw error, password was already updated
  }

  res.json({
    success: true,
    message: "Password updated successfully",
  });
});
// @desc    Update password
// @route   PUT /api/auth/password
// @access  Private
const updatePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select("+password");

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const { currentPassword, newPassword } = req.body;

  // Check current password
  const isPasswordMatch = await user.matchPassword(currentPassword);
  if (!isPasswordMatch) {
    res.status(400);
    throw new Error("Current password is incorrect");
  }

  // Update password
  user.password = newPassword;
  await user.save();

  res.json({
    success: true,
    message: "Password updated successfully",
  });
});

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    res.status(400);
    throw new Error("Email is required");
  }

  const user = await User.findOne({ email });

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // Generate reset token
  const resetToken = user.generatePasswordResetToken();
  await user.save();

  // Create reset URL
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

  // Send email
  try {
    await sendEmail({
      email: user.email,
      subject: "Password Reset Request - FashionStore Tunisia",
      html: emailTemplates.passwordReset(user.firstName, resetUrl),
    });

    res.json({
      success: true,
      message: "Password reset email sent",
    });
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(500);
    throw new Error("Email could not be sent");
  }
});

// @desc    Reset password
// @route   PUT /api/auth/reset-password/:token
// @access  Public
const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  // Hash token
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  // Find user with valid token
  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!user) {
    res.status(400);
    throw new Error("Invalid or expired token");
  }

  // Set new password
  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  // Generate new token
  const authToken = generateToken(user._id);

  res.json({
    success: true,
    token: authToken,
    message: "Password reset successfully",
  });
});

// @desc    Add/Update address
// @route   POST /api/auth/address
// @access  Private
const addAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const addressData = req.body;

  // Validate address
  if (
    !addressData.firstName ||
    !addressData.lastName ||
    !addressData.phone ||
    !addressData.governorate ||
    !addressData.city ||
    !addressData.address
  ) {
    res.status(400);
    throw new Error("Please fill all required address fields");
  }

  // If this is set as default, unset other defaults
  if (addressData.isDefault) {
    user.addresses.forEach((addr) => {
      addr.isDefault = false;
    });
  }

  // Check if address already exists
  const existingAddressIndex = user.addresses.findIndex(
    (addr) => addr._id.toString() === addressData._id
  );

  if (existingAddressIndex >= 0) {
    // Update existing address
    user.addresses[existingAddressIndex] = {
      ...user.addresses[existingAddressIndex].toObject(),
      ...addressData,
    };
  } else {
    // Add new address
    user.addresses.push(addressData);
  }

  await user.save();

  res.json({
    success: true,
    addresses: user.addresses,
  });
});

// @desc    Delete address
// @route   DELETE /api/auth/address/:id
// @access  Private
const deleteAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const addressId = req.params.id;

  // Remove address
  user.addresses = user.addresses.filter(
    (addr) => addr._id.toString() !== addressId
  );

  await user.save();

  res.json({
    success: true,
    addresses: user.addresses,
  });
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logout = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    message: "Logged out successfully",
  });
});

module.exports = {
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
};
