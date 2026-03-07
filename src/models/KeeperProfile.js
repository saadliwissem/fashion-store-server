const mongoose = require("mongoose");

const keeperProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    displayName: {
      type: String,
      trim: true,
      maxlength: [50, "Display name cannot exceed 50 characters"],
    },
    bio: {
      type: String,
      maxlength: [500, "Bio cannot exceed 500 characters"],
    },
    avatar: String,
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    reputation: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    badges: [
      {
        name: String,
        description: String,
        image: String,
        awardedAt: {
          type: Date,
          default: Date.now,
        },
        type: {
          type: String,
          enum: [
            "collector",
            "solver",
            "early_adopter",
            "contributor",
            "legend",
          ],
        },
      },
    ],
    stats: {
      fragmentsClaimed: { type: Number, default: 0 },
      chroniclesCompleted: { type: Number, default: 0 },
      mysteriesSolved: { type: Number, default: 0 },
      totalSpent: { type: Number, default: 0 },
      waitlistEntries: { type: Number, default: 0 },
      claimsCount: { type: Number, default: 0 },
      uniqueChronicles: { type: Number, default: 0 },
    },
    following: [
      {
        keeper: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "KeeperProfile",
        },
        followedAt: {
          type: Date,
          default: Date.now,
        },
        notifications: {
          type: Boolean,
          default: true,
        },
      },
    ],
    followers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "KeeperProfile",
      },
    ],
    social: {
      website: String,
      twitter: String,
      instagram: String,
      discord: String,
    },
    preferences: {
      showActivity: { type: Boolean, default: true },
      showCollection: { type: Boolean, default: true },
      allowMessages: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
  }
);

keeperProfileSchema.index({ reputation: -1 });
keeperProfileSchema.index({ "stats.fragmentsClaimed": -1 });
keeperProfileSchema.index({ "stats.chroniclesCompleted": -1 });

module.exports = mongoose.model("KeeperProfile", keeperProfileSchema);
