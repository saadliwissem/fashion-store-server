const asyncHandler = require("express-async-handler");
const KeeperProfile = require("../models/KeeperProfile");
const User = require("../models/User");
const Claim = require("../models/Claim");
const Fragment = require("../models/Fragment");
const mongoose = require("mongoose");

// @desc    Get keeper profile
// @route   GET /api/keepers/profile/:userId?
// @route   GET /api/keepers/profile/me (optional)
// @access  Public/Private
const getKeeperProfile = asyncHandler(async (req, res) => {
  let userId = req.params.userId;

  // If no userId provided and user is authenticated, use their own ID
  if (!userId && req.user) {
    userId = req.user.id;
  }

  // If still no userId, return error
  if (!userId) {
    res.status(400);
    throw new Error("User ID is required or you must be logged in");
  }

  // Find or create keeper profile
  let keeperProfile = await KeeperProfile.findOne({ user: userId })
    .populate("user", "firstName lastName email avatar createdAt")
    .populate("following", "user displayName avatar")
    .populate("followers", "user displayName avatar");

  if (!keeperProfile) {
    // Create a default profile if it doesn't exist
    const user = await User.findById(userId);
    if (!user) {
      res.status(404);
      throw new Error("User not found");
    }

    keeperProfile = await KeeperProfile.create({
      user: userId,
      displayName: user.fullName || `${user.firstName} ${user.lastName}`,
      avatar: user.avatar,
      joinedAt: user.createdAt,
    });

    // Populate the newly created profile
    keeperProfile = await KeeperProfile.findById(keeperProfile._id)
      .populate("user", "firstName lastName email avatar createdAt")
      .populate("following", "user displayName avatar")
      .populate("followers", "user displayName avatar");
  }

  // Get additional stats
  const [claims, fragments, uniqueChronicles] = await Promise.all([
    Claim.countDocuments({ user: userId, status: "delivered" }),
    Fragment.countDocuments({ claimedBy: userId }),
    Claim.distinct("fragment", { user: userId, status: "delivered" }).then(
      (fragmentIds) =>
        Fragment.distinct("chronicle", { _id: { $in: fragmentIds } })
    ),
  ]);

  const profileData = {
    ...keeperProfile.toObject(),
    stats: {
      ...keeperProfile.stats,
      claimsCount: claims,
      fragmentsOwned: fragments,
      uniqueChronicles: uniqueChronicles.length,
    },
  };

  res.json({
    success: true,
    data: profileData,
  });
});

// @desc    Update keeper profile
// @route   PUT /api/keepers/profile
// @access  Private
const updateKeeperProfile = asyncHandler(async (req, res) => {
  const { displayName, bio, avatar, social, preferences } = req.body;

  let keeperProfile = await KeeperProfile.findOne({ user: req.user.id });

  if (!keeperProfile) {
    // Create profile if it doesn't exist
    keeperProfile = new KeeperProfile({
      user: req.user.id,
      displayName: displayName || `${req.user.firstName} ${req.user.lastName}`,
      bio: bio || "",
      avatar: avatar || req.user.avatar,
      joinedAt: req.user.createdAt,
    });
  }

  // Update fields
  if (displayName) keeperProfile.displayName = displayName;
  if (bio !== undefined) keeperProfile.bio = bio;
  if (avatar) keeperProfile.avatar = avatar;
  if (social) keeperProfile.social = { ...keeperProfile.social, ...social };
  if (preferences)
    keeperProfile.preferences = {
      ...keeperProfile.preferences,
      ...preferences,
    };

  await keeperProfile.save();

  res.json({
    success: true,
    data: keeperProfile,
  });
});

// @desc    Get keeper's collection (claimed fragments)
// @route   GET /api/keepers/:userId/collection
// @access  Public
const getKeeperCollection = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { status, rarity, limit = 20, page = 1 } = req.query;

  const query = { claimedBy: userId };
  if (status) query.status = status;
  if (rarity) query.rarity = rarity;

  const fragments = await Fragment.find(query)
    .populate({
      path: "chronicle",
      select: "name enigma coverImage",
      populate: {
        path: "enigma",
        select: "name",
      },
    })
    .sort("-claimedAt")
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

  const total = await Fragment.countDocuments(query);

  // Group by chronicle for display
  const groupedByChronicle = fragments.reduce((acc, fragment) => {
    const chronicleId = fragment.chronicle._id.toString();
    if (!acc[chronicleId]) {
      acc[chronicleId] = {
        chronicle: fragment.chronicle,
        fragments: [],
        count: 0,
      };
    }
    acc[chronicleId].fragments.push(fragment);
    acc[chronicleId].count++;
    return acc;
  }, {});

  res.json({
    success: true,
    count: fragments.length,
    total,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    },
    data: {
      fragments,
      groupedByChronicle: Object.values(groupedByChronicle),
    },
  });
});

// @desc    Get keeper's activity feed
// @route   GET /api/keepers/:userId/activity
// @access  Public
const getKeeperActivity = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { limit = 20 } = req.query;

  // Get recent claims
  const claims = await Claim.find({ user: userId })
    .populate({
      path: "fragment",
      select: "name number imageUrl chronicle",
      populate: {
        path: "chronicle",
        select: "name enigma",
      },
    })
    .sort("-createdAt")
    .limit(parseInt(limit))
    .select("claimId status createdAt payment.amount fragment");

  // Get waitlist activity
  const Waitlist = mongoose.model("Waitlist");
  const waitlistEntries = await Waitlist.find({
    user: userId,
    status: "active",
  })
    .populate("chronicle", "name coverImage")
    .sort("-createdAt")
    .limit(parseInt(limit))
    .select("chronicle position createdAt");

  // Combine and sort activities
  const activities = [
    ...claims.map((claim) => ({
      type: "claim",
      id: claim._id,
      title: `Claimed Fragment #${claim.fragment?.number}`,
      description: claim.fragment?.name,
      chronicle: claim.fragment?.chronicle,
      amount: claim.payment?.amount,
      status: claim.status,
      claimId: claim.claimId,
      timestamp: claim.createdAt,
    })),
    ...waitlistEntries.map((entry) => ({
      type: "waitlist",
      id: entry._id,
      title: "Joined Waitlist",
      description: entry.chronicle?.name,
      chronicle: entry.chronicle,
      position: entry.position,
      timestamp: entry.createdAt,
    })),
  ]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);

  res.json({
    success: true,
    count: activities.length,
    data: activities,
  });
});

// @desc    Follow a keeper
// @route   POST /api/keepers/:userId/follow
// @access  Private
const followKeeper = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (userId === req.user.id) {
    res.status(400);
    throw new Error("You cannot follow yourself");
  }

  // Get target keeper profile
  const targetProfile = await KeeperProfile.findOne({ user: userId });
  if (!targetProfile) {
    res.status(404);
    throw new Error("Keeper not found");
  }

  // Get current user's keeper profile
  let currentProfile = await KeeperProfile.findOne({ user: req.user.id });
  if (!currentProfile) {
    // Create profile if it doesn't exist
    currentProfile = await KeeperProfile.create({
      user: req.user.id,
      displayName: `${req.user.firstName} ${req.user.lastName}`,
    });
  }

  // Check if already following
  const alreadyFollowing = currentProfile.following.some(
    (f) => f.keeper.toString() === targetProfile._id.toString()
  );

  if (alreadyFollowing) {
    res.status(400);
    throw new Error("Already following this keeper");
  }

  // Add to following
  currentProfile.following.push({
    keeper: targetProfile._id,
    followedAt: new Date(),
    notifications: true,
  });

  // Add to target's followers
  targetProfile.followers.push(currentProfile._id);

  await Promise.all([currentProfile.save(), targetProfile.save()]);

  res.json({
    success: true,
    message: "Successfully followed keeper",
  });
});

// @desc    Unfollow a keeper
// @route   DELETE /api/keepers/:userId/follow
// @access  Private
const unfollowKeeper = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const targetProfile = await KeeperProfile.findOne({ user: userId });
  if (!targetProfile) {
    res.status(404);
    throw new Error("Keeper not found");
  }

  const currentProfile = await KeeperProfile.findOne({ user: req.user.id });
  if (!currentProfile) {
    res.status(404);
    throw new Error("Keeper profile not found");
  }

  // Remove from following
  currentProfile.following = currentProfile.following.filter(
    (f) => f.keeper.toString() !== targetProfile._id.toString()
  );

  // Remove from target's followers
  targetProfile.followers = targetProfile.followers.filter(
    (f) => f.toString() !== currentProfile._id.toString()
  );

  await Promise.all([currentProfile.save(), targetProfile.save()]);

  res.json({
    success: true,
    message: "Successfully unfollowed keeper",
  });
});

// @desc    Get keeper's followers
// @route   GET /api/keepers/:userId/followers
// @access  Public
const getFollowers = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { limit = 20, page = 1 } = req.query;

  const keeperProfile = await KeeperProfile.findOne({ user: userId }).populate({
    path: "followers",
    populate: {
      path: "user",
      select: "firstName lastName avatar",
    },
  });

  if (!keeperProfile) {
    res.status(404);
    throw new Error("Keeper not found");
  }

  const followers = keeperProfile.followers
    .slice((page - 1) * limit, page * limit)
    .map((f) => ({
      id: f._id,
      user: f.user,
      displayName: f.displayName,
      avatar: f.avatar,
      reputation: f.reputation,
      followedAt: f.createdAt,
    }));

  res.json({
    success: true,
    count: followers.length,
    total: keeperProfile.followers.length,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(keeperProfile.followers.length / parseInt(limit)),
    },
    data: followers,
  });
});

// @desc    Get who a keeper is following
// @route   GET /api/keepers/:userId/following
// @access  Public
const getFollowing = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { limit = 20, page = 1 } = req.query;

  const keeperProfile = await KeeperProfile.findOne({ user: userId }).populate({
    path: "following.keeper",
    populate: {
      path: "user",
      select: "firstName lastName avatar",
    },
  });

  if (!keeperProfile) {
    res.status(404);
    throw new Error("Keeper not found");
  }

  const following = keeperProfile.following
    .slice((page - 1) * limit, page * limit)
    .map((f) => ({
      id: f.keeper._id,
      user: f.keeper.user,
      displayName: f.keeper.displayName,
      avatar: f.keeper.avatar,
      reputation: f.keeper.reputation,
      followedAt: f.followedAt,
      notifications: f.notifications,
    }));

  res.json({
    success: true,
    count: following.length,
    total: keeperProfile.following.length,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(keeperProfile.following.length / parseInt(limit)),
    },
    data: following,
  });
});

module.exports = {
  getKeeperProfile,
  updateKeeperProfile,
  getKeeperCollection,
  getKeeperActivity,
  followKeeper,
  unfollowKeeper,
  getFollowers,
  getFollowing,
};
