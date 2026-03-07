const mongoose = require("mongoose");

const chronicleSchema = new mongoose.Schema(
  {
    enigma: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Enigma",
      required: [true, "Parent enigma is required"],
    },
    name: {
      type: String,
      required: [true, "Chronicle name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    lore: {
      type: String,
      maxlength: [2000, "Lore cannot exceed 2000 characters"],
    },
    coverImage: {
      url: String,
      publicId: String,
      alt: String,
    },
    difficulty: {
      type: String,
      enum: ["beginner", "intermediate", "advanced", "expert"],
      default: "intermediate",
    },
    status: {
      type: String,
      enum: ["available", "forging", "cipher", "solved"],
      default: "available",
    },
    productionStatus: {
      type: String,
      enum: [
        "awaiting",
        "design",
        "forging",
        "enchanting",
        "shipping",
        "delivered",
      ],
      default: "awaiting",
    },
    timeline: String, // e.g., "6-8 weeks"
    basePrice: {
      type: Number,
      required: [true, "Base price is required"],
      min: [0, "Price cannot be negative"],
    },
    location: {
      country: String,
      city: String,
      coordinates: {
        lat: Number,
        lng: Number,
      },
    },
    author: {
      name: String,
      avatar: String,
      role: String,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    estimatedStartDate: Date,
    estimatedCompletion: Date,
    stats: {
      fragmentCount: {
        type: Number,
        default: 0,
      },
      fragmentsClaimed: {
        type: Number,
        default: 0,
      },
      requiredFragments: {
        type: Number,
        required: [true, "Required fragments count is required"],
        min: [1, "Must require at least 1 fragment"],
      },
      uniqueKeepers: {
        type: Number,
        default: 0,
      },
    },
    rewards: [
      {
        name: String,
        description: String,
        type: {
          type: String,
          enum: ["badge", "nft", "physical", "experience"],
        },
        image: String,
        unlockThreshold: Number, // fragments needed to unlock
      },
    ],
    waitlist: {
      enabled: {
        type: Boolean,
        default: true,
      },
      maxCapacity: Number,
      currentCount: {
        type: Number,
        default: 0,
      },
    },
    metadata: {
      viewCount: {
        type: Number,
        default: 0,
      },
      interestedCount: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for fragments
chronicleSchema.virtual("fragments", {
  ref: "Fragment",
  localField: "_id",
  foreignField: "chronicle",
});

// Virtual for waitlist entries
chronicleSchema.virtual("waitlistEntries", {
  ref: "Waitlist",
  localField: "_id",
  foreignField: "chronicle",
});

// Update parent enigma's stats when chronicle is saved
chronicleSchema.post("save", async function () {
  const Enigma = mongoose.model("Enigma");
  const stats = await this.model("Chronicle").aggregate([
    { $match: { enigma: this.enigma } },
    {
      $group: {
        _id: null,
        totalChronicles: { $sum: 1 },
        totalFragments: { $sum: "$stats.fragmentCount" },
        fragmentsClaimed: { $sum: "$stats.fragmentsClaimed" },
      },
    },
  ]);

  if (stats.length > 0) {
    await Enigma.findByIdAndUpdate(this.enigma, {
      "metadata.totalChronicles": stats[0].totalChronicles,
      "metadata.totalFragments": stats[0].totalFragments,
      "metadata.fragmentsClaimed": stats[0].fragmentsClaimed,
    });
  }
});

// Indexes
chronicleSchema.index({ enigma: 1, status: 1 });
chronicleSchema.index({ featured: 1 });
chronicleSchema.index({ "stats.fragmentsClaimed": -1 });

module.exports = mongoose.model("Chronicle", chronicleSchema);
