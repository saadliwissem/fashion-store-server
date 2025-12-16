// controllers/admin/orderController.js
const asyncHandler = require("express-async-handler");
const Order = require("../models/Order");
const User = require("../models/User");
const Product = require("../models/Product");
const { sendEmail, emailTemplates } = require("../utils/sendEmail");

// @desc    Get all orders with filters
// @route   GET /api/admin/orders
// @access  Private/Admin
// controllers/admin/orderController.js - UPDATED getOrders function
const getOrders = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    paymentStatus,
    paymentMethod,
    shippingMethod,
    search,
    startDate,
    endDate,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  const pageSize = parseInt(limit);
  const pageNumber = parseInt(page);
  const skip = (pageNumber - 1) * pageSize;

  // Build query - start with empty
  let query = {};

  // SIMPLE FILTERS (fast)
  if (status && status !== "all") query.status = status;
  if (paymentStatus && paymentStatus !== "all")
    query.paymentStatus = paymentStatus;
  if (paymentMethod && paymentMethod !== "all")
    query.paymentMethod = paymentMethod;
  if (shippingMethod && shippingMethod !== "all")
    query.shippingMethod = shippingMethod;

  // DATE RANGE FILTER (fast with index)
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      query.createdAt.$gte = start;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }

  // OPTIMIZED SEARCH HANDLING
  if (search && search.trim()) {
    const searchTerm = search.trim();

    // Check if it's an order number (format: XX-YYYYMMDD-HHMM-XXXX)
    const orderNumberPattern = /^[A-Z]{2}-\d{8}-\d{4}-[A-Z0-9]{4}$/;

    // Check if it's a phone number (digits only)
    const phonePattern = /^\d+$/;

    // Check if it's an email
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (orderNumberPattern.test(searchTerm)) {
      // Exact order number search (FAST with index)
      query.orderNumber = searchTerm;
    } else if (emailPattern.test(searchTerm)) {
      // Email search (FAST with index)
      query["shippingAddress.email"] = {
        $regex: `^${searchTerm}$`,
        $options: "i",
      };
    } else if (phonePattern.test(searchTerm)) {
      // Phone search - remove any non-digits first
      const cleanPhone = searchTerm.replace(/\D/g, "");
      query["shippingAddress.phone"] = { $regex: `.*${cleanPhone}.*` };
    } else if (searchTerm.length >= 3) {
      // For names or general search, only search if at least 3 characters
      // Use $text search if you have a text index, otherwise use optimized regex

      // Check if it's likely a name (two words)
      const nameParts = searchTerm.split(" ").filter((part) => part.length > 1);

      if (nameParts.length === 2) {
        // Search first name and last name separately
        query.$or = [
          {
            "shippingAddress.firstName": {
              $regex: `^${nameParts[0]}.*`,
              $options: "i",
            },
            "shippingAddress.lastName": {
              $regex: `^${nameParts[1]}.*`,
              $options: "i",
            },
          },
          {
            "shippingAddress.firstName": {
              $regex: `^${nameParts[1]}.*`,
              $options: "i",
            },
            "shippingAddress.lastName": {
              $regex: `^${nameParts[0]}.*`,
              $options: "i",
            },
          },
        ];
      } else {
        // Single word search - search order number starts with
        query.orderNumber = { $regex: `^${searchTerm}`, $options: "i" };
      }
    }
    // If search term is less than 3 chars and doesn't match patterns above,
    // don't search at all to avoid slow regex queries
  }

  // Debug logging
  console.log("Query:", JSON.stringify(query, null, 2));

  // Sorting - use indexes
  const sortOptions = {};
  if (sortBy === "createdAt") {
    sortOptions.createdAt = sortOrder === "desc" ? -1 : 1;
  } else if (sortBy === "total") {
    sortOptions.total = sortOrder === "desc" ? -1 : 1;
  } else {
    // Default to createdAt for performance
    sortOptions.createdAt = -1;
  }

  try {
    // Get total count
    const total = await Order.countDocuments(query);
    console.log(`Found ${total} orders matching query`);

    // Get orders WITHOUT populate for performance
    let ordersQuery = Order.find(query)
      .select(
        "orderNumber createdAt updatedAt status paymentStatus paymentMethod shippingMethod shippingPrice subtotal taxAmount discountAmount total shippingAddress items user"
      )
      .sort(sortOptions);

    // Add pagination
    if (pageSize > 0) {
      ordersQuery = ordersQuery.limit(pageSize).skip(skip);
    }

    const orders = await ordersQuery.lean();

    // If we need user info, get it separately (more efficient)
    if (orders.length > 0 && orders.some((order) => order.user)) {
      const userIds = [
        ...new Set(orders.map((order) => order.user).filter((id) => id)),
      ];
      const users = await User.find({ _id: { $in: userIds } })
        .select("firstName lastName email")
        .lean();

      const userMap = {};
      users.forEach((user) => {
        userMap[user._id.toString()] = user;
      });

      // Attach user info
      orders.forEach((order) => {
        if (order.user && userMap[order.user.toString()]) {
          order.user = userMap[order.user.toString()];
        }
      });
    }

    // Calculate summary stats
    const summary = await Order.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$total" },
          totalItems: { $sum: { $sum: "$items.quantity" } },
        },
      },
    ]);

    const summaryData = summary[0] || { totalRevenue: 0, totalItems: 0 };

    res.json({
      success: true,
      orders,
      total,
      page: pageNumber,
      pages: pageSize > 0 ? Math.ceil(total / pageSize) : 1,
      summary: {
        totalRevenue: summaryData.totalRevenue,
        totalItems: summaryData.totalItems,
        totalOrders: total,
      },
    });
  } catch (error) {
    console.error("Error in getOrders:", error);
    // Fallback to simple query
    const total = await Order.countDocuments({});
    const orders = await Order.find({})
      .select("orderNumber createdAt status total shippingAddress")
      .sort({ createdAt: -1 })
      .limit(pageSize)
      .skip(skip)
      .lean();

    res.json({
      success: true,
      orders,
      total,
      page: pageNumber,
      pages: Math.ceil(total / pageSize),
      summary: {
        totalRevenue: 0,
        totalItems: 0,
        totalOrders: total,
      },
    });
  }
});
// @desc    Get order by ID
// @route   GET /api/admin/orders/:id
// @access  Private/Admin
const getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate("user", "firstName lastName email phone")
    .populate("items.product", "name images slug")
    .populate("items.inventory", "variant location")
    .lean();

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  res.json({
    success: true,
    order,
  });
});

// @desc    Update order status
// @route   PUT /api/admin/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;

  const order = await Order.findById(req.params.id)
    .populate("user", "email firstName lastName")
    .populate("items.inventory");

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  const oldStatus = order.status;
  order.status = status;

  // Handle specific status changes
  if (status === "shipped" && !order.shippedAt) {
    order.shippedAt = new Date();

    // Set estimated delivery
    const deliveryDays = order.shippingMethod === "express" ? 3 : 7;
    order.estimatedDelivery = new Date(
      Date.now() + deliveryDays * 24 * 60 * 60 * 1000
    );
  } else if (status === "delivered" && !order.deliveredAt) {
    order.deliveredAt = new Date();
  } else if (status === "processing" && order.paymentMethod === "cod") {
    // For COD orders, update inventory when processing starts
    if (order.paymentStatus === "pending") {
      for (const item of order.items) {
        const inventory = item.inventory;
        if (inventory) {
          // Create movement record
          inventory.movements.push({
            type: "out",
            quantity: item.quantity,
            reason: "sale",
            reference: `Order ${order.orderNumber}`,
            note: `COD order processed`,
            user: req.user._id,
            createdAt: new Date(),
          });

          // Update actual stock and remove reservation
          inventory.currentStock -= item.quantity;
          inventory.reservedStock -= item.quantity;
          inventory.lastSold = new Date();

          await inventory.save();

          // Update product purchase count
          await Product.findByIdAndUpdate(item.product, {
            $inc: { purchaseCount: item.quantity },
          });
        }
      }
      order.paymentStatus = "paid";
    }
  } else if (status === "cancelled") {
    // Handle cancellation - release/restore stock
    for (const item of order.items) {
      const inventory = item.inventory;
      if (inventory) {
        // If payment was already processed (stock deducted)
        if (order.paymentStatus === "paid") {
          // Restore stock
          inventory.currentStock += item.quantity;
          inventory.reservedStock = Math.max(
            0,
            inventory.reservedStock - item.quantity
          );

          inventory.movements.push({
            type: "in",
            quantity: item.quantity,
            reason: "cancellation",
            reference: `Order ${order.orderNumber}`,
            note: `Order cancelled - stock restored`,
            user: req.user._id,
            createdAt: new Date(),
          });
        } else {
          // Just release reserved stock
          inventory.reservedStock = Math.max(
            0,
            inventory.reservedStock - item.quantity
          );
        }

        await inventory.save();

        // Update product purchase count if paid
        if (order.paymentStatus === "paid") {
          await Product.findByIdAndUpdate(item.product, {
            $inc: { purchaseCount: -item.quantity },
          });
        }
      }
    }

    if (order.paymentStatus === "paid") {
      order.paymentStatus = "refunded";
    }
    order.cancelledAt = new Date();
  }

  // Add admin note if provided
  if (note) {
    order.adminNotes = order.adminNotes
      ? `${order.adminNotes}\n${new Date().toLocaleString()}: ${note}`
      : `${new Date().toLocaleString()}: ${note}`;
  }

  await order.save();

  // Send status update email to customer
  try {
    const email = order.user?.email || order.shippingAddress?.email;
    if (email) {
      await sendEmail({
        email,
        subject: `Order Status Update #${order.orderNumber}`,
        html: emailTemplates.orderStatusUpdate(order),
      });
    }
  } catch (emailError) {
    console.error("Failed to send status update email:", emailError);
  }

  res.json({
    success: true,
    message: "Order status updated successfully",
    order,
  });
});

// @desc    Update order tracking
// @route   PUT /api/admin/orders/:id/tracking
// @access  Private/Admin
const updateTracking = asyncHandler(async (req, res) => {
  const { trackingNumber, shippingCarrier, note } = req.body;

  const order = await Order.findById(req.params.id).populate(
    "user",
    "email firstName lastName"
  );

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  order.trackingNumber = trackingNumber;
  if (shippingCarrier) order.shippingCarrier = shippingCarrier;

  // Update status to shipped if not already
  if (!order.shippedAt) {
    order.status = "shipped";
    order.shippedAt = new Date();

    const deliveryDays = order.shippingMethod === "express" ? 3 : 7;
    order.estimatedDelivery = new Date(
      Date.now() + deliveryDays * 24 * 60 * 60 * 1000
    );
  }

  // Add admin note
  if (note) {
    order.adminNotes = order.adminNotes
      ? `${order.adminNotes}\n${new Date().toLocaleString()}: ${note}`
      : `${new Date().toLocaleString()}: ${note}`;
  }

  await order.save();

  // Send tracking update email
  try {
    const email = order.user?.email || order.shippingAddress?.email;
    if (email) {
      await sendEmail({
        email,
        subject: `Your Order Has Been Shipped #${order.orderNumber}`,
        html: emailTemplates.orderShipped(order),
      });
    }
  } catch (emailError) {
    console.error("Failed to send tracking update email:", emailError);
  }

  res.json({
    success: true,
    message: "Tracking information updated",
    order,
  });
});

// @desc    Update payment status
// @route   PUT /api/admin/orders/:id/payment
// @access  Private/Admin
const updatePaymentStatus = asyncHandler(async (req, res) => {
  const { paymentStatus, paymentDetails, note } = req.body;

  const order = await Order.findById(req.params.id).populate("items.inventory");

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  const oldPaymentStatus = order.paymentStatus;
  order.paymentStatus = paymentStatus;

  if (paymentDetails) {
    order.paymentDetails = { ...order.paymentDetails, ...paymentDetails };
  }

  // Handle payment status changes
  if (paymentStatus === "paid" && oldPaymentStatus !== "paid") {
    // Update inventory for newly paid orders
    for (const item of order.items) {
      const inventory = item.inventory;
      if (inventory) {
        // Create movement record
        inventory.movements.push({
          type: "out",
          quantity: item.quantity,
          reason: "sale",
          reference: `Order ${order.orderNumber}`,
          note: `Payment confirmed`,
          user: req.user._id,
          createdAt: new Date(),
        });

        // Update actual stock and remove reservation
        inventory.currentStock -= item.quantity;
        inventory.reservedStock -= item.quantity;
        inventory.lastSold = new Date();

        await inventory.save();

        // Update product purchase count
        await Product.findByIdAndUpdate(item.product, {
          $inc: { purchaseCount: item.quantity },
        });
      }
    }

    // Update order status if pending
    if (order.status === "pending") {
      order.status = "confirmed";
    }
  } else if (paymentStatus === "refunded" && oldPaymentStatus === "paid") {
    // Handle refund - restore stock
    for (const item of order.items) {
      const inventory = item.inventory;
      if (inventory) {
        // Restore stock
        inventory.currentStock += item.quantity;
        inventory.movements.push({
          type: "in",
          quantity: item.quantity,
          reason: "refund",
          reference: `Order ${order.orderNumber}`,
          note: `Payment refunded - stock restored`,
          user: req.user._id,
          createdAt: new Date(),
        });

        await inventory.save();

        // Update product purchase count
        await Product.findByIdAndUpdate(item.product, {
          $inc: { purchaseCount: -item.quantity },
        });
      }
    }
  }

  // Add admin note
  if (note) {
    order.adminNotes = order.adminNotes
      ? `${order.adminNotes}\n${new Date().toLocaleString()}: ${note}`
      : `${new Date().toLocaleString()}: ${note}`;
  }

  await order.save();

  res.json({
    success: true,
    message: "Payment status updated",
    order,
  });
});

// @desc    Update order details
// @route   PUT /api/admin/orders/:id
// @access  Private/Admin
const updateOrder = asyncHandler(async (req, res) => {
  const { shippingAddress, shippingMethod, shippingPrice, items, note } =
    req.body;

  const order = await Order.findById(req.params.id);

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  // Update fields if provided
  if (shippingAddress) {
    order.shippingAddress = { ...order.shippingAddress, ...shippingAddress };
  }

  if (shippingMethod) order.shippingMethod = shippingMethod;
  if (shippingPrice !== undefined) order.shippingPrice = shippingPrice;

  if (items) {
    // Recalculate totals if items change
    order.items = items;
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    order.subtotal = subtotal;
    order.taxAmount = subtotal * 0.07;
    order.total =
      subtotal +
      order.shippingPrice +
      order.taxAmount -
      (order.discountAmount || 0);
  }

  // Add admin note
  if (note) {
    order.adminNotes = order.adminNotes
      ? `${order.adminNotes}\n${new Date().toLocaleString()}: ${note}`
      : `${new Date().toLocaleString()}: ${note}`;
  }

  await order.save();

  res.json({
    success: true,
    message: "Order updated successfully",
    order,
  });
});

// @desc    Bulk update orders
// @route   PUT /api/admin/orders/bulk
// @access  Private/Admin
const bulkUpdateOrders = asyncHandler(async (req, res) => {
  const { orderIds, updateData } = req.body;

  if (!orderIds || !orderIds.length) {
    res.status(400);
    throw new Error("No orders selected");
  }

  const result = await Order.updateMany(
    { _id: { $in: orderIds } },
    { $set: updateData }
  );

  res.json({
    success: true,
    message: `${result.modifiedCount} orders updated successfully`,
    modifiedCount: result.modifiedCount,
  });
});

// @desc    Get order statistics
// @route   GET /api/admin/orders/stats
// @access  Private/Admin
const getOrderStats = asyncHandler(async (req, res) => {
  const today = new Date();
  const startOfToday = new Date(today.setHours(0, 0, 0, 0));
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfYear = new Date(today.getFullYear(), 0, 1);

  // Total orders
  const totalOrders = await Order.countDocuments();

  // Today's orders
  const todayOrders = await Order.countDocuments({
    createdAt: { $gte: startOfToday },
  });

  // Monthly orders
  const monthlyOrders = await Order.countDocuments({
    createdAt: { $gte: startOfMonth },
  });

  // Yearly orders
  const yearlyOrders = await Order.countDocuments({
    createdAt: { $gte: startOfYear },
  });

  // Status distribution
  const statusDistribution = await Order.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        revenue: { $sum: "$total" },
      },
    },
    { $sort: { count: -1 } },
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
    { $sort: { count: -1 } },
  ]);

  // Revenue statistics
  const revenueStats = await Order.aggregate([
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$total" },
        averageOrderValue: { $avg: "$total" },
        totalItemsSold: {
          $sum: { $sum: "$items.quantity" },
        },
      },
    },
  ]);

  res.json({
    success: true,
    stats: {
      totalOrders,
      todayOrders,
      monthlyOrders,
      yearlyOrders,
      statusDistribution,
      paymentMethodDistribution,
      revenue: revenueStats[0] || {
        totalRevenue: 0,
        averageOrderValue: 0,
        totalItemsSold: 0,
      },
    },
  });
});

// @desc    Get orders analytics
// @route   GET /api/admin/orders/analytics
// @access  Private/Admin
const getOrdersAnalytics = asyncHandler(async (req, res) => {
  const { period = "month" } = req.query;

  let groupFormat;
  switch (period) {
    case "day":
      groupFormat = "%Y-%m-%d";
      break;
    case "week":
      groupFormat = "%Y-%W";
      break;
    case "year":
      groupFormat = "%Y";
      break;
    default:
      groupFormat = "%Y-%m";
  }

  const analytics = await Order.aggregate([
    {
      $group: {
        _id: {
          $dateToString: { format: groupFormat, date: "$createdAt" },
        },
        count: { $sum: 1 },
        revenue: { $sum: "$total" },
        averageOrderValue: { $avg: "$total" },
        itemsSold: { $sum: { $sum: "$items.quantity" } },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  res.json({
    success: true,
    analytics,
    period,
  });
});

// @desc    Get sales report
// @route   GET /api/admin/orders/sales-report
// @access  Private/Admin
const getSalesReport = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const matchStage = {};
  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = new Date(startDate);
    if (endDate) matchStage.createdAt.$lte = new Date(endDate);
  }

  const report = await Order.aggregate([
    { $match: matchStage },
    { $unwind: "$items" },
    {
      $group: {
        _id: {
          product: "$items.product",
          name: "$items.name",
        },
        totalQuantity: { $sum: "$items.quantity" },
        totalRevenue: { $sum: "$items.total" },
        ordersCount: { $sum: 1 },
      },
    },
    { $sort: { totalRevenue: -1 } },
    {
      $lookup: {
        from: "products",
        localField: "_id.product",
        foreignField: "_id",
        as: "productDetails",
      },
    },
    {
      $project: {
        productId: "$_id.product",
        productName: "$_id.name",
        productDetails: { $arrayElemAt: ["$productDetails", 0] },
        totalQuantity: 1,
        totalRevenue: 1,
        ordersCount: 1,
        averagePrice: { $divide: ["$totalRevenue", "$totalQuantity"] },
      },
    },
  ]);

  // Calculate totals
  const totals = report.reduce(
    (acc, item) => {
      acc.totalQuantity += item.totalQuantity;
      acc.totalRevenue += item.totalRevenue;
      acc.totalOrders += item.ordersCount;
      return acc;
    },
    { totalQuantity: 0, totalRevenue: 0, totalOrders: 0 }
  );

  res.json({
    success: true,
    report,
    totals,
  });
});

// @desc    Export orders
// @route   GET /api/admin/orders/export
// @access  Private/Admin
const exportOrders = asyncHandler(async (req, res) => {
  const { format = "csv", ...filters } = req.query;

  // Build query based on filters
  let query = {};

  if (filters.startDate || filters.endDate) {
    query.createdAt = {};
    if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
    if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
  }

  if (filters.status && filters.status !== "all") {
    query.status = filters.status;
  }

  if (filters.paymentStatus && filters.paymentStatus !== "all") {
    query.paymentStatus = filters.paymentStatus;
  }

  const orders = await Order.find(query)
    .populate("user", "firstName lastName email")
    .sort({ createdAt: -1 })
    .lean();

  if (format === "csv") {
    // Convert to CSV
    const headers = [
      "Order Number",
      "Date",
      "Customer",
      "Email",
      "Status",
      "Payment Status",
      "Payment Method",
      "Items",
      "Subtotal",
      "Shipping",
      "Tax",
      "Discount",
      "Total",
      "Shipping Address",
      "Phone",
      "Tracking Number",
    ];

    const csvData = orders.map((order) => [
      order.orderNumber,
      order.createdAt.toISOString().split("T")[0],
      `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`,
      order.shippingAddress.email,
      order.status,
      order.paymentStatus,
      order.paymentMethod,
      order.items.map((item) => `${item.quantity}x ${item.name}`).join("; "),
      order.subtotal,
      order.shippingPrice,
      order.taxAmount,
      order.discountAmount || 0,
      order.total,
      `${order.shippingAddress.address}, ${order.shippingAddress.city}, ${order.shippingAddress.governorate}`,
      order.shippingAddress.phone,
      order.trackingNumber || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...csvData.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=orders-${
        new Date().toISOString().split("T")[0]
      }.csv`
    );
    res.send(csvContent);
  } else {
    // Default to JSON
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=orders-${
        new Date().toISOString().split("T")[0]
      }.json`
    );
    res.send(JSON.stringify(orders, null, 2));
  }
});

// @desc    Delete order
// @route   DELETE /api/admin/orders/:id
// @access  Private/Admin
const deleteOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  // Check if order can be deleted (only certain statuses)
  const nonDeletableStatuses = ["processing", "shipped", "delivered"];
  if (nonDeletableStatuses.includes(order.status)) {
    res.status(400);
    throw new Error(
      `Cannot delete order with status: ${order.status}. Please cancel it first.`
    );
  }

  // Release/restore stock before deletion
  if (order.status !== "cancelled") {
    for (const item of order.items) {
      const inventory = await Inventory.findById(item.inventory);
      if (inventory) {
        if (order.paymentStatus === "paid") {
          // Restore stock for paid orders
          inventory.currentStock += item.quantity;
          inventory.movements.push({
            type: "in",
            quantity: item.quantity,
            reason: "order_deleted",
            reference: `Order ${order.orderNumber}`,
            note: `Order deleted - stock restored`,
            user: req.user._id,
            createdAt: new Date(),
          });
        } else {
          // Release reserved stock for unpaid orders
          inventory.reservedStock = Math.max(
            0,
            inventory.reservedStock - item.quantity
          );
        }
        await inventory.save();
      }

      // Update product purchase count if paid
      if (order.paymentStatus === "paid") {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { purchaseCount: -item.quantity },
        });
      }
    }
  }

  await order.deleteOne();

  res.json({
    success: true,
    message: "Order deleted successfully",
  });
});

module.exports = {
  getOrders,
  getOrder,
  updateOrderStatus,
  updateOrder,
  deleteOrder,
  bulkUpdateOrders,
  getOrderStats,
  updateTracking,
  updatePaymentStatus,
  getOrdersAnalytics,
  getSalesReport,
  exportOrders,
};
