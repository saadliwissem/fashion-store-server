const Waitlist = require("../models/Waitlist");
const Chronicle = require("../models/Chronicle");
const User = require("../models/User");
const mongoose = require("mongoose");
const asyncHandler = require("../middleware/async");
const ErrorResponse = require("../utils/ErrorResponse");

// @desc    Get all waitlist entries with filtering and pagination
// @route   GET /api/admin/waitlist
// @access  Private/Admin
exports.getWaitlistEntries = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    sort = "-createdAt",
    status,
    chronicleId,
    source,
    search,
    startDate,
    endDate,
    notified,
  } = req.query;

  const query = {};

  // Filter by status
  if (status) query.status = status;

  // Filter by chronicle
  if (chronicleId) query.chronicle = chronicleId;

  // Filter by source
  if (source) query.source = source;

  // Filter by notified status
  if (notified !== undefined) {
    if (notified === "true") {
      query.notifiedAt = { $ne: null };
    } else if (notified === "false") {
      query.notifiedAt = null;
    }
  }

  // Filter by date range
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  // Search by email or user name
  if (search) {
    // First find users matching the search
    const users = await User.find({
      $or: [
        { email: { $regex: search, $options: "i" } },
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
      ],
    }).distinct("_id");

    query.$or = [
      { email: { $regex: search, $options: "i" } },
      { user: { $in: users } },
    ];
  }

  const entries = await Waitlist.find(query)
    .populate(
      "chronicle",
      "name enigma productionStatus stats.requiredFragments stats.fragmentsClaimed"
    )
    .populate("user", "firstName lastName email phone")
    .sort(sort)
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

  const total = await Waitlist.countDocuments(query);

  // Get position statistics for the filtered results
  const positionStats = await Waitlist.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        avgPosition: { $avg: "$position" },
        minPosition: { $min: "$position" },
        maxPosition: { $max: "$position" },
      },
    },
  ]);

  res.json({
    success: true,
    count: entries.length,
    total,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    },
    data: entries,
    positionStats: positionStats[0] || {
      avgPosition: 0,
      minPosition: 0,
      maxPosition: 0,
    },
  });
});

// @desc    Get single waitlist entry
// @route   GET /api/admin/waitlist/:id
// @access  Private/Admin
exports.getWaitlistEntry = asyncHandler(async (req, res) => {
  const entry = await Waitlist.findById(req.params.id)
    .populate({
      path: "chronicle",
      populate: {
        path: "enigma",
        select: "name description",
      },
    })
    .populate("user", "firstName lastName email phone createdAt");

  if (!entry) {
    return res.status(404).json({
      success: false,
      message: "Waitlist entry not found",
    });
  }

  // Calculate users ahead
  const usersAhead = await Waitlist.countDocuments({
    chronicle: entry.chronicle._id,
    status: "active",
    position: { $lt: entry.position },
  });

  const responseData = entry.toObject();
  responseData.usersAhead = usersAhead;
  responseData.estimatedWaitTime = calculateEstimatedWaitTime(usersAhead);

  res.json({
    success: true,
    data: responseData,
  });
});

// @desc    Update waitlist entry
// @route   PUT /api/admin/waitlist/:id
// @access  Private/Admin
exports.updateWaitlistEntry = asyncHandler(async (req, res) => {
  const { preferences, status, notes } = req.body;

  const entry = await Waitlist.findById(req.params.id);

  if (!entry) {
    return res.status(404).json({
      success: false,
      message: "Waitlist entry not found",
    });
  }

  // Update preferences if provided
  if (preferences) {
    entry.preferences = {
      ...entry.preferences,
      ...preferences,
    };
  }

  // Update status if provided
  if (status && status !== entry.status) {
    entry.status = status;

    // If status changed to fulfilled, set fulfilledAt
    if (status === "fulfilled") {
      entry.fulfilledAt = new Date();
    }

    // If status changed to notified, set notifiedAt
    if (status === "notified" && !entry.notifiedAt) {
      entry.notifiedAt = new Date();
    }

    // If status changed to cancelled or expired, decrease chronicle waitlist count
    if (
      (status === "cancelled" || status === "expired") &&
      entry.status !== status
    ) {
      await Chronicle.findByIdAndUpdate(entry.chronicle, {
        $inc: { "waitlist.currentCount": -1 },
      });
    }
  }

  // Add admin note if provided
  if (notes) {
    if (!entry.adminNotes) entry.adminNotes = [];
    entry.adminNotes.push({
      text: notes,
      addedBy: req.user.id,
      addedAt: new Date(),
    });
  }

  await entry.save();

  res.json({
    success: true,
    data: entry,
  });
});

// @desc    Delete waitlist entry
// @route   DELETE /api/admin/waitlist/:id
// @access  Private/Admin
exports.deleteWaitlistEntry = asyncHandler(async (req, res) => {
  const entry = await Waitlist.findById(req.params.id);

  if (!entry) {
    return res.status(404).json({
      success: false,
      message: "Waitlist entry not found",
    });
  }

  // Decrease chronicle waitlist count if entry was active
  if (entry.status === "active") {
    await Chronicle.findByIdAndUpdate(entry.chronicle, {
      $inc: { "waitlist.currentCount": -1 },
    });
  }

  await entry.deleteOne();

  res.json({
    success: true,
    data: {},
  });
});

// @desc    Bulk update waitlist entries
// @route   PUT /api/admin/waitlist/bulk
// @access  Private/Admin
exports.bulkUpdateWaitlist = asyncHandler(async (req, res) => {
  const { entryIds, updateData } = req.body;

  if (!entryIds || !Array.isArray(entryIds) || entryIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Please provide an array of entry IDs",
    });
  }

  const entries = await Waitlist.find({ _id: { $in: entryIds } });

  // If updating status, handle chronicle counts
  if (updateData.status) {
    const activeEntries = entries.filter((e) => e.status === "active");
    const willBeActive = updateData.status === "active";

    // If changing from active to something else
    if (!willBeActive) {
      for (const entry of activeEntries) {
        await Chronicle.findByIdAndUpdate(entry.chronicle, {
          $inc: { "waitlist.currentCount": -1 },
        });
      }
    }
  }

  const result = await Waitlist.updateMany(
    { _id: { $in: entryIds } },
    updateData,
    { runValidators: true }
  );

  res.json({
    success: true,
    data: {
      matched: result.matchedCount,
      modified: result.modifiedCount,
    },
  });
});

// @desc    Get waitlist stats for dashboard
// @route   GET /api/admin/waitlist/stats
// @access  Private/Admin
exports.getWaitlistStats = asyncHandler(async (req, res) => {
  const [
    totalActive,
    totalNotified,
    totalFulfilled,
    totalExpired,
    byChronicle,
    bySource,
    averageWaitTime,
  ] = await Promise.all([
    // Total active entries
    Waitlist.countDocuments({ status: "active" }),

    // Total notified entries
    Waitlist.countDocuments({ status: "notified" }),

    // Total fulfilled entries
    Waitlist.countDocuments({ status: "fulfilled" }),

    // Total expired entries
    Waitlist.countDocuments({ status: "expired" }),

    // Waitlist by chronicle
    Waitlist.aggregate([
      { $match: { status: "active" } },
      {
        $group: {
          _id: "$chronicle",
          count: { $sum: 1 },
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
      {
        $project: {
          count: 1,
          avgPosition: 1,
          name: { $arrayElemAt: ["$chronicleInfo.name", 0] },
        },
      },
      { $sort: { count: -1 } },
    ]),

    // Waitlist by source
    Waitlist.aggregate([
      { $match: { status: "active" } },
      {
        $group: {
          _id: "$source",
          count: { $sum: 1 },
        },
      },
    ]),

    // Average wait time (based on fulfilled entries)
    Waitlist.aggregate([
      {
        $match: {
          status: "fulfilled",
          fulfilledAt: { $ne: null },
          createdAt: { $ne: null },
        },
      },
      {
        $project: {
          waitTime: {
            $divide: [
              { $subtract: ["$fulfilledAt", "$createdAt"] },
              1000 * 60 * 60 * 24, // Convert to days
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgWaitDays: { $avg: "$waitTime" },
        },
      },
    ]),
  ]);

  // Format by source object
  const bySourceObj = {
    organic: 0,
    referral: 0,
    campaign: 0,
  };
  bySource.forEach((item) => {
    bySourceObj[item._id] = item.count;
  });

  // Format by chronicle object
  const byChronicleObj = {};
  byChronicle.forEach((item) => {
    byChronicleObj[item._id] = {
      name: item.name || "Unknown Chronicle",
      count: item.count,
      avgPosition: Math.round(item.avgPosition * 10) / 10,
    };
  });

  res.json({
    success: true,
    data: {
      totalActive,
      totalNotified,
      totalFulfilled,
      totalExpired,
      byChronicle: byChronicleObj,
      bySource: bySourceObj,
      averageWaitTime: averageWaitTime[0]?.avgWaitDays
        ? `${Math.round(averageWaitTime[0].avgWaitDays)} days`
        : "2-3 weeks",
    },
  });
});

// @desc    Send notifications to waitlist users
// @route   POST /api/admin/waitlist/notify
// @access  Private/Admin
exports.notifyWaitlist = asyncHandler(async (req, res) => {
  const {
    entryIds,
    message,
    subject,
    type = "availability",
    sendEmail = true,
    sendSms = false,
  } = req.body;

  if (!entryIds || !Array.isArray(entryIds) || entryIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Please provide an array of entry IDs",
    });
  }

  const entries = await Waitlist.find({
    _id: { $in: entryIds },
    status: "active",
  })
    .populate("user")
    .populate("chronicle");

  const notifications = [];
  const now = new Date();

  for (const entry of entries) {
    // Prepare notification data
    const notificationData = {
      email: entry.email,
      userId: entry.user?._id,
      chronicleName: entry.chronicle?.name,
      position: entry.position,
      type,
      subject: subject || getDefaultSubject(type),
      message: personalizeMessage(message, {
        name: entry.user
          ? `${entry.user.firstName} ${entry.user.lastName}`
          : "Valued Keeper",
        email: entry.email,
        position: entry.position,
        chronicleName: entry.chronicle?.name,
        enigmaName: entry.chronicle?.enigma?.name,
      }),
    };

    // Here you would integrate with your email/SMS service
    // For now, we'll just log and update the entry
    console.log(
      `Notification would be sent to ${entry.email}:`,
      notificationData
    );

    // Update entry as notified
    entry.status = "notified";
    entry.notifiedAt = now;
    await entry.save();

    notifications.push({
      entryId: entry._id,
      email: entry.email,
      status: "queued",
    });
  }

  res.json({
    success: true,
    data: {
      total: entries.length,
      notifications,
    },
  });
});

// @desc    Clear waitlist for a chronicle
// @route   POST /api/admin/waitlist/clear/:chronicleId
// @access  Private/Admin
exports.clearWaitlist = asyncHandler(async (req, res) => {
  const { chronicleId } = req.params;
  const { action = "expire" } = req.body; // 'expire' or 'delete'

  const chronicle = await Chronicle.findById(chronicleId);
  if (!chronicle) {
    return res.status(404).json({
      success: false,
      message: "Chronicle not found",
    });
  }

  let result;

  if (action === "expire") {
    // Mark all active entries as expired
    result = await Waitlist.updateMany(
      { chronicle: chronicleId, status: "active" },
      {
        status: "expired",
        expiresAt: new Date(),
      }
    );
  } else {
    // Delete all waitlist entries for this chronicle
    result = await Waitlist.deleteMany({ chronicle: chronicleId });
  }

  // Reset chronicle waitlist count
  chronicle.waitlist.currentCount = 0;
  await chronicle.save();

  res.json({
    success: true,
    data: {
      action,
      matched: result.matchedCount || result.deletedCount,
      modified: result.modifiedCount || 0,
    },
  });
});

// @desc    Get waitlist by chronicle
// @route   GET /api/admin/waitlist/chronicle/:chronicleId
// @access  Private/Admin
exports.getChronicleWaitlist = asyncHandler(async (req, res) => {
  const { chronicleId } = req.params;
  const { page = 1, limit = 20, status = "active" } = req.query;

  const entries = await Waitlist.find({
    chronicle: chronicleId,
    status,
  })
    .populate("user", "firstName lastName email")
    .sort("position")
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

  const total = await Waitlist.countDocuments({
    chronicle: chronicleId,
    status,
  });

  // Get position distribution
  const distribution = await Waitlist.aggregate([
    {
      $match: {
        chronicle: mongoose.Types.ObjectId(chronicleId),
        status: "active",
      },
    },
    {
      $bucket: {
        groupBy: "$position",
        boundaries: [1, 11, 26, 51, 101, Infinity],
        default: "100+",
        output: {
          count: { $sum: 1 },
        },
      },
    },
  ]);

  res.json({
    success: true,
    count: entries.length,
    total,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    },
    data: entries,
    distribution,
  });
});

// @desc    Update position for waitlist entries (reorder)
// @route   PUT /api/admin/waitlist/reorder
// @access  Private/Admin
exports.reorderWaitlist = asyncHandler(async (req, res) => {
  const { entries } = req.body; // Array of { id, position }

  if (!Array.isArray(entries)) {
    return res.status(400).json({
      success: false,
      message: "Please provide an array of entries with positions",
    });
  }

  const operations = entries.map((entry) => ({
    updateOne: {
      filter: { _id: entry.id },
      update: { position: entry.position },
    },
  }));

  await Waitlist.bulkWrite(operations);

  res.json({
    success: true,
    data: { message: "Waitlist reordered successfully" },
  });
});

// @desc    Export waitlist
// @route   GET /api/admin/waitlist/export
// @access  Private/Admin
exports.exportWaitlist = asyncHandler(async (req, res) => {
  const { format = "json", chronicleId, status = "active" } = req.query;

  const query = { status };
  if (chronicleId) query.chronicle = chronicleId;

  const entries = await Waitlist.find(query)
    .populate("chronicle", "name enigma")
    .populate("user", "firstName lastName email phone")
    .lean();

  if (format === "csv") {
    // Flatten data for CSV
    const flattened = entries.map((e) => ({
      email: e.email,
      name: e.user ? `${e.user.firstName} ${e.user.lastName}` : "Anonymous",
      phone:
        e.user?.phone || e.preferences?.notificationMethods?.sms
          ? "Has SMS"
          : "No SMS",
      chronicle: e.chronicle?.name,
      position: e.position,
      status: e.status,
      joined: e.createdAt.toISOString().split("T")[0],
      source: e.source,
      notifyAvailable: e.preferences?.notifyOnAvailable ? "Yes" : "No",
      notifyNew: e.preferences?.notifyOnNewChronicle ? "Yes" : "No",
    }));

    // Convert to CSV
    const headers = Object.keys(flattened[0]).join(",");
    const rows = flattened
      .map((item) =>
        Object.values(item)
          .map((val) =>
            typeof val === "string" && val.includes(",") ? `"${val}"` : val
          )
          .join(",")
      )
      .join("\n");
    const csv = `${headers}\n${rows}`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=waitlist-export-${Date.now()}.csv`
    );
    return res.send(csv);
  }

  // Default JSON export
  res.setHeader("Content-Type", "application/json");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=waitlist-export-${Date.now()}.json`
  );
  res.json(entries);
});

// Helper function to calculate estimated wait time
const calculateEstimatedWaitTime = (usersAhead) => {
  if (usersAhead <= 0) return "Very soon";
  if (usersAhead <= 10) return "1-2 weeks";
  if (usersAhead <= 30) return "3-4 weeks";
  if (usersAhead <= 50) return "5-8 weeks";
  if (usersAhead <= 100) return "2-3 months";
  return "3+ months";
};

// Helper function to get default subject based on notification type
const getDefaultSubject = (type) => {
  const subjects = {
    availability: "🎉 Fragment Now Available!",
    newChronicle: "✨ New Chronicle Released!",
    position: "📊 Your Waitlist Position Update",
    reminder: "⏰ Waitlist Reminder",
    general: "📧 Update from Puzzle Mysteries",
  };
  return subjects[type] || subjects.general;
};

// Helper function to personalize message
const personalizeMessage = (template, data) => {
  if (!template) return "";

  return template
    .replace(/\[NAME\]/g, data.name)
    .replace(/\[EMAIL\]/g, data.email)
    .replace(/\[POSITION\]/g, data.position)
    .replace(/\[CHRONICLE\]/g, data.chronicleName)
    .replace(/\[ENIGMA\]/g, data.enigmaName);
};
