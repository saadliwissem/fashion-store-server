const asyncHandler = require("express-async-handler");
const User = require("../models/User");
const Product = require("../models/Product");
const Category = require("../models/Category");
const Order = require("../models/Order");
const Review = require("../models/Review");
const Coupon = require("../models/Coupon");

// @desc    Get admin dashboard stats
// @route   GET /api/admin/dashboard
// @access  Private/Admin
const getDashboardStats = asyncHandler(async (req, res) => {
  // Get date ranges
  const today = new Date();
  const startOfToday = new Date(today.setHours(0, 0, 0, 0));
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - 7);
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfYear = new Date(today.getFullYear(), 0, 1);

  // Today's stats
  const todayOrders = await Order.countDocuments({
    createdAt: { $gte: startOfToday },
  });

  const todayRevenue = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startOfToday },
        paymentStatus: "paid",
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$total" },
      },
    },
  ]);

  const todayCustomers = await User.countDocuments({
    createdAt: { $gte: startOfToday },
    role: "customer",
  });

  // Weekly stats
  const weeklyOrders = await Order.countDocuments({
    createdAt: { $gte: startOfWeek },
  });

  const weeklyRevenue = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startOfWeek },
        paymentStatus: "paid",
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$total" },
      },
    },
  ]);

  // Monthly stats
  const monthlyOrders = await Order.countDocuments({
    createdAt: { $gte: startOfMonth },
  });

  const monthlyRevenue = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startOfMonth },
        paymentStatus: "paid",
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$total" },
      },
    },
  ]);

  // Overall stats
  const totalOrders = await Order.countDocuments();
  const totalCustomers = await User.countDocuments({ role: "customer" });
  const totalProducts = await Product.countDocuments();
  const totalRevenue = await Order.aggregate([
    {
      $match: { paymentStatus: "paid" },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$total" },
      },
    },
  ]);

  // Recent orders
  const recentOrders = await Order.find()
    .sort({ createdAt: -1 })
    .limit(10)
    .populate("user", "firstName lastName email")
    .lean();

  // Top products
  const topProducts = await Product.find()
    .sort({ purchaseCount: -1 })
    .limit(5)
    .select("name price images purchaseCount averageRating")
    .lean();

  // Low stock products
  const lowStockProducts = await Product.find({
    $expr: { $lte: ["$stock", "$lowStockThreshold"] },
    status: { $in: ["active", "draft"] },
  })
    .sort({ stock: 1 })
    .limit(10)
    .select("name price images stock lowStockThreshold")
    .lean();

  // Order status distribution
  const orderStatusDistribution = await Order.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  // Payment method distribution
  const paymentMethodDistribution = await Order.aggregate([
    {
      $group: {
        _id: "$paymentMethod",
        count: { $sum: 1 },
        revenue: { $sum: "$total" },
      },
    },
  ]);

  res.json({
    success: true,
    stats: {
      today: {
        orders: todayOrders,
        revenue: todayRevenue[0]?.total || 0,
        customers: todayCustomers,
      },
      weekly: {
        orders: weeklyOrders,
        revenue: weeklyRevenue[0]?.total || 0,
      },
      monthly: {
        orders: monthlyOrders,
        revenue: monthlyRevenue[0]?.total || 0,
      },
      overall: {
        orders: totalOrders,
        customers: totalCustomers,
        products: totalProducts,
        revenue: totalRevenue[0]?.total || 0,
      },
    },
    recentOrders,
    topProducts,
    lowStockProducts,
    distributions: {
      orderStatus: orderStatusDistribution,
      paymentMethod: paymentMethodDistribution,
    },
  });
});

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private/Admin
const getUsers = asyncHandler(async (req, res) => {
  const pageSize = 20;
  const page = Number(req.query.page) || 1;
  const search = req.query.search;
  const role = req.query.role;
  const status = req.query.status;

  // Build query
  let query = { role: { $ne: "admin" } }; // Don't show admins

  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: "i" } },
      { lastName: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  if (role && role !== "all") {
    query.role = role;
  }

  if (status && status !== "all") {
    query.status = status;
  }

  // Execute query
  const count = await User.countDocuments(query);
  const users = await User.find(query)
    .select(
      "firstName lastName email phone role status orderCount totalSpent createdAt lastLogin"
    )
    .sort({ createdAt: -1 })
    .limit(pageSize)
    .skip(pageSize * (page - 1))
    .lean();

  const pages = Math.ceil(count / pageSize);

  res.json({
    success: true,
    users,
    page,
    pages,
    count,
  });
});

// @desc    Get user by ID
// @route   GET /api/admin/users/:id
// @access  Private/Admin
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
    .select("-password")
    .populate({
      path: "addresses",
      options: { sort: { isDefault: -1 } },
    })
    .lean();

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // Get user orders
  const orders = await Order.find({ user: user._id })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  // Get user's recent reviews
  const reviews = await Review.find({ user: user._id })
    .populate("product", "name slug")
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  res.json({
    success: true,
    user: {
      ...user,
      orders,
      reviews,
    },
  });
});

// @desc    Update user
// @route   PUT /api/admin/users/:id
// @access  Private/Admin
const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const {
    firstName,
    lastName,
    email,
    phone,
    role,
    status,
    newsletter,
    marketingEmails,
  } = req.body;

  // Update fields
  if (firstName) user.firstName = firstName;
  if (lastName) user.lastName = lastName;
  if (email) user.email = email;
  if (phone) user.phone = phone;
  if (role) user.role = role;
  if (status) user.status = status;
  if (newsletter !== undefined) user.newsletter = newsletter;
  if (marketingEmails !== undefined) user.marketingEmails = marketingEmails;

  await user.save();

  res.json({
    success: true,
    message: "User updated successfully",
    user: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
    },
  });
});

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // Check if user has orders
  const orderCount = await Order.countDocuments({ user: user._id });
  if (orderCount > 0) {
    res.status(400);
    throw new Error("Cannot delete user with existing orders");
  }

  await user.deleteOne();

  res.json({
    success: true,
    message: "User deleted successfully",
  });
});

// @desc    Get all orders
// @route   GET /api/admin/orders
// @access  Private/Admin
const getOrders = asyncHandler(async (req, res) => {
  const pageSize = 20;
  const page = Number(req.query.page) || 1;
  const status = req.query.status;
  const paymentStatus = req.query.paymentStatus;
  const search = req.query.search;

  // Build query
  let query = {};

  if (status && status !== "all") {
    query.status = status;
  }

  if (paymentStatus && paymentStatus !== "all") {
    query.paymentStatus = paymentStatus;
  }

  if (search) {
    query.$or = [
      { orderNumber: { $regex: search, $options: "i" } },
      { "shippingAddress.email": { $regex: search, $options: "i" } },
      { "shippingAddress.firstName": { $regex: search, $options: "i" } },
      { "shippingAddress.lastName": { $regex: search, $options: "i" } },
    ];
  }

  // Execute query
  const count = await Order.countDocuments(query);
  const orders = await Order.find(query)
    .populate("user", "firstName lastName email")
    .sort({ createdAt: -1 })
    .limit(pageSize)
    .skip(pageSize * (page - 1))
    .lean();

  const pages = Math.ceil(count / pageSize);

  res.json({
    success: true,
    orders,
    page,
    pages,
    count,
  });
});

// @desc    Update order status
// @route   PUT /api/admin/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  const { status, trackingNumber, adminNotes } = req.body;

  // Validate status transition
  const validTransitions = {
    pending: ["confirmed", "cancelled"],
    confirmed: ["processing", "cancelled"],
    processing: ["shipped", "cancelled"],
    shipped: ["delivered"],
    delivered: [],
    cancelled: [],
    refunded: [],
  };

  if (!validTransitions[order.status].includes(status)) {
    res.status(400);
    throw new Error(`Cannot change status from ${order.status} to ${status}`);
  }

  // Update fields
  order.status = status;

  if (status === "shipped") {
    order.shippedAt = new Date();
    if (trackingNumber) order.trackingNumber = trackingNumber;
  } else if (status === "delivered") {
    order.deliveredAt = new Date();
  } else if (status === "cancelled") {
    order.cancelledAt = new Date();

    // Restore product stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity },
      });
    }
  }

  if (adminNotes) order.adminNotes = adminNotes;

  await order.save();

  res.json({
    success: true,
    message: "Order status updated",
    order,
  });
});

// @desc    Get analytics data
// @route   GET /api/admin/analytics/:type
// @access  Private/Admin
const getAnalytics = asyncHandler(async (req, res) => {
  const { type } = req.params;
  const { period = "monthly" } = req.query;

  const now = new Date();
  let startDate;

  switch (period) {
    case "daily":
      // Last 30 days
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 30);
      break;
    case "weekly":
      // Last 12 weeks
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 84);
      break;
    case "monthly":
      // Last 12 months
      startDate = new Date(now);
      startDate.setFullYear(now.getFullYear() - 1);
      break;
    case "yearly":
      // Last 5 years
      startDate = new Date(now);
      startDate.setFullYear(now.getFullYear() - 5);
      break;
    default:
      startDate = new Date(now);
      startDate.setFullYear(now.getFullYear() - 1);
  }

  if (type === "sales") {
    const salesData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          paymentStatus: "paid",
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format:
                period === "daily"
                  ? "%Y-%m-%d"
                  : period === "weekly"
                  ? "%Y-%U"
                  : period === "monthly"
                  ? "%Y-%m"
                  : "%Y",
              date: "$createdAt",
            },
          },
          revenue: { $sum: "$total" },
          orders: { $sum: 1 },
          averageOrderValue: { $avg: "$total" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      type: "sales",
      period,
      data: salesData,
    });
  } else if (type === "products") {
    const productData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          paymentStatus: "paid",
        },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          name: { $first: "$items.name" },
          quantity: { $sum: "$items.quantity" },
          revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
    ]);

    // Populate product details
    const populatedData = await Promise.all(
      productData.map(async (item) => {
        const product = await Product.findById(item._id)
          .select("name images slug")
          .lean();

        return {
          ...item,
          product: product || { name: item.name },
        };
      })
    );

    res.json({
      success: true,
      type: "products",
      period,
      data: populatedData,
    });
  } else if (type === "customers") {
    const customerData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          paymentStatus: "paid",
          user: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: "$user",
          orders: { $sum: 1 },
          revenue: { $sum: "$total" },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
    ]);

    // Populate user details
    const populatedData = await Promise.all(
      customerData.map(async (item) => {
        const user = await User.findById(item._id)
          .select("firstName lastName email")
          .lean();

        return {
          ...item,
          user: user || {},
        };
      })
    );

    res.json({
      success: true,
      type: "customers",
      period,
      data: populatedData,
    });
  } else {
    res.status(400);
    throw new Error("Invalid analytics type");
  }
});

module.exports = {
  getDashboardStats,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  getOrders,
  updateOrderStatus,
  getAnalytics,
};
