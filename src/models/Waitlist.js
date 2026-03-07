const mongoose = require("mongoose");

const waitlistSchema = new mongoose.Schema(
  {
    chronicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chronicle",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
    },
    position: {
      type: Number,
      required: true,
    },
    preferences: {
      notifyOnAvailable: {
        type: Boolean,
        default: true,
      },
      notifyOnNewChronicle: {
        type: Boolean,
        default: false,
      },
      notificationMethods: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
      },
    },
    status: {
      type: String,
      enum: ["active", "notified", "fulfilled", "expired", "cancelled"],
      default: "active",
    },
    notifiedAt: Date,
    fulfilledAt: Date,
    expiresAt: Date,
    source: {
      type: String,
      enum: ["organic", "referral", "campaign"],
      default: "organic",
    },
    metadata: {
      userAgent: String,
      ipAddress: String,
      referrer: String,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure unique active entries per chronicle/email
waitlistSchema.index(
  { chronicle: 1, email: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "active" } }
);

// Update chronicle waitlist count
waitlistSchema.post("save", async function () {
  if (this.status === "active") {
    const count = await this.constructor.countDocuments({
      chronicle: this.chronicle,
      status: "active",
    });
    await mongoose.model("Chronicle").findByIdAndUpdate(this.chronicle, {
      "waitlist.currentCount": count,
    });
  }
});

// Auto-set position
waitlistSchema.pre("save", async function (next) {
  if (this.isNew) {
    const lastEntry = await this.constructor
      .findOne({
        chronicle: this.chronicle,
        status: "active",
      })
      .sort("-position");

    this.position = lastEntry ? lastEntry.position + 1 : 1;
  }
  next();
});

module.exports = mongoose.model("Waitlist", waitlistSchema);
