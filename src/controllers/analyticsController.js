const Enigma = require("../models/Enigma");
const Chronicle = require("../models/Chronicle");
const Fragment = require("../models/Fragment");
const Claim = require("../models/Claim");
const Waitlist = require("../models/Waitlist");
const asyncHandler = require("../middleware/async");
const ErrorResponse = require("../utils/ErrorResponse");

// @desc    Get chronicle predictions/stats for Oracle
// @route   GET /api/analytics/chronicle/:id
// @access  Public
exports.getChronicleAnalytics = asyncHandler(async (req, res, next) => {
  const chronicle = await Chronicle.findById(req.params.id);
  if (!chronicle) {
    return next(new ErrorResponse("Chronicle not found", 404));
  }

  // Get recent claims for this chronicle
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [recentClaims, waitlistStats, fragmentStats, claimRate, popularTimes] =
    await Promise.all([
      // Recent claims activity
      Claim.find({
        fragment: {
          $in: await Fragment.find({ chronicle: chronicle._id }).distinct(
            "_id"
          ),
        },
        createdAt: { $gte: thirtyDaysAgo },
      }).populate("user", "firstName lastName"),

      // Waitlist stats
      Waitlist.aggregate([
        { $match: { chronicle: chronicle._id, status: "active" } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: -1 } },
        { $limit: 30 },
      ]),

      // Fragment claim distribution
      Fragment.aggregate([
        { $match: { chronicle: chronicle._id } },
        {
          $group: {
            _id: "$rarity",
            total: { $sum: 1 },
            claimed: {
              $sum: { $cond: [{ $eq: ["$status", "claimed"] }, 1, 0] },
            },
          },
        },
      ]),

      // Claim rate over time
      Claim.aggregate([
        {
          $match: {
            fragment: {
              $in: await Fragment.find({ chronicle: chronicle._id }).distinct(
                "_id"
              ),
            },
            createdAt: { $gte: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
              day: { $dayOfMonth: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
      ]),

      // Popular claim times (hour of day)
      Claim.aggregate([
        {
          $match: {
            fragment: {
              $in: await Fragment.find({ chronicle: chronicle._id }).distinct(
                "_id"
              ),
            },
          },
        },
        {
          $group: {
            _id: { $hour: "$createdAt" },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),
    ]);

  // Calculate predictions
  const claimVelocity = recentClaims.length / 30; // claims per day
  const remainingFragments =
    chronicle.stats.requiredFragments - chronicle.stats.fragmentsClaimed;
  const estimatedDaysToCompletion =
    claimVelocity > 0 ? Math.ceil(remainingFragments / claimVelocity) : null;

  // Identify trends
  const trending = {
    isTrending: claimVelocity > 0.5, // More than 0.5 claims per day
    velocity: claimVelocity,
    momentum:
      recentClaims.length > 10
        ? "high"
        : recentClaims.length > 5
        ? "medium"
        : "low",
    peakHour: popularTimes[0]?._id,
  };

  res.status(200).json({
    success: true,
    data: {
      chronicle: {
        id: chronicle._id,
        name: chronicle.name,
        progress: {
          claimed: chronicle.stats.fragmentsClaimed,
          required: chronicle.stats.requiredFragments,
          percentage: (
            (chronicle.stats.fragmentsClaimed /
              chronicle.stats.requiredFragments) *
            100
          ).toFixed(1),
        },
      },
      predictions: {
        estimatedCompletion: estimatedDaysToCompletion
          ? new Date(
              Date.now() + estimatedDaysToCompletion * 24 * 60 * 60 * 1000
            )
          : null,
        estimatedDaysToCompletion,
        confidence: claimVelocity > 0 ? "medium" : "low",
        nextFragmentAvailability: calculateNextAvailability(
          chronicle,
          fragmentStats
        ),
      },
      trends: trending,
      distribution: fragmentStats.reduce((acc, curr) => {
        acc[curr._id] = {
          total: curr.total,
          claimed: curr.claimed,
          available: curr.total - curr.claimed,
          percentage: ((curr.claimed / curr.total) * 100).toFixed(1),
        };
        return acc;
      }, {}),
      recentActivity: recentClaims.slice(0, 10).map((claim) => ({
        user: claim.user
          ? `${claim.user.firstName} ${claim.user.lastName}`
          : "Anonymous",
        date: claim.createdAt,
        fragment: claim.fragment,
      })),
      waitlistGrowth: waitlistStats,
    },
  });
});

// @desc    Get enigma-level stats
// @route   GET /api/analytics/enigma/:id
// @access  Public
exports.getEnigmaAnalytics = asyncHandler(async (req, res, next) => {
  const enigma = await Enigma.findById(req.params.id);
  if (!enigma) {
    return next(new ErrorResponse("Enigma not found", 404));
  }

  const chronicles = await Chronicle.find({ enigma: enigma._id });

  const analytics = {
    enigma: {
      id: enigma._id,
      name: enigma.name,
      stats: enigma.stats,
      metadata: enigma.metadata,
    },
    chronicles: chronicles.map((c) => ({
      id: c._id,
      name: c.name,
      progress: (
        (c.stats.fragmentsClaimed / c.stats.requiredFragments) *
        100
      ).toFixed(1),
      fragments: c.stats.fragmentCount,
      claimed: c.stats.fragmentsClaimed,
      status: c.status,
    })),
    overall: {
      totalChronicles: chronicles.length,
      completedChronicles: chronicles.filter((c) => c.status === "solved")
        .length,
      totalFragments: chronicles.reduce(
        (sum, c) => sum + c.stats.fragmentCount,
        0
      ),
      totalClaimed: chronicles.reduce(
        (sum, c) => sum + c.stats.fragmentsClaimed,
        0
      ),
      completionRate: (
        (chronicles.reduce((sum, c) => sum + c.stats.fragmentsClaimed, 0) /
          chronicles.reduce((sum, c) => sum + c.stats.fragmentCount, 0)) *
        100
      ).toFixed(1),
    },
  };

  res.status(200).json({
    success: true,
    data: analytics,
  });
});

// @desc    Get trending mysteries
// @route   GET /api/analytics/trending
// @access  Public
exports.getTrending = asyncHandler(async (req, res, next) => {
  const { limit = 10, timeframe = "week" } = req.query;

  const dateFilter = new Date();
  switch (timeframe) {
    case "day":
      dateFilter.setDate(dateFilter.getDate() - 1);
      break;
    case "week":
      dateFilter.setDate(dateFilter.getDate() - 7);
      break;
    case "month":
      dateFilter.setMonth(dateFilter.getMonth() - 1);
      break;
    default:
      dateFilter.setDate(dateFilter.getDate() - 7);
  }

  // Get chronicles with most activity
  const trending = await Chronicle.aggregate([
    {
      $lookup: {
        from: "fragments",
        localField: "_id",
        foreignField: "chronicle",
        as: "fragments",
      },
    },
    {
      $lookup: {
        from: "claims",
        let: { fragmentIds: "$fragments._id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $in: ["$fragment", "$$fragmentIds"] },
                  { $gte: ["$createdAt", dateFilter] },
                ],
              },
            },
          },
        ],
        as: "recentClaims",
      },
    },
    {
      $lookup: {
        from: "waitlists",
        let: { chronicleId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$chronicle", "$$chronicleId"] },
                  { $gte: ["$createdAt", dateFilter] },
                ],
              },
            },
          },
        ],
        as: "recentWaitlists",
      },
    },
    {
      $addFields: {
        activityScore: {
          $add: [
            { $multiply: [{ $size: "$recentClaims" }, 2] },
            { $multiply: [{ $size: "$recentWaitlists" }, 1] },
            { $multiply: ["$metadata.viewCount", 0.1] },
          ],
        },
        claimVelocity: { $divide: [{ $size: "$recentClaims" }, 7] }, // claims per day avg
        waitlistVelocity: { $divide: [{ $size: "$recentWaitlists" }, 7] },
      },
    },
    { $sort: { activityScore: -1 } },
    { $limit: parseInt(limit) },
    {
      $project: {
        name: 1,
        description: 1,
        coverImage: 1,
        difficulty: 1,
        status: 1,
        featured: 1,
        "stats.fragmentCount": 1,
        "stats.fragmentsClaimed": 1,
        "stats.requiredFragments": 1,
        activityScore: 1,
        claimVelocity: 1,
        waitlistVelocity: 1,
        recentClaims: { $size: "$recentClaims" },
        recentWaitlists: { $size: "$recentWaitlists" },
      },
    },
  ]);

  res.status(200).json({
    success: true,
    count: trending.length,
    timeframe,
    data: trending,
  });
});

// Helper function to calculate next fragment availability
const calculateNextAvailability = (chronicle, fragmentStats) => {
  // Find rarest fragment type with availability
  const rarityOrder = { legendary: 3, rare: 2, common: 1 };

  const availableByRarity = fragmentStats
    .filter((stat) => stat.total - stat.claimed > 0)
    .sort((a, b) => rarityOrder[b._id] - rarityOrder[a._id]);

  if (availableByRarity.length === 0) return null;

  // Simple prediction based on claim rates
  // In production, this would be more sophisticated
  return {
    rarity: availableByRarity[0]._id,
    estimatedTime:
      availableByRarity[0]._id === "legendary" ? "1-2 weeks" : "3-5 days",
    confidence: "medium",
  };
};
