const mongoose = require("mongoose");

const enigmaSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Enigma name is required"],
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
    status: {
      type: String,
      enum: ["active", "upcoming", "archived", "solved"],
      default: "upcoming",
    },
    coverImage: {
      url: String,
      publicId: String,
      alt: String,
    },
    bannerImage: {
      url: String,
      publicId: String,
      alt: String,
    },
    difficulty: {
      type: String,
      enum: ["beginner", "intermediate", "advanced", "expert"],
      default: "intermediate",
    },
    featured: {
      type: Boolean,
      default: false,
    },
    startDate: Date,
    estimatedEnd: Date,
    creator: {
      name: String,
      avatar: String,
      bio: String,
    },
    location: {
      country: String,
      city: String,
      virtual: Boolean,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    rewards: [
      {
        name: String,
        description: String,
        type: {
          type: String,
          enum: ["badge", "nft", "physical", "experience"],
        },
        image: String,
        rarity: {
          type: String,
          enum: ["common", "rare", "legendary"],
        },
      },
    ],
    stats: {
      activeKeepers: {
        type: Number,
        default: 0,
      },
      totalValueLocked: {
        type: Number,
        default: 0,
      },
      completionRate: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
      },
      averageTimeToComplete: {
        type: Number, // in days
        default: 0,
      },
    },
    metadata: {
      totalChronicles: {
        type: Number,
        default: 0,
      },
      totalFragments: {
        type: Number,
        default: 0,
      },
      fragmentsClaimed: {
        type: Number,
        default: 0,
      },
    },
    seo: {
      title: String,
      description: String,
      keywords: [String],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for chronicles
enigmaSchema.virtual("chronicles", {
  ref: "Chronicle",
  localField: "_id",
  foreignField: "enigma",
});

// Index for search
enigmaSchema.index({ name: "text", description: "text", lore: "text" });
enigmaSchema.index({ status: 1, featured: 1 });
enigmaSchema.index({ "metadata.fragmentsClaimed": -1 });

module.exports = mongoose.model("Enigma", enigmaSchema);
