const mongoose = require("mongoose");
const Product = require("./Product");

const inventoryMovementSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["in", "out", "adjustment", "return", "damage"],
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
  },
  reason: String,
  reference: String,
  note: String,
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const inventorySchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variant: {
      color: String,
      size: String,
    },

    // Stock Levels
    currentStock: {
      type: Number,
      default: 0,
      min: [0, "Stock cannot be negative"],
    },
    reservedStock: {
      type: Number,
      default: 0,
    },
    availableStock: {
      type: Number,
      default: 0,
    },
    lowStockThreshold: {
      type: Number,
      default: 10,
    },

    // Stock Movements
    movements: [inventoryMovementSchema],

    // Reordering
    reorderPoint: Number,
    reorderQuantity: Number,
    supplier: String,
    leadTime: Number,

    // Cost
    unitCost: Number,
    averageCost: Number,

    // Location
    location: String,
    warehouse: String,

    // Status
    status: {
      type: String,
      enum: ["in-stock", "low-stock", "out-of-stock", "discontinued"],
      default: "in-stock",
    },

    // Dates
    lastRestocked: Date,
    lastSold: Date,
  },
  {
    timestamps: true,
  }
);

// Virtual for calculating available stock
inventorySchema.virtual("availableStockCalc").get(function () {
  return Math.max(0, this.currentStock - this.reservedStock);
});

// Pre-save middleware to update available stock
inventorySchema.pre("save", function (next) {
  this.availableStock = Math.max(0, this.currentStock - this.reservedStock);

  // Update status based on stock levels
  if (this.currentStock <= 0) {
    this.status = "out-of-stock";
  } else if (this.currentStock <= this.lowStockThreshold) {
    this.status = "low-stock";
  } else {
    this.status = "in-stock";
  }

  next();
});
// Add to Inventory model
inventorySchema.post("save", async function () {
  try {
    // Update the product's variant stock
    const product = await Product.findById(this.product);
    if (!product) return;

    if (product.variants && product.variants.length > 0 && this.variant) {
      // Find and update the specific variant
      const variantIndex = product.variants.findIndex(
        (v) => v.color === this.variant.color && v.size === this.variant.size
      );

      if (variantIndex > -1) {
        product.variants[variantIndex].stock = this.currentStock;
        await product.save();
      }
    } else {
      // For products without variants, update main stock field
      // But we removed it, so skip this
    }
  } catch (error) {
    console.error("Error syncing inventory with product:", error);
  }
});

// Also sync when inventory is updated via findOneAndUpdate
inventorySchema.post("findOneAndUpdate", async function (doc) {
  if (doc) {
    // Trigger the same sync logic
    const product = await Product.findById(doc.product);
    if (!product) return;

    if (product.variants && product.variants.length > 0 && doc.variant) {
      const variantIndex = product.variants.findIndex(
        (v) => v.color === doc.variant.color && v.size === doc.variant.size
      );

      if (variantIndex > -1) {
        product.variants[variantIndex].stock = doc.currentStock;
        await product.save();
      }
    }
  }
});

// Indexes
inventorySchema.index({ product: 1 });
inventorySchema.index({ status: 1 });
inventorySchema.index({ availableStock: 1 });
inventorySchema.index({ product: 1, "variant.color": 1, "variant.size": 1 }); // For variant lookup
inventorySchema.index({ status: 1, currentStock: 1 }); // For low stock queries
inventorySchema.index({ warehouse: 1, location: 1 }); // For location-based queries
inventorySchema.index({ "movements.createdAt": -1 }); // For movement history

const Inventory = mongoose.model("Inventory", inventorySchema);

module.exports = Inventory;
