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

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
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

  // Create user
  const user = await User.create({
    firstName,
    lastName,
    email,
    password,
    phone,
    newsletter,
    emailVerified: false,
  });

  // Create cart for user
  await Cart.create({ user: user._id });

  // Create wishlist for user
  await Wishlist.create({ user: user._id });

  // Generate token
  const token = generateToken(user._id);

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

  res.status(201).json({
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

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  console.log(email);
  console.log(password);

  // Validate input
  const validation = validateLogin(req.body);
  if (!validation.isValid) {
    res.status(400);
    throw new Error(Object.values(validation.errors).join(", "));
  }

  // Check for user
  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    res.status(401);
    throw new Error("Invalid credentials");
  }

  // Check password
  const isPasswordMatch = await user.matchPassword(password);
  if (!isPasswordMatch) {
    res.status(401);
    throw new Error("Invalid credentials");
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
};
