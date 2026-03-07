const mongoose = require("mongoose");

const claimSchema = new mongoose.Schema(
  {
    claimId: {
      type: String,
      required: true,
      unique: true,
    },
    fragment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Fragment",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userData: {
      fullName: {
        type: String,
        required: true,
      },
      email: {
        type: String,
        required: true,
        lowercase: true,
      },
      phone: String,
      shippingAddress: {
        address: String,
        city: String,
        state: String,
        postalCode: String,
        country: String,
      },
      size: {
        type: String,
        enum: ["small", "medium", "large", "custom"],
      },
      customization: String,
      acceptTerms: Boolean,
      acceptUpdates: Boolean,
    },
    payment: {
      method: {
        type: String,
        enum: ["stripe", "paypal", "crypto"],
        required: true,
      },
      transactionId: String,
      amount: {
        type: Number,
        required: true,
      },
      currency: {
        type: String,
        default: "USD",
      },
      status: {
        type: String,
        enum: ["pending", "completed", "failed", "refunded"],
        default: "pending",
      },
      paidAt: Date,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      default: "pending",
    },
    trackingInfo: {
      carrier: String,
      trackingNumber: String,
      estimatedDelivery: Date,
      shippedAt: Date,
      deliveredAt: Date,
    },
    notes: String,
    adminNotes: [
      {
        text: String,
        addedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Generate claim ID before saving
claimSchema.pre("save", async function (next) {
  if (!this.claimId) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const count = await this.constructor.countDocuments();
    this.claimId = `CLM-${year}${month}-${(count + 1)
      .toString()
      .padStart(6, "0")}`;
  }
  next();
});

// Update fragment status when claim is confirmed
claimSchema.post("save", async function () {
  if (this.status === "confirmed" && this.isModified("status")) {
    await mongoose.model("Fragment").findByIdAndUpdate(this.fragment, {
      status: "claimed",
      claimedBy: this.user,
      claimedAt: new Date(),
    });
  }
});

module.exports = mongoose.model("Claim", claimSchema);
