const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "Coupon code is required"],
      unique: true,
      uppercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, "Coupon name is required"],
    },

    // Discount Type
    discountType: {
      type: String,
      enum: ["percentage", "fixed", "free_shipping"],
      required: true,
    },
    discountValue: {
      type: Number,
      required: [true, "Discount value is required"],
      min: [0, "Discount value must be positive"],
    },
    minimumPurchase: {
      type: Number,
      min: [0, "Minimum purchase must be positive"],
    },
    maximumDiscount: Number,

    // Usage Limits
    usageLimit: Number,
    usageLimitPerUser: Number,
    usedCount: {
      type: Number,
      default: 0,
    },

    // Validity
    validFrom: {
      type: Date,
      default: Date.now,
    },
    validUntil: Date,
    isActive: {
      type: Boolean,
      default: true,
    },

    // Applicability
    appliesTo: {
      type: String,
      enum: ["all", "categories", "products", "users"],
      default: "all",
    },
    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    users: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Restrictions
    oneTimeUse: {
      type: Boolean,
      default: false,
    },
    excludeSaleItems: {
      type: Boolean,
      default: false,
    },

    // Stats
    totalDiscountGiven: {
      type: Number,
      default: 0,
    },
    revenueGenerated: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Method to check if coupon is valid
couponSchema.methods.isValid = function () {
  const now = new Date();

  // Check if active
  if (!this.isActive) return false;

  // Check validity dates
  if (this.validFrom && now < this.validFrom) return false;
  if (this.validUntil && now > this.validUntil) return false;

  // Check usage limit
  if (this.usageLimit && this.usedCount >= this.usageLimit) return false;

  return true;
};

couponSchema.index({ isActive: 1, validUntil: 1 }); // Compound index for active coupons

const Coupon = mongoose.model("Coupon", couponSchema);

module.exports = Coupon;
