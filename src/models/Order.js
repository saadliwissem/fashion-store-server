const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
  },
  inventory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Inventory",
  },
  variant: {
    color: String,
    size: String,
  },
  name: {
    type: String,
    required: true,
  },
  sku: String,
  price: {
    type: Number,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, "Quantity must be at least 1"],
  },
  total: {
    type: Number,
    required: true,
  },
  image: String,
});

const orderSchema = new mongoose.Schema(
  {
    // Order Information
    orderNumber: {
      type: String,
      required: true,
    },

    // Customer Information
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    guestUser: {
      email: String,
      firstName: String,
      lastName: String,
      phone: String,
    },

    // Order Items
    items: [orderItemSchema],

    // Pricing
    subtotal: {
      type: Number,
      required: true,
    },
    shippingPrice: {
      type: Number,
      required: true,
      default: 0,
    },
    taxAmount: {
      type: Number,
      required: true,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      required: true,
    },

    // Shipping
    shippingAddress: {
      firstName: {
        type: String,
        required: true,
      },
      lastName: {
        type: String,
        required: true,
      },
      email: {
        type: String,
        required: true,
      },
      phone: {
        type: String,
        required: true,
      },
      governorate: {
        type: String,
        required: true,
      },
      city: {
        type: String,
        required: true,
      },
      zipCode: {
        type: String,
        required: true,
      },
      address: {
        type: String,
        required: true,
      },
      address2: String,
    },

    // Shipping Method
    shippingMethod: {
      type: String,
      enum: ["standard", "express", "pickup"],
      default: "standard",
    },
    shippingCarrier: String,
    trackingNumber: String,

    // Payment
    paymentMethod: {
      type: String,
      enum: ["card", "mobile", "cod", "bank"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    paymentDetails: {
      transactionId: String,
      cardLastFour: String,
      mobileProvider: String,
      bankName: String,
    },

    // Order Status
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
        "refunded",
      ],
      default: "pending",
    },

    // Notes
    adminNotes: String,
    customerNotes: String,

    // Dates
    estimatedDelivery: Date,
    shippedAt: Date,
    deliveredAt: Date,
    cancelledAt: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ "guestUser.email": 1, createdAt: -1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ "shippingAddress.email": 1 });
orderSchema.index({ "shippingAddress.phone": 1 });
orderSchema.index({ "shippingAddress.firstName": 1 });
orderSchema.index({ "shippingAddress.lastName": 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ paymentMethod: 1 });
orderSchema.index({ shippingMethod: 1 });
const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
