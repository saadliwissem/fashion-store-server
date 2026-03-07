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
        type: String, // Changed from embedded document to simple string array
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
      type: String, // Changed from Date to String to handle "6-8 weeks" format
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
  },
  {
    timestamps: true,
  }
);

// Ensure unique fragment numbers within a chronicle
fragmentSchema.index({ chronicle: 1, number: 1 }, { unique: true });

// Update chronicle stats when fragment status changes
fragmentSchema.post("save", async function () {
  if (this.isModified("status")) {
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
          uniqueKeepers: { $addToSet: "$claimedBy" },
        },
      },
    ]);

    if (stats.length > 0) {
      await Chronicle.findByIdAndUpdate(this.chronicle, {
        "stats.fragmentCount": stats[0].total,
        "stats.fragmentsClaimed": stats[0].claimed,
        "stats.uniqueKeepers": stats[0].uniqueKeepers.filter((k) => k).length,
      });
    }
  }
});

module.exports = mongoose.model("Fragment", fragmentSchema);
