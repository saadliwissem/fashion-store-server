const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, "Quantity must be at least 1"],
    default: 1,
  },
  color: String,
  size: String,
  price: {
    type: Number,
    required: true,
  },
  name: String,
  image: String,
});

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    items: [cartItemSchema],

    // Calculated fields
    itemsCount: {
      type: Number,
      default: 0,
    },
    subtotal: {
      type: Number,
      default: 0,
    },
    shipping: {
      type: Number,
      default: 0,
    },
    tax: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save middleware to calculate totals
cartSchema.pre("save", function (next) {
  this.itemsCount = this.items.reduce((sum, item) => sum + item.quantity, 0);
  this.subtotal = this.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  // Calculate shipping (free if subtotal > 99)
  this.shipping = this.subtotal >= 99 ? 0 : 7;

  // Calculate tax (7% VAT)
  this.tax = parseFloat((this.subtotal * 0.07).toFixed(3));

  // Calculate total
  this.total = parseFloat(
    (this.subtotal + this.shipping + this.tax).toFixed(3)
  );

  next();
});

const Cart = mongoose.model("Cart", cartSchema);

module.exports = Cart;
