const Claim = require("../models/Claim");
const Fragment = require("../models/Fragment");
const User = require("../models/User");
const mongoose = require("mongoose");
const asyncHandler = require("../middleware/async");
const ErrorResponse = require("../utils/ErrorResponse");

// @desc    Get all claims with filtering and pagination
// @route   GET /api/admin/claims
// @access  Private/Admin
exports.getClaims = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    sort = "-createdAt",
    status,
    paymentStatus,
    search,
    startDate,
    endDate,
    chronicleId,
    fragmentId,
  } = req.query;

  const query = {};

  // Filter by status
  if (status) query.status = status;

  // Filter by payment status
  if (paymentStatus) query["payment.status"] = paymentStatus;

  // Filter by date range
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  // Filter by fragment or chronicle
  if (fragmentId) {
    query.fragment = fragmentId;
  } else if (chronicleId) {
    // Find fragments in this chronicle first
    const fragments = await Fragment.find({ chronicle: chronicleId }).distinct(
      "_id"
    );
    query.fragment = { $in: fragments };
  }

  // Search by claim ID, user email, or name
  if (search) {
    query.$or = [
      { claimId: { $regex: search, $options: "i" } },
      { "userData.fullName": { $regex: search, $options: "i" } },
      { "userData.email": { $regex: search, $options: "i" } },
      { "userData.phone": { $regex: search, $options: "i" } },
    ];
  }

  const claims = await Claim.find(query)
    .populate("fragment", "name number imageUrl rarity chronicle")
    .populate("user", "firstName lastName email")
    .sort(sort)
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

  const total = await Claim.countDocuments(query);

  // Get summary statistics for the filtered results
  const stats = await Claim.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: "$payment.amount" },
        avgAmount: { $avg: "$payment.amount" },
        minAmount: { $min: "$payment.amount" },
        maxAmount: { $max: "$payment.amount" },
      },
    },
  ]);

  res.json({
    success: true,
    count: claims.length,
    total,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    },
    data: claims,
    summary: stats[0] || { totalAmount: 0, avgAmount: 0 },
  });
});

// @desc    Get single claim
// @route   GET /api/admin/claims/:id
// @access  Private/Admin
exports.getClaim = asyncHandler(async (req, res) => {
  const claim = await Claim.findById(req.params.id)
    .populate({
      path: "fragment",
      populate: {
        path: "chronicle",
        populate: {
          path: "enigma",
        },
      },
    })
    .populate("user", "firstName lastName email phone createdAt")
    .populate("adminNotes.addedBy", "firstName lastName email");

  if (!claim) {
    return res.status(404).json({
      success: false,
      message: "Claim not found",
    });
  }

  res.json({
    success: true,
    data: claim,
  });
});

// @desc    Update claim
// @route   PUT /api/admin/claims/:id
// @access  Private/Admin
exports.updateClaim = asyncHandler(async (req, res) => {
  const { userData, payment, trackingInfo, notes } = req.body;

  const claim = await Claim.findById(req.params.id);

  if (!claim) {
    return res.status(404).json({
      success: false,
      message: "Claim not found",
    });
  }

  // Update fields if provided
  if (userData) claim.userData = { ...claim.userData, ...userData };
  if (payment) claim.payment = { ...claim.payment, ...payment };
  if (trackingInfo)
    claim.trackingInfo = { ...claim.trackingInfo, ...trackingInfo };
  if (notes) {
    claim.adminNotes.push({
      text: notes,
      addedBy: req.user.id,
      addedAt: new Date(),
    });
  }

  await claim.save();

  res.json({
    success: true,
    data: claim,
  });
});

// @desc    Delete claim
// @route   DELETE /api/admin/claims/:id
// @access  Private/Admin
exports.deleteClaim = asyncHandler(async (req, res) => {
  const claim = await Claim.findById(req.params.id);

  if (!claim) {
    return res.status(404).json({
      success: false,
      message: "Claim not found",
    });
  }

  // If claim was confirmed, we need to update the fragment status back to available
  if (
    claim.status === "confirmed" ||
    claim.status === "processing" ||
    claim.status === "shipped" ||
    claim.status === "delivered"
  ) {
    await Fragment.findByIdAndUpdate(claim.fragment, {
      status: "available",
      claimedBy: null,
      claimedAt: null,
    });
  }

  await claim.deleteOne();

  res.json({
    success: true,
    data: {},
  });
});

// @desc    Bulk update claims
// @route   PUT /api/admin/claims/bulk
// @access  Private/Admin
exports.bulkUpdateClaims = asyncHandler(async (req, res) => {
  const { claimIds, updateData } = req.body;

  if (!claimIds || !Array.isArray(claimIds) || claimIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Please provide an array of claim IDs",
    });
  }

  const result = await Claim.updateMany(
    { _id: { $in: claimIds } },
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

// @desc    Get claim stats for dashboard
// @route   GET /api/admin/claims/stats
// @access  Private/Admin
exports.getClaimStats = asyncHandler(async (req, res) => {
  const [totalClaims, byStatus, totalValue, recentActivity, paymentStats] =
    await Promise.all([
      // Total claims count
      Claim.countDocuments(),

      // Claims by status
      Claim.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),

      // Total value of all claims
      Claim.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: "$payment.amount" },
            average: { $avg: "$payment.amount" },
          },
        },
      ]),

      // Recent activity (last 30 days)
      Claim.aggregate([
        {
          $match: {
            createdAt: {
              $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: 30 },
      ]),

      // Payment method stats
      Claim.aggregate([
        {
          $group: {
            _id: "$payment.method",
            count: { $sum: 1 },
            total: { $sum: "$payment.amount" },
          },
        },
      ]),
    ]);

  // Format by status object
  const byStatusObj = {};
  byStatus.forEach((item) => {
    byStatusObj[item._id] = item.count;
  });

  // Format payment stats
  const paymentStatsObj = {};
  paymentStats.forEach((item) => {
    paymentStatsObj[item._id] = {
      count: item.count,
      total: item.total,
    };
  });

  res.json({
    success: true,
    data: {
      totalClaims,
      byStatus: {
        pending: byStatusObj.pending || 0,
        confirmed: byStatusObj.confirmed || 0,
        processing: byStatusObj.processing || 0,
        shipped: byStatusObj.shipped || 0,
        delivered: byStatusObj.delivered || 0,
        cancelled: byStatusObj.cancelled || 0,
      },
      totalValue: totalValue[0]?.total || 0,
      averageValue: totalValue[0]?.average || 0,
      recentActivity: recentActivity.map((item) => ({
        date: item._id,
        count: item.count,
      })),
      paymentMethods: paymentStatsObj,
    },
  });
});

// @desc    Export claims
// @route   GET /api/admin/claims/export
// @access  Private/Admin
exports.exportClaims = asyncHandler(async (req, res) => {
  const { format = "json", startDate, endDate, status } = req.query;

  const query = {};
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }
  if (status) query.status = status;

  const claims = await Claim.find(query)
    .populate("fragment", "name number rarity")
    .populate("user", "firstName lastName email")
    .lean();

  if (format === "csv") {
    // Flatten data for CSV
    const flattened = claims.map((c) => ({
      claimId: c.claimId,
      date: c.createdAt.toISOString().split("T")[0],
      customerName: c.userData?.fullName,
      customerEmail: c.userData?.email,
      customerPhone: c.userData?.phone,
      fragmentName: c.fragment?.name,
      fragmentNumber: c.fragment?.number,
      amount: c.payment?.amount,
      currency: c.payment?.currency,
      paymentMethod: c.payment?.method,
      paymentStatus: c.payment?.status,
      claimStatus: c.status,
      shippingAddress: `${c.userData?.shippingAddress?.address}, ${c.userData?.shippingAddress?.city}, ${c.userData?.shippingAddress?.country}`,
      trackingNumber: c.trackingInfo?.trackingNumber,
      carrier: c.trackingInfo?.carrier,
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
      `attachment; filename=claims-export-${Date.now()}.csv`
    );
    return res.send(csv);
  }

  // Default JSON export
  res.setHeader("Content-Type", "application/json");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=claims-export-${Date.now()}.json`
  );
  res.json(claims);
});

// @desc    Update claim status
// @route   PUT /api/admin/claims/:id/status
// @access  Private/Admin
exports.updateClaimStatus = asyncHandler(async (req, res) => {
  const { status, notes, notifyCustomer, sendEmail } = req.body;

  const claim = await Claim.findById(req.params.id);

  if (!claim) {
    return res.status(404).json({
      success: false,
      message: "Claim not found",
    });
  }

  const oldStatus = claim.status;
  claim.status = status;

  // Add admin note
  if (notes) {
    claim.adminNotes.push({
      text: notes,
      addedBy: req.user.id,
      addedAt: new Date(),
    });
  }

  // If status changed to confirmed, update fragment status
  if (status === "confirmed" && oldStatus !== "confirmed") {
    await Fragment.findByIdAndUpdate(claim.fragment, {
      status: "claimed",
      claimedBy: claim.user,
      claimedAt: new Date(),
    });
  }

  // If status changed to cancelled and it was previously confirmed, free up the fragment
  if (
    status === "cancelled" &&
    (oldStatus === "confirmed" || oldStatus === "processing")
  ) {
    await Fragment.findByIdAndUpdate(claim.fragment, {
      status: "available",
      claimedBy: null,
      claimedAt: null,
    });
  }

  await claim.save();

  // Here you would trigger notifications if notifyCustomer or sendEmail are true
  if (notifyCustomer || sendEmail) {
    // Trigger email/sms notifications
    // This would integrate with your notification service
    console.log(
      `Notification would be sent to ${claim.userData.email} about status change to ${status}`
    );
  }

  res.json({
    success: true,
    data: claim,
  });
});

// @desc    Update payment status
// @route   PUT /api/admin/claims/:id/payment
// @access  Private/Admin
exports.updatePaymentStatus = asyncHandler(async (req, res) => {
  const { status, transactionId, notes } = req.body;

  const claim = await Claim.findById(req.params.id);

  if (!claim) {
    return res.status(404).json({
      success: false,
      message: "Claim not found",
    });
  }

  claim.payment.status = status;
  if (transactionId) claim.payment.transactionId = transactionId;
  if (status === "completed") {
    claim.payment.paidAt = new Date();
  }

  // Add admin note
  if (notes) {
    claim.adminNotes.push({
      text: `Payment status updated to ${status}: ${notes}`,
      addedBy: req.user.id,
      addedAt: new Date(),
    });
  }

  await claim.save();

  res.json({
    success: true,
    data: claim,
  });
});

// @desc    Add tracking information
// @route   PUT /api/admin/claims/:id/tracking
// @access  Private/Admin
exports.addTracking = asyncHandler(async (req, res) => {
  const { carrier, trackingNumber, estimatedDelivery, notes } = req.body;

  const claim = await Claim.findById(req.params.id);

  if (!claim) {
    return res.status(404).json({
      success: false,
      message: "Claim not found",
    });
  }

  claim.trackingInfo = {
    carrier,
    trackingNumber,
    estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery) : null,
    shippedAt: new Date(),
  };

  // Update status to shipped if it's not already
  if (claim.status !== "shipped" && claim.status !== "delivered") {
    claim.status = "shipped";
  }

  // Add admin note
  if (notes) {
    claim.adminNotes.push({
      text: `Tracking added: ${carrier} - ${trackingNumber}. ${notes || ""}`,
      addedBy: req.user.id,
      addedAt: new Date(),
    });
  }

  await claim.save();

  res.json({
    success: true,
    data: claim,
  });
});

// @desc    Mark as delivered
// @route   PUT /api/admin/claims/:id/delivered
// @access  Private/Admin
exports.markAsDelivered = asyncHandler(async (req, res) => {
  const { deliveryConfirmation, notes } = req.body;

  const claim = await Claim.findById(req.params.id);

  if (!claim) {
    return res.status(404).json({
      success: false,
      message: "Claim not found",
    });
  }

  claim.status = "delivered";
  if (claim.trackingInfo) {
    claim.trackingInfo.deliveredAt = new Date();
    if (deliveryConfirmation) {
      claim.trackingInfo.deliveryConfirmation = deliveryConfirmation;
    }
  }

  // Add admin note
  if (notes) {
    claim.adminNotes.push({
      text: `Marked as delivered. ${notes || ""}`,
      addedBy: req.user.id,
      addedAt: new Date(),
    });
  }

  await claim.save();

  res.json({
    success: true,
    data: claim,
  });
});

// @desc    Get claims by user
// @route   GET /api/admin/claims/user/:userId
// @access  Private/Admin
exports.getUserClaims = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  const claims = await Claim.find({ user: userId })
    .populate("fragment", "name number imageUrl rarity")
    .sort("-createdAt")
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

  const total = await Claim.countDocuments({ user: userId });

  res.json({
    success: true,
    count: claims.length,
    total,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    },
    data: claims,
  });
});

// @desc    Get claims by fragment
// @route   GET /api/admin/claims/fragment/:fragmentId
// @access  Private/Admin
exports.getFragmentClaims = asyncHandler(async (req, res) => {
  const { fragmentId } = req.params;

  const claims = await Claim.find({ fragment: fragmentId })
    .populate("user", "firstName lastName email")
    .sort("-createdAt");

  res.json({
    success: true,
    count: claims.length,
    data: claims,
  });
});

// @desc    Add admin note to claim
// @route   POST /api/admin/claims/:id/notes
// @access  Private/Admin
exports.addNote = asyncHandler(async (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({
      success: false,
      message: "Note text is required",
    });
  }

  const claim = await Claim.findById(req.params.id);

  if (!claim) {
    return res.status(404).json({
      success: false,
      message: "Claim not found",
    });
  }

  claim.adminNotes.push({
    text,
    addedBy: req.user.id,
    addedAt: new Date(),
  });

  await claim.save();

  res.json({
    success: true,
    data: claim.adminNotes[claim.adminNotes.length - 1],
  });
});

// @desc    Get sales report
// @route   GET /api/admin/claims/reports/sales
// @access  Private/Admin
exports.getSalesReport = asyncHandler(async (req, res) => {
  const { startDate, endDate, groupBy = "day" } = req.query;

  const start = startDate
    ? new Date(startDate)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  let groupFormat;
  switch (groupBy) {
    case "day":
      groupFormat = "%Y-%m-%d";
      break;
    case "week":
      groupFormat = "%Y-%U";
      break;
    case "month":
      groupFormat = "%Y-%m";
      break;
    default:
      groupFormat = "%Y-%m-%d";
  }

  const salesData = await Claim.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
        "payment.status": "completed",
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: groupFormat, date: "$createdAt" } },
        count: { $sum: 1 },
        total: { $sum: "$payment.amount" },
        average: { $avg: "$payment.amount" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const summary = await Claim.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
        "payment.status": "completed",
      },
    },
    {
      $group: {
        _id: null,
        totalSales: { $sum: "$payment.amount" },
        totalOrders: { $sum: 1 },
        averageOrderValue: { $avg: "$payment.amount" },
      },
    },
  ]);

  res.json({
    success: true,
    data: {
      period: {
        start,
        end,
      },
      salesData,
      summary: summary[0] || {
        totalSales: 0,
        totalOrders: 0,
        averageOrderValue: 0,
      },
    },
  });
});
