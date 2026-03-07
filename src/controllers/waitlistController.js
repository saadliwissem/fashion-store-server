const Waitlist = require("../models/Waitlist");
const Chronicle = require("../models/Chronicle");
const KeeperProfile = require("../models/KeeperProfile");
const asyncHandler = require("../middleware/async");
const ErrorResponse = require("../utils/ErrorResponse");

// @desc    Join waitlist
// @route   POST /api/waitlist
// @access  Public
exports.joinWaitlist = asyncHandler(async (req, res, next) => {
  const { chronicleId, email, preferences, source } = req.body;

  const chronicle = await Chronicle.findById(chronicleId);
  if (!chronicle) {
    return next(new ErrorResponse("Chronicle not found", 404));
  }

  if (!chronicle.waitlist.enabled) {
    return next(
      new ErrorResponse("Waitlist is not enabled for this chronicle", 400)
    );
  }

  // Check if already on waitlist
  const existing = await Waitlist.findOne({
    chronicle: chronicleId,
    email,
    status: "active",
  });

  if (existing) {
    return next(
      new ErrorResponse(
        "You are already on the waitlist for this chronicle",
        400
      )
    );
  }

  // Check capacity
  if (
    chronicle.waitlist.maxCapacity &&
    chronicle.waitlist.currentCount >= chronicle.waitlist.maxCapacity
  ) {
    return next(new ErrorResponse("Waitlist is at full capacity", 400));
  }

  const waitlistData = {
    chronicle: chronicleId,
    email,
    preferences: {
      notifyOnAvailable: preferences?.notifyOnAvailable ?? true,
      notifyOnNewChronicle: preferences?.notifyOnNewChronicle ?? false,
      notificationMethods: {
        email: preferences?.notificationMethods?.email ?? true,
        sms: preferences?.notificationMethods?.sms ?? false,
      },
    },
    source: source || "organic",
    metadata: {
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
      referrer: req.headers.referer,
    },
  };

  // If user is logged in, link to their account
  if (req.user) {
    waitlistData.user = req.user.id;

    // Update keeper profile
    const keeperProfile = await KeeperProfile.findOne({ user: req.user.id });
    if (keeperProfile) {
      keeperProfile.stats.waitlistEntries += 1;
      await keeperProfile.save();
    }
  }

  const waitlistEntry = await Waitlist.create(waitlistData);

  res.status(201).json({
    success: true,
    data: {
      id: waitlistEntry._id,
      position: waitlistEntry.position,
      chronicle: waitlistEntry.chronicle,
      status: waitlistEntry.status,
      message: "Successfully joined waitlist",
    },
  });
});

// @desc    Get user's position in waitlist
// @route   GET /api/waitlist/position/:chronicleId
// @access  Private
exports.getUserPosition = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    return next(new ErrorResponse("Please log in to check your position", 401));
  }

  const waitlistEntry = await Waitlist.findOne({
    chronicle: req.params.chronicleId,
    user: req.user.id,
    status: "active",
  });

  if (!waitlistEntry) {
    return res.status(200).json({
      success: true,
      data: {
        onWaitlist: false,
        position: null,
      },
    });
  }

  const usersAhead = await Waitlist.countDocuments({
    chronicle: req.params.chronicleId,
    status: "active",
    position: { $lt: waitlistEntry.position },
  });

  res.status(200).json({
    success: true,
    data: {
      onWaitlist: true,
      position: waitlistEntry.position,
      usersAhead,
      estimatedWaitTime: calculateWaitTime(usersAhead), // Helper function
      joinedAt: waitlistEntry.createdAt,
    },
  });
});

// @desc    Get waitlist stats
// @route   GET /api/waitlist/stats/:chronicleId
// @access  Public
exports.getWaitlistStats = asyncHandler(async (req, res, next) => {
  const chronicle = await Chronicle.findById(req.params.chronicleId).select(
    "waitlist stats.requiredFragments stats.fragmentsClaimed estimatedCompletion"
  );

  if (!chronicle) {
    return next(new ErrorResponse("Chronicle not found", 404));
  }

  const stats = await Waitlist.aggregate([
    { $match: { chronicle: chronicle._id, status: "active" } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        avgPosition: { $avg: "$position" },
        maxPosition: { $max: "$position" },
        notificationMethods: {
          $push: "$preferences.notificationMethods",
        },
      },
    },
  ]);

  const lastAvailableFragment =
    chronicle.stats.requiredFragments - chronicle.stats.fragmentsClaimed;

  res.status(200).json({
    success: true,
    data: {
      chronicleId: chronicle._id,
      totalSubscribers: stats[0]?.total || 0,
      lastAvailableFragment:
        lastAvailableFragment > 0 ? lastAvailableFragment : 0,
      averageWaitTime: "2-3 weeks", // Would be calculated from historical data
      nextExpectedRelease: chronicle.estimatedCompletion,
      notificationBreakdown: {
        email: stats[0]?.notificationMethods.filter((n) => n.email).length || 0,
        sms: stats[0]?.notificationMethods.filter((n) => n.sms).length || 0,
      },
    },
  });
});

// @desc    Leave waitlist
// @route   DELETE /api/waitlist/:id
// @access  Private
exports.leaveWaitlist = asyncHandler(async (req, res, next) => {
  const waitlistEntry = await Waitlist.findById(req.params.id);

  if (!waitlistEntry) {
    return next(new ErrorResponse("Waitlist entry not found", 404));
  }

  // Check ownership
  if (waitlistEntry.user && waitlistEntry.user.toString() !== req.user.id) {
    return next(new ErrorResponse("Not authorized", 403));
  }

  waitlistEntry.status = "cancelled";
  await waitlistEntry.save();

  res.status(200).json({
    success: true,
    data: {},
    message: "Successfully removed from waitlist",
  });
});

// @desc    Update notification preferences
// @route   PATCH /api/waitlist/:id/preferences
// @access  Private
exports.updatePreferences = asyncHandler(async (req, res, next) => {
  const waitlistEntry = await Waitlist.findById(req.params.id);

  if (!waitlistEntry) {
    return next(new ErrorResponse("Waitlist entry not found", 404));
  }

  // Check ownership
  if (waitlistEntry.user && waitlistEntry.user.toString() !== req.user.id) {
    return next(new ErrorResponse("Not authorized", 403));
  }

  waitlistEntry.preferences = {
    ...waitlistEntry.preferences,
    ...req.body,
  };

  await waitlistEntry.save();

  res.status(200).json({
    success: true,
    data: waitlistEntry.preferences,
  });
});

// Helper function to calculate estimated wait time
const calculateWaitTime = (usersAhead) => {
  // This would be more sophisticated in production
  // Based on historical claim rates, production schedules, etc.
  const averageClaimsPerWeek = 5;
  const weeksEstimate = Math.ceil(usersAhead / averageClaimsPerWeek);

  if (weeksEstimate === 0) return "Very soon";
  if (weeksEstake === 1) return "About 1 week";
  return `About ${weeksEstimate} weeks`;
};
