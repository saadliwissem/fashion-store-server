const mongoose = require("mongoose");

const fragmentSchema = new mongoose.Schema(
  {
    chronicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chronicle",
      required: [true, "Parent chronicle is required"],
    },
    number: {
      type: Number,
      required: [true, "Fragment number is required"],
    },
    name: {
      type: String,
      required: [true, "Fragment name is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    status: {
      type: String,
      enum: ["available", "claimed", "reserved"],
      default: "available",
    },
    claimedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    claimedAt: Date,
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    rarity: {
      type: String,
      enum: ["common", "rare", "legendary"],
      default: "common",
    },
    imageUrl: {
      url: String,
      publicId: String,
      alt: String,
    },
    features: [
      {
        type: String,
      },
    ],
    clues: {
      revealed: {
        type: Number,
        default: 0,
      },
      total: {
        type: Number,
        default: 3,
      },
      list: [
        {
          text: String,
          revealedAt: Date,
          revealedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
        },
      ],
    },
    estimatedDelivery: {
      type: String,
      default: "TBD",
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    metadata: {
      viewCount: {
        type: Number,
        default: 0,
      },
      saveCount: {
        type: Number,
        default: 0,
      },
    },
    dimensions: {
      weight: Number,
      width: Number,
      height: Number,
      depth: Number,
    },
    materials: [String],

    // ========== NEW FIELDS FOR PRODUCTION & SALES TRACKING ==========

    // Track all sales/purchases of this fragment
    soldAt: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        size: {
          type: String,
          enum: ["XS", "S", "M", "L", "XL", "XXL"],
          required: true,
        },
        gender: {
          type: String,
          enum: ["Male", "Female", "Unisex"],
        },
        shippingAddress: {
          address: String,
          city: String,
          state: String,
          postalCode: String,
          country: { type: String, default: "TN" },
        },
        customization: String,
        specialRequests: String,
        purchasedAt: {
          type: Date,
          default: Date.now,
        },
        transactionId: String,
        claimId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Claim",
        },
      },
    ],

    // Current count of sold fragments
    currentSoldCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Total fragments needed to start production (total supply)
    totalSupply: {
      type: Number,
      default: 1,
      min: 1,
    },

    // Required fragments to start manufacturing (could be same as totalSupply)
    requiredFragmentsToStart: {
      type: Number,
      default: 1,
      min: 1,
    },

    // Production status tracking
    productionStatus: {
      type: String,
      enum: [
        "awaiting_sale",
        "partial_sold",
        "fully_sold",
        "manufacturing",
        "quality_check",
        "shipping",
        "delivered",
      ],
      default: "awaiting_sale",
    },

    // When the fragment is reserved, when does the reservation expire
    reservedUntil: {
      type: Date,
    },

    // Flag indicating if production is ready to start
    productionReady: {
      type: Boolean,
      default: false,
    },

    // Manufacturing details
    manufacturing: {
      startedAt: Date,
      completedAt: Date,
      estimatedCompletion: Date,
      batchNumber: String,
      supplier: String,
      notes: String,
    },

    // Shipping tracking
    shipping: {
      trackingNumber: String,
      carrier: String,
      shippedAt: Date,
      estimatedDelivery: Date,
      deliveredAt: Date,
    },

    // Puzzle collaboration room
    collaborationRoom: {
      enabled: {
        type: Boolean,
        default: false,
      },
      roomId: String,
      createdAt: Date,
      activeMembers: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
    },

    // Owner visibility preference
    showOwnersPublicly: {
      type: Boolean,
      default: true,
    },

    // Notifications log
    notifications: [
      {
        type: {
          type: String,
          enum: [
            "fragment_purchased",
            "production_started",
            "production_completed",
            "shipped",
            "delivered",
            "fragment_fully_sold",
          ],
        },
        message: String,
        sentAt: {
          type: Date,
          default: Date.now,
        },
        readBy: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
        ],
      },
    ],

    // Waitlist for when fragment is sold out
    waitlist: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        email: String,
        addedAt: {
          type: Date,
          default: Date.now,
        },
        notified: {
          type: Boolean,
          default: false,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Ensure unique fragment numbers within a chronicle
fragmentSchema.index({ chronicle: 1, number: 1 }, { unique: true });

// Index for efficient queries
fragmentSchema.index({ status: 1, productionStatus: 1 });
fragmentSchema.index({ chronicle: 1, status: 1 });
fragmentSchema.index({ currentSoldCount: -1 });
fragmentSchema.index({ "collaborationRoom.roomId": 1 });

// Update chronicle stats when fragment status changes
fragmentSchema.post("save", async function () {
  if (this.isModified("status") || this.isModified("currentSoldCount")) {
    const Chronicle = mongoose.model("Chronicle");
    const stats = await this.model("Fragment").aggregate([
      { $match: { chronicle: this.chronicle } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          claimed: {
            $sum: { $cond: [{ $eq: ["$status", "claimed"] }, 1, 0] },
          },
          reserved: {
            $sum: { $cond: [{ $eq: ["$status", "reserved"] }, 1, 0] },
          },
          uniqueKeepers: { $addToSet: "$claimedBy" },
          totalSold: { $sum: "$currentSoldCount" },
        },
      },
    ]);

    if (stats.length > 0) {
      await Chronicle.findByIdAndUpdate(this.chronicle, {
        "stats.fragmentCount": stats[0].total,
        "stats.fragmentsClaimed": stats[0].claimed,
        "stats.fragmentsReserved": stats[0].reserved,
        "stats.uniqueKeepers": stats[0].uniqueKeepers.filter((k) => k).length,
        "stats.totalSold": stats[0].totalSold,
      });
    }
  }
});

// Auto-update production status when sold count changes
fragmentSchema.pre("save", async function (next) {
  // Update production status based on sold count vs total supply
  if (this.isModified("currentSoldCount") || this.isModified("totalSupply")) {
    const totalNeeded = this.requiredFragmentsToStart || this.totalSupply;

    if (this.currentSoldCount === 0) {
      this.productionStatus = "awaiting_sale";
    } else if (this.currentSoldCount < totalNeeded) {
      this.productionStatus = "partial_sold";
    } else if (this.currentSoldCount >= totalNeeded && !this.productionReady) {
      this.productionStatus = "fully_sold";
      this.productionReady = true;

      // Enable collaboration room when fully sold
      if (!this.collaborationRoom.enabled) {
        this.collaborationRoom.enabled = true;
        this.collaborationRoom.roomId = `room_${this._id}_${Date.now()}`;
        this.collaborationRoom.createdAt = new Date();
      }
    }
  }

  next();
});

// Virtual for total revenue
fragmentSchema.virtual("totalRevenue").get(function () {
  return this.soldAt.reduce((total, sale) => total + this.price, 0);
});

// Virtual for remaining fragments
fragmentSchema.virtual("remainingToStart").get(function () {
  const needed = this.requiredFragmentsToStart || this.totalSupply;
  return Math.max(0, needed - this.currentSoldCount);
});

// Virtual for progress percentage
fragmentSchema.virtual("progressPercentage").get(function () {
  const needed = this.requiredFragmentsToStart || this.totalSupply;
  return needed > 0 ? (this.currentSoldCount / needed) * 100 : 0;
});

// Ensure soldAt array doesn't exceed total supply
fragmentSchema.pre("save", function (next) {
  if (this.soldAt.length > this.totalSupply) {
    const error = new Error(
      `Cannot sell more than ${this.totalSupply} fragments`
    );
    error.name = "ValidationError";
    next(error);
  }
  next();
});

// Method to check if fragment is available for purchase
fragmentSchema.methods.isAvailableForPurchase = function () {
  const totalNeeded = this.requiredFragmentsToStart || this.totalSupply;
  return (
    this.status === "available" &&
    this.currentSoldCount < totalNeeded &&
    (!this.reservedUntil || this.reservedUntil < new Date())
  );
};

// Method to reserve fragment for user
fragmentSchema.methods.reserveForUser = async function (
  userId,
  size,
  gender,
  shippingAddress
) {
  if (!this.isAvailableForPurchase()) {
    throw new Error("Fragment is not available for reservation");
  }

  this.status = "reserved";
  this.claimedBy = userId;
  this.claimedAt = new Date();
  this.reservedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Add to soldAt array
  this.soldAt.push({
    userId,
    size,
    gender,
    shippingAddress,
    purchasedAt: new Date(),
  });

  this.currentSoldCount += 1;

  await this.save();
  return this;
};

// Method to confirm purchase (convert from reserved to claimed)
fragmentSchema.methods.confirmPurchase = async function (transactionId) {
  if (this.status !== "reserved") {
    throw new Error("Fragment is not reserved");
  }

  this.status = "claimed";

  // Update the last sale with transaction ID
  if (this.soldAt.length > 0) {
    const lastSale = this.soldAt[this.soldAt.length - 1];
    lastSale.transactionId = transactionId;
  }

  await this.save();
  return this;
};

// Method to release reservation (if payment fails)
fragmentSchema.methods.releaseReservation = async function () {
  if (this.status !== "reserved") {
    throw new Error("Fragment is not reserved");
  }

  this.status = "available";
  this.claimedBy = null;
  this.claimedAt = null;
  this.reservedUntil = null;

  // Remove the last pending sale
  if (
    this.soldAt.length > 0 &&
    !this.soldAt[this.soldAt.length - 1].transactionId
  ) {
    this.soldAt.pop();
    this.currentSoldCount -= 1;
  }

  await this.save();
  return this;
};

module.exports = mongoose.model("Fragment", fragmentSchema);
