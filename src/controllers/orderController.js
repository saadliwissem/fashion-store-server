const asyncHandler = require("express-async-handler");
const Order = require("../models/Order");
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const Inventory = require("../models/Inventory");
const User = require("../models/User");
const { sendEmail, emailTemplates } = require("../utils/sendEmail");
const { validateAddress } = require("../utils/validators");

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const createOrder = asyncHandler(async (req, res) => {
  const {
    shippingAddress,
    paymentMethod,
    shippingMethod,
    customerNotes,
    saveAddress,
  } = req.body;

  // Validate shipping address
  const addressValidation = validateAddress(shippingAddress);
  if (!addressValidation.isValid) {
    res.status(400);
    throw new Error(Object.values(addressValidation.errors).join(", "));
  }

  // Get user cart
  const cart = await Cart.findOne({ user: req.user.id }).populate(
    "items.product",
    "name price images sku status"
  );

  if (!cart || cart.items.length === 0) {
    res.status(400);
    throw new Error("Cart is empty");
  }

  // Check product availability and inventory stock
  for (const item of cart.items) {
    const product = item.product;

    if (!product || product.status !== "active") {
      res.status(400);
      throw new Error(`Product "${item.name}" is no longer available`);
    }

    // Find the specific inventory item
    const inventoryQuery = {
      product: product._id,
    };

    if (item.color && item.size) {
      inventoryQuery["variant.color"] = item.color;
      inventoryQuery["variant.size"] = item.size;
    }

    const inventory = await Inventory.findOne(inventoryQuery);

    if (!inventory) {
      res.status(400);
      throw new Error(
        `Inventory not found for "${item.name}" (${item.color}, ${item.size})`
      );
    }

    if (inventory.availableStock < item.quantity) {
      res.status(400);
      throw new Error(
        `Not enough stock for "${item.name}" (${item.color}, ${item.size}). Available: ${inventory.availableStock}, Requested: ${item.quantity}`
      );
    }
  }

  // Prepare order items and reserve inventory
  const orderItems = [];
  for (const item of cart.items) {
    const product = item.product;

    // Find inventory item
    const inventoryQuery = {
      product: product._id,
    };

    if (item.color && item.size) {
      inventoryQuery["variant.color"] = item.color;
      inventoryQuery["variant.size"] = item.size;
    }

    const inventory = await Inventory.findOne(inventoryQuery);

    // Reserve stock
    inventory.reservedStock += item.quantity;
    await inventory.save();

    // Create order item with inventory reference
    orderItems.push({
      product: product._id,
      inventory: inventory._id, // Store inventory reference
      variant: {
        color: item.color,
        size: item.size,
      },
      name: item.name || product.name,
      sku: product.sku,
      price: item.price,
      quantity: item.quantity,
      total: item.price * item.quantity,
      image: item.image || product.images?.[0],
    });
  }

  // Calculate shipping price
  let shippingPrice = 0;
  if (shippingMethod === "express") {
    shippingPrice = 15;
  } else if (shippingMethod === "pickup") {
    shippingPrice = 0;
  } else {
    // Standard shipping
    shippingPrice = cart.subtotal >= 99 ? 0 : 7;
  }

  // Calculate totals
  const subtotal = cart.subtotal;
  const taxAmount = cart.tax;
  const discountAmount = cart.discountAmount || 0;
  const total = subtotal + shippingPrice + taxAmount - discountAmount;

  // Generate order number using req.user and current date
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  // Get user initials (first letter of first and last name)
  const userInitials =
    (
      (req.user.firstName?.charAt(0) || "") +
      (req.user.lastName?.charAt(0) || "")
    ).toUpperCase() || "CU";

  // Get user ID last 4 digits
  const userIdSuffix = req.user._id.toString().slice(-4).toUpperCase();

  // Create order number: INITIALS-YYYYMMDD-HHMM-USERID
  const orderNumber = `${userInitials}-${year}${month}${day}-${hours}${minutes}-${userIdSuffix}`;

  // Create order
  const order = await Order.create({
    orderNumber, // Add the generated order number
    user: req.user.id,
    items: orderItems,
    shippingAddress,
    paymentMethod,
    shippingMethod,
    shippingPrice,
    subtotal,
    taxAmount,
    discountAmount,
    total,
    customerNotes,
    status: paymentMethod === "cod" ? "pending" : "confirmed",
    paymentStatus: paymentMethod === "cod" ? "pending" : "paid",
  });

  // If payment is not COD and order is confirmed, update inventory stock
  if (paymentMethod !== "cod") {
    for (const item of order.items) {
      const inventory = await Inventory.findById(item.inventory);
      if (inventory) {
        // Create movement record
        inventory.movements.push({
          type: "out",
          quantity: item.quantity,
          reason: "sale",
          reference: `Order ${order.orderNumber}`,
          note: `Sold to customer`,
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
  }

  // Clear cart
  cart.items = [];
  cart.subtotal = 0;
  cart.shipping = 0;
  cart.tax = 0;
  cart.total = 0;
  cart.discountAmount = 0;
  await cart.save();

  // Update user stats
  await User.findByIdAndUpdate(req.user.id, {
    $inc: {
      orderCount: 1,
      totalSpent: total,
    },
  });

  // Save address to user profile if requested
  if (saveAddress) {
    const user = await User.findById(req.user.id);
    const isDefault = user.addresses.length === 0;

    user.addresses.push({
      label: "Home",
      ...shippingAddress,
      isDefault,
    });

    await user.save();
  }

  // Send order confirmation email
  try {
    await sendEmail({
      email: shippingAddress.email,
      subject: `Order Confirmation #${order.orderNumber}`,
      html: emailTemplates.orderConfirmation(order),
    });
  } catch (emailError) {
    console.error("Failed to send order confirmation email:", emailError);
  }

  res.status(201).json({
    success: true,
    order,
    message: "Order placed successfully",
  });
});

// @desc    Update order to paid (for COD orders)
// @route   PUT /api/orders/:id/pay
// @access  Private
const updateOrderToPaid = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate("items.inventory");

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  // Check if user owns the order
  if (order.user.toString() !== req.user.id && req.user.role !== "admin") {
    res.status(401);
    throw new Error("Not authorized");
  }

  // Update inventory for COD orders when payment is confirmed
  if (order.paymentMethod === "cod" && order.paymentStatus === "pending") {
    for (const item of order.items) {
      const inventory = item.inventory;
      if (inventory) {
        // Create movement record
        inventory.movements.push({
          type: "out",
          quantity: item.quantity,
          reason: "sale",
          reference: `Order ${order.orderNumber}`,
          note: `COD payment confirmed`,
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
  }

  order.paymentStatus = "paid";
  order.status = "confirmed";
  order.paymentDetails = {
    transactionId: req.body.transactionId,
    ...(req.body.paymentMethod === "card" && {
      cardLastFour: req.body.cardLastFour,
    }),
    ...(req.body.paymentMethod === "mobile" && {
      mobileProvider: req.body.mobileProvider,
    }),
    ...(req.body.paymentMethod === "bank" && { bankName: req.body.bankName }),
  };

  const updatedOrder = await order.save();

  res.json({
    success: true,
    order: updatedOrder,
  });
});

// @desc    Cancel order
// @route   PUT /api/orders/:id/cancel
// @access  Private
const cancelOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate("items.inventory");

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  // Check if user owns the order
  if (order.user.toString() !== req.user.id && req.user.role !== "admin") {
    res.status(401);
    throw new Error("Not authorized");
  }

  // Check if order can be cancelled
  if (!["pending", "confirmed"].includes(order.status)) {
    res.status(400);
    throw new Error("Order cannot be cancelled at this stage");
  }

  // Release reserved stock and restore if stock was already deducted
  for (const item of order.items) {
    const inventory = item.inventory;
    if (inventory) {
      // If payment was already processed (stock deducted)
      if (order.paymentStatus === "paid") {
        // Restore stock and create movement
        inventory.movements.push({
          type: "in",
          quantity: item.quantity,
          reason: "cancellation",
          reference: `Order ${order.orderNumber}`,
          note: `Order cancelled - stock restored`,
          user: req.user._id,
          createdAt: new Date(),
        });

        inventory.currentStock += item.quantity;
        inventory.reservedStock = Math.max(
          0,
          inventory.reservedStock - item.quantity
        );
      } else {
        // Just release reserved stock
        inventory.reservedStock = Math.max(
          0,
          inventory.reservedStock - item.quantity
        );

        // Create movement for reservation release
        inventory.movements.push({
          type: "adjustment",
          quantity: -item.quantity,
          reason: "reservation_cancelled",
          reference: `Order ${order.orderNumber}`,
          note: `Order cancelled - reservation released`,
          user: req.user._id,
          createdAt: new Date(),
        });
      }

      await inventory.save();

      // Update product purchase count (decrease if paid)
      if (order.paymentStatus === "paid") {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { purchaseCount: -item.quantity },
        });
      }
    }
  }

  order.status = "cancelled";
  order.cancelledAt = new Date();

  // Update payment status if paid
  if (order.paymentStatus === "paid") {
    order.paymentStatus = "refunded";
  }

  const updatedOrder = await order.save();

  res.json({
    success: true,
    order: updatedOrder,
  });
});

// @desc    Admin: Update order status
// @route   PUT /api/admin/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const order = await Order.findById(id).populate("items.inventory");

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  const oldStatus = order.status;
  order.status = status;

  // Handle specific status changes
  if (status === "shipped" && !order.shippedAt) {
    order.shippedAt = new Date();

    // Set estimated delivery (3-7 days from shipping)
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
  }

  await order.save();

  // Send status update email to customer
  try {
    const user = await User.findById(order.user);
    if (user) {
      await sendEmail({
        email: user.email,
        subject: `Order Status Update #${order.orderNumber}`,
        html: emailTemplates.orderStatusUpdate(order),
      });
    } else if (order.shippingAddress?.email) {
      await sendEmail({
        email: order.shippingAddress.email,
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

// @desc    Get user orders
// @route   GET /api/orders
// @access  Private
const getMyOrders = asyncHandler(async (req, res) => {
  const pageSize = 10;
  const page = Number(req.query.page) || 1;

  const count = await Order.countDocuments({ user: req.user.id });
  const orders = await Order.find({ user: req.user.id })
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

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate("items.product", "name images slug")
    .populate("items.inventory", "variant location")
    .lean();

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  // Check if user owns the order
  if (order.user.toString() !== req.user.id && req.user.role !== "admin") {
    res.status(401);
    throw new Error("Not authorized");
  }

  res.json({
    success: true,
    order,
  });
});

// @desc    Get order tracking
// @route   GET /api/orders/:id/tracking
// @access  Private
const getOrderTracking = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .select(
      "orderNumber status shippingMethod trackingNumber estimatedDelivery shippedAt deliveredAt createdAt updatedAt"
    )
    .lean();

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  // Check if user owns the order
  if (order.user.toString() !== req.user.id && req.user.role !== "admin") {
    res.status(401);
    throw new Error("Not authorized");
  }

  // Order status timeline
  const timeline = [
    {
      status: "Order Placed",
      date: order.createdAt,
      completed: true,
      description: "Your order has been received",
    },
    {
      status: "Payment",
      date: order.paymentStatus === "paid" ? order.updatedAt : null,
      completed: order.paymentStatus === "paid",
      description:
        order.paymentStatus === "paid"
          ? "Payment confirmed"
          : "Awaiting payment",
    },
    {
      status: "Processing",
      date: ["processing", "shipped", "delivered"].includes(order.status)
        ? order.updatedAt
        : null,
      completed: ["processing", "shipped", "delivered"].includes(order.status),
      description: "Preparing your order",
    },
    {
      status: "Shipped",
      date: order.shippedAt,
      completed: !!order.shippedAt,
      description: order.shippedAt
        ? `Shipped via ${order.shippingMethod}${
            order.trackingNumber ? ` - Tracking: ${order.trackingNumber}` : ""
          }`
        : "Awaiting shipment",
    },
    {
      status: "Delivered",
      date: order.deliveredAt,
      completed: !!order.deliveredAt,
      description: order.deliveredAt
        ? "Delivered successfully"
        : `Estimated delivery: ${
            order.estimatedDelivery
              ? new Date(order.estimatedDelivery).toLocaleDateString()
              : "Calculating..."
          }`,
    },
  ];

  res.json({
    success: true,
    order: {
      ...order,
      timeline,
    },
  });
});

module.exports = {
  createOrder,
  getMyOrders,
  getOrderById,
  updateOrderToPaid,
  cancelOrder,
  getOrderTracking,
  updateOrderStatus, // Added this export
};
