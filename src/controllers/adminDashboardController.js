const Enigma = require("../models/Enigma");
const Chronicle = require("../models/Chronicle");
const Fragment = require("../models/Fragment");
const Claim = require("../models/Claim");
const Waitlist = require("../models/Waitlist");
const User = require("../models/User");
const mongoose = require("mongoose");
const asyncHandler = require("../middleware/async");

// @desc    Get dashboard statistics
// @route   GET /api/admin/dashboard/stats
// @access  Private/Admin
exports.getDashboardStats = asyncHandler(async (req, res) => {
  const [
    totalEnigmas,
    totalChronicles,
    totalFragments,
    totalClaims,
    totalUsers,
    totalWaitlist,
    recentClaims,
    recentUsers,
    fragmentsByStatus,
    claimsByStatus,
    enigmasByStatus,
    productionStats,
  ] = await Promise.all([
    // Total counts
    Enigma.countDocuments(),
    Chronicle.countDocuments(),
    Fragment.countDocuments(),
    Claim.countDocuments(),
    User.countDocuments(),
    Waitlist.countDocuments({ status: "active" }),

    // Recent activity (last 7 days)
    Claim.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    }),
    User.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    }),

    // Fragments by status
    Fragment.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),

    // Claims by status
    Claim.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),

    // Enigmas by status
    Enigma.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),

    // Production status stats
    Chronicle.aggregate([
      {
        $group: {
          _id: "$productionStatus",
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  // Format fragments by status
  const fragmentsByStatusObj = {
    available: 0,
    claimed: 0,
    reserved: 0,
  };
  fragmentsByStatus.forEach((item) => {
    fragmentsByStatusObj[item._id] = item.count;
  });

  // Format claims by status
  const claimsByStatusObj = {
    pending: 0,
    confirmed: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
  };
  claimsByStatus.forEach((item) => {
    claimsByStatusObj[item._id] = item.count;
  });

  // Format enigmas by status
  const enigmasByStatusObj = {
    active: 0,
    upcoming: 0,
    solved: 0,
    archived: 0,
  };
  enigmasByStatus.forEach((item) => {
    enigmasByStatusObj[item._id] = item.count;
  });

  // Format production stats
  const productionStatsObj = {
    awaiting: 0,
    design: 0,
    forging: 0,
    enchanting: 0,
    shipping: 0,
    delivered: 0,
  };
  productionStats.forEach((item) => {
    productionStatsObj[item._id] = item.count;
  });

  // Calculate total value locked
  const totalValueLocked = await Fragment.aggregate([
    { $match: { status: "claimed" } },
    { $group: { _id: null, total: { $sum: "$price" } } },
  ]);

  // Calculate claim rate
  const claimRate =
    totalFragments > 0
      ? ((fragmentsByStatusObj.claimed / totalFragments) * 100).toFixed(1)
      : 0;

  res.json({
    success: true,
    data: {
      overview: {
        totalEnigmas,
        totalChronicles,
        totalFragments,
        totalClaims,
        totalUsers,
        totalWaitlist,
        totalValueLocked: totalValueLocked[0]?.total || 0,
        claimRate: parseFloat(claimRate),
      },
      activity: {
        recentClaims,
        recentUsers,
        claimsLast7Days: recentClaims,
        usersLast7Days: recentUsers,
      },
      fragments: {
        total: totalFragments,
        byStatus: fragmentsByStatusObj,
      },
      claims: {
        total: totalClaims,
        byStatus: claimsByStatusObj,
      },
      enigmas: {
        total: totalEnigmas,
        byStatus: enigmasByStatusObj,
      },
      production: productionStatsObj,
    },
  });
});

// @desc    Get recent activity
// @route   GET /api/admin/dashboard/recent-activity
// @access  Private/Admin
exports.getRecentActivity = asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;

  // Get recent claims
  const recentClaims = await Claim.find()
    .populate("user", "firstName lastName email")
    .populate("fragment", "name number")
    .sort("-createdAt")
    .limit(parseInt(limit))
    .lean();

  // Get recent waitlist joins
  const recentWaitlist = await Waitlist.find({ status: "active" })
    .populate("user", "firstName lastName email")
    .populate("chronicle", "name")
    .sort("-createdAt")
    .limit(parseInt(limit))
    .lean();

  // Get recent fragment claims
  const recentFragmentClaims = await Fragment.find({
    status: "claimed",
    claimedAt: { $ne: null },
  })
    .populate("claimedBy", "firstName lastName email")
    .populate("chronicle", "name")
    .sort("-claimedAt")
    .limit(parseInt(limit))
    .lean();

  // Get recent user registrations
  const recentUsers = await User.find()
    .sort("-createdAt")
    .limit(parseInt(limit))
    .select("firstName lastName email createdAt")
    .lean();

  // Combine and format all activities
  const activities = [];

  // Format claims
  recentClaims.forEach((claim) => {
    activities.push({
      id: claim._id,
      type: "claim",
      title: "New Claim",
      description: `${claim.user?.firstName || "Anonymous"} ${
        claim.user?.lastName || ""
      } claimed ${claim.fragment?.name || "a fragment"}`,
      timestamp: claim.createdAt,
      user: claim.user,
      metadata: {
        claimId: claim.claimId,
        amount: claim.payment?.amount,
      },
    });
  });

  // Format waitlist joins
  recentWaitlist.forEach((entry) => {
    activities.push({
      id: entry._id,
      type: "waitlist",
      title: "Waitlist Join",
      description: `${
        entry.user
          ? `${entry.user.firstName} ${entry.user.lastName}`
          : entry.email
      } joined waitlist for ${entry.chronicle?.name || "a chronicle"}`,
      timestamp: entry.createdAt,
      user: entry.user,
      metadata: {
        position: entry.position,
        chronicle: entry.chronicle?.name,
      },
    });
  });

  // Format fragment claims
  recentFragmentClaims.forEach((fragment) => {
    activities.push({
      id: fragment._id,
      type: "fragment",
      title: "Fragment Claimed",
      description: `${fragment.name} was claimed by ${
        fragment.claimedBy?.firstName || "a keeper"
      }`,
      timestamp: fragment.claimedAt,
      user: fragment.claimedBy,
      metadata: {
        fragmentNumber: fragment.number,
        chronicle: fragment.chronicle?.name,
        rarity: fragment.rarity,
      },
    });
  });

  // Format user registrations
  recentUsers.forEach((user) => {
    activities.push({
      id: user._id,
      type: "user",
      title: "New User",
      description: `${user.firstName} ${user.lastName} joined the platform`,
      timestamp: user.createdAt,
      user: user,
      metadata: {},
    });
  });

  // Sort by timestamp descending and limit
  activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const limitedActivities = activities.slice(0, parseInt(limit));

  res.json({
    success: true,
    count: limitedActivities.length,
    data: limitedActivities,
  });
});

// @desc    Get sales data for charts
// @route   GET /api/admin/dashboard/sales-data
// @access  Private/Admin
exports.getSalesData = asyncHandler(async (req, res) => {
  const { period = "30days" } = req.query;

  let startDate;
  const endDate = new Date();
  const groupFormat = {};

  switch (period) {
    case "7days":
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      groupFormat.date = "%Y-%m-%d";
      groupFormat.label = "day";
      break;
    case "30days":
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      groupFormat.date = "%Y-%m-%d";
      groupFormat.label = "day";
      break;
    case "3months":
      startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      groupFormat.date = "%Y-%m-%d";
      groupFormat.label = "day";
      break;
    case "6months":
      startDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
      groupFormat.date = "%Y-%m";
      groupFormat.label = "month";
      break;
    case "year":
      startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      groupFormat.date = "%Y-%m";
      groupFormat.label = "month";
      break;
    default:
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      groupFormat.date = "%Y-%m-%d";
      groupFormat.label = "day";
  }

  // Get daily sales data
  const dailySales = await Claim.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        "payment.status": "completed",
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: groupFormat.date, date: "$createdAt" },
        },
        count: { $sum: 1 },
        revenue: { $sum: "$payment.amount" },
        averageValue: { $avg: "$payment.amount" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Get sales by fragment rarity
  const salesByRarity = await Claim.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        "payment.status": "completed",
      },
    },
    {
      $lookup: {
        from: "fragments",
        localField: "fragment",
        foreignField: "_id",
        as: "fragmentInfo",
      },
    },
    { $unwind: "$fragmentInfo" },
    {
      $group: {
        _id: "$fragmentInfo.rarity",
        count: { $sum: 1 },
        revenue: { $sum: "$payment.amount" },
      },
    },
  ]);

  // Get cumulative sales
  const cumulativeSales = await Claim.aggregate([
    {
      $match: {
        "payment.status": "completed",
      },
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$payment.amount" },
        totalOrders: { $sum: 1 },
      },
    },
  ]);

  // Get payment method distribution
  const paymentMethods = await Claim.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        "payment.status": "completed",
      },
    },
    {
      $group: {
        _id: "$payment.method",
        count: { $sum: 1 },
        revenue: { $sum: "$payment.amount" },
      },
    },
  ]);

  res.json({
    success: true,
    data: {
      period,
      startDate,
      endDate,
      dailySales: dailySales.map((item) => ({
        [groupFormat.label]: item._id,
        orders: item.count,
        revenue: item.revenue,
        averageValue: item.averageValue,
      })),
      byRarity: salesByRarity.map((item) => ({
        rarity: item._id,
        orders: item.count,
        revenue: item.revenue,
      })),
      paymentMethods: paymentMethods.map((item) => ({
        method: item._id,
        orders: item.count,
        revenue: item.revenue,
      })),
      totals: {
        revenue: cumulativeSales[0]?.totalRevenue || 0,
        orders: cumulativeSales[0]?.totalOrders || 0,
        periodRevenue: dailySales.reduce((sum, day) => sum + day.revenue, 0),
        periodOrders: dailySales.reduce((sum, day) => sum + day.count, 0),
      },
    },
  });
});

// @desc    Get top performing chronicles
// @route   GET /api/admin/dashboard/top-chronicles
// @access  Private/Admin
exports.getTopChronicles = asyncHandler(async (req, res) => {
  const { limit = 5 } = req.query;

  // Top chronicles by fragments claimed
  const topByClaims = await Chronicle.aggregate([
    {
      $project: {
        name: 1,
        enigma: 1,
        "stats.fragmentCount": 1,
        "stats.fragmentsClaimed": 1,
        "stats.requiredFragments": 1,
        claimRate: {
          $cond: {
            if: { $gt: ["$stats.fragmentCount", 0] },
            then: {
              $multiply: [
                {
                  $divide: ["$stats.fragmentsClaimed", "$stats.fragmentCount"],
                },
                100,
              ],
            },
            else: 0,
          },
        },
      },
    },
    {
      $lookup: {
        from: "enigmas",
        localField: "enigma",
        foreignField: "_id",
        as: "enigmaInfo",
      },
    },
    { $unwind: "$enigmaInfo" },
    { $sort: { "stats.fragmentsClaimed": -1 } },
    { $limit: parseInt(limit) },
  ]);

  // Top chronicles by revenue
  const topByRevenue = await Claim.aggregate([
    {
      $match: { "payment.status": "completed" },
    },
    {
      $lookup: {
        from: "fragments",
        localField: "fragment",
        foreignField: "_id",
        as: "fragmentInfo",
      },
    },
    { $unwind: "$fragmentInfo" },
    {
      $group: {
        _id: "$fragmentInfo.chronicle",
        revenue: { $sum: "$payment.amount" },
        orders: { $sum: 1 },
        fragments: { $addToSet: "$fragmentInfo._id" },
      },
    },
    {
      $lookup: {
        from: "chronicles",
        localField: "_id",
        foreignField: "_id",
        as: "chronicleInfo",
      },
    },
    { $unwind: "$chronicleInfo" },
    {
      $lookup: {
        from: "enigmas",
        localField: "chronicleInfo.enigma",
        foreignField: "_id",
        as: "enigmaInfo",
      },
    },
    { $unwind: "$enigmaInfo" },
    {
      $project: {
        name: "$chronicleInfo.name",
        enigmaName: "$enigmaInfo.name",
        revenue: 1,
        orders: 1,
        uniqueFragments: { $size: "$fragments" },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: parseInt(limit) },
  ]);

  // Top chronicles by waitlist size
  const topByWaitlist = await Waitlist.aggregate([
    {
      $match: { status: "active" },
    },
    {
      $group: {
        _id: "$chronicle",
        waitlistCount: { $sum: 1 },
        avgPosition: { $avg: "$position" },
      },
    },
    {
      $lookup: {
        from: "chronicles",
        localField: "_id",
        foreignField: "_id",
        as: "chronicleInfo",
      },
    },
    { $unwind: "$chronicleInfo" },
    {
      $lookup: {
        from: "enigmas",
        localField: "chronicleInfo.enigma",
        foreignField: "_id",
        as: "enigmaInfo",
      },
    },
    { $unwind: "$enigmaInfo" },
    {
      $project: {
        name: "$chronicleInfo.name",
        enigmaName: "$enigmaInfo.name",
        waitlistCount: 1,
        avgPosition: { $round: ["$avgPosition", 1] },
      },
    },
    { $sort: { waitlistCount: -1 } },
    { $limit: parseInt(limit) },
  ]);

  res.json({
    success: true,
    data: {
      byClaims: topByClaims.map((item) => ({
        id: item._id,
        name: item.name,
        enigmaName: item.enigmaInfo.name,
        fragmentsClaimed: item.stats.fragmentsClaimed,
        fragmentCount: item.stats.fragmentCount,
        claimRate: Math.round(item.claimRate * 10) / 10,
      })),
      byRevenue: topByRevenue,
      byWaitlist: topByWaitlist,
    },
  });
});

// @desc    Get enigma performance metrics
// @route   GET /api/admin/dashboard/enigma-performance
// @access  Private/Admin
exports.getEnigmaPerformance = asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;

  const performance = await Enigma.aggregate([
    {
      $lookup: {
        from: "chronicles",
        localField: "_id",
        foreignField: "enigma",
        as: "chronicles",
      },
    },
    {
      $lookup: {
        from: "fragments",
        let: { chronicleIds: "$chronicles._id" },
        pipeline: [
          {
            $match: {
              $expr: { $in: ["$chronicle", "$$chronicleIds"] },
            },
          },
        ],
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
              $expr: { $in: ["$fragment", "$$fragmentIds"] },
              "payment.status": "completed",
            },
          },
        ],
        as: "claims",
      },
    },
    {
      $project: {
        name: 1,
        status: 1,
        difficulty: 1,
        featured: 1,
        chronicleCount: { $size: "$chronicles" },
        fragmentCount: { $size: "$fragments" },
        claimCount: { $size: "$claims" },
        totalRevenue: { $sum: "$claims.payment.amount" },
        uniqueKeepers: { $size: { $setUnion: ["$claims.user"] } },
        completionRate: {
          $cond: {
            if: { $gt: [{ $size: "$fragments" }, 0] },
            then: {
              $multiply: [
                {
                  $divide: [
                    {
                      $size: {
                        $filter: {
                          input: "$fragments",
                          as: "f",
                          cond: { $eq: ["$$f.status", "claimed"] },
                        },
                      },
                    },
                    { $size: "$fragments" },
                  ],
                },
                100,
              ],
            },
            else: 0,
          },
        },
      },
    },
    { $sort: { totalRevenue: -1 } },
    { $limit: parseInt(limit) },
  ]);

  // Get monthly trend for each enigma
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const trends = await Claim.aggregate([
    {
      $match: {
        createdAt: { $gte: thirtyDaysAgo },
        "payment.status": "completed",
      },
    },
    {
      $lookup: {
        from: "fragments",
        localField: "fragment",
        foreignField: "_id",
        as: "fragmentInfo",
      },
    },
    { $unwind: "$fragmentInfo" },
    {
      $lookup: {
        from: "chronicles",
        localField: "fragmentInfo.chronicle",
        foreignField: "_id",
        as: "chronicleInfo",
      },
    },
    { $unwind: "$chronicleInfo" },
    {
      $group: {
        _id: {
          enigma: "$chronicleInfo.enigma",
          date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        },
        claims: { $sum: 1 },
        revenue: { $sum: "$payment.amount" },
      },
    },
    {
      $lookup: {
        from: "enigmas",
        localField: "_id.enigma",
        foreignField: "_id",
        as: "enigmaInfo",
      },
    },
    { $unwind: "$enigmaInfo" },
    {
      $project: {
        enigmaName: "$enigmaInfo.name",
        date: "$_id.date",
        claims: 1,
        revenue: 1,
      },
    },
    { $sort: { date: 1 } },
  ]);

  res.json({
    success: true,
    data: {
      performance,
      trends: trends.reduce((acc, item) => {
        if (!acc[item.enigmaName]) {
          acc[item.enigmaName] = [];
        }
        acc[item.enigmaName].push({
          date: item.date,
          claims: item.claims,
          revenue: item.revenue,
        });
        return acc;
      }, {}),
    },
  });
});

// @desc    Get user growth metrics
// @route   GET /api/admin/dashboard/user-growth
// @access  Private/Admin
exports.getUserGrowth = asyncHandler(async (req, res) => {
  const { period = "30days" } = req.query;

  let startDate;
  const endDate = new Date();
  let groupFormat;

  switch (period) {
    case "7days":
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      groupFormat = "%Y-%m-%d";
      break;
    case "30days":
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      groupFormat = "%Y-%m-%d";
      break;
    case "3months":
      startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      groupFormat = "%Y-%m-%d";
      break;
    case "6months":
      startDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
      groupFormat = "%Y-%m";
      break;
    case "year":
      startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      groupFormat = "%Y-%m";
      break;
    default:
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      groupFormat = "%Y-%m-%d";
  }

  const userGrowth = await User.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: groupFormat, date: "$createdAt" } },
        newUsers: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const keeperGrowth = await KeeperProfile.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: groupFormat, date: "$createdAt" } },
        newKeepers: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Get user stats
  const userStats = await User.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        withGoogle: { $sum: { $cond: [{ $ne: ["$googleId", null] }, 1, 0] } },
        verified: { $sum: { $cond: ["$emailVerified", 1, 0] } },
      },
    },
  ]);

  res.json({
    success: true,
    data: {
      period,
      userGrowth: userGrowth.map((item) => ({
        date: item._id,
        newUsers: item.newUsers,
      })),
      keeperGrowth: keeperGrowth.map((item) => ({
        date: item._id,
        newKeepers: item.newKeepers,
      })),
      stats: userStats[0] || { total: 0, withGoogle: 0, verified: 0 },
    },
  });
});

// @desc    Get fragment distribution metrics
// @route   GET /api/admin/dashboard/fragment-distribution
// @access  Private/Admin
exports.getFragmentDistribution = asyncHandler(async (req, res) => {
  const distribution = await Fragment.aggregate([
    {
      $group: {
        _id: {
          rarity: "$rarity",
          status: "$status",
        },
        count: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: "$_id.rarity",
        statuses: {
          $push: {
            status: "$_id.status",
            count: "$count",
          },
        },
        total: { $sum: "$count" },
      },
    },
  ]);

  const byChronicle = await Fragment.aggregate([
    {
      $group: {
        _id: "$chronicle",
        total: { $sum: 1 },
        claimed: {
          $sum: { $cond: [{ $eq: ["$status", "claimed"] }, 1, 0] },
        },
      },
    },
    {
      $lookup: {
        from: "chronicles",
        localField: "_id",
        foreignField: "_id",
        as: "chronicleInfo",
      },
    },
    { $unwind: "$chronicleInfo" },
    {
      $project: {
        chronicleName: "$chronicleInfo.name",
        enigmaId: "$chronicleInfo.enigma",
        total: 1,
        claimed: 1,
        claimRate: {
          $multiply: [{ $divide: ["$claimed", "$total"] }, 100],
        },
      },
    },
    {
      $lookup: {
        from: "enigmas",
        localField: "enigmaId",
        foreignField: "_id",
        as: "enigmaInfo",
      },
    },
    { $unwind: "$enigmaInfo" },
    {
      $project: {
        chronicleName: 1,
        enigmaName: "$enigmaInfo.name",
        total: 1,
        claimed: 1,
        claimRate: { $round: ["$claimRate", 1] },
      },
    },
    { $sort: { total: -1 } },
    { $limit: 10 },
  ]);

  res.json({
    success: true,
    data: {
      byRarity: distribution.map((item) => ({
        rarity: item._id,
        total: item.total,
        statuses: item.statuses.reduce((acc, curr) => {
          acc[curr.status] = curr.count;
          return acc;
        }, {}),
      })),
      topChronicles: byChronicle,
    },
  });
});
