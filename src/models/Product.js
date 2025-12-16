const mongoose = require("mongoose");
const slugify = require("slugify");

const variantSchema = new mongoose.Schema({
  color: String,
  size: String,
  price: {
    type: Number,
    min: [0, "Price must be positive"],
  },
  sku: String,
  image: String,
});

const productSchema = new mongoose.Schema(
  {
    // Basic Information
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      minlength: [3, "Product name must be at least 3 characters"],
      maxlength: [200, "Product name cannot exceed 200 characters"],
    },
    sku: {
      type: String,
      required: [true, "SKU is required"],
      unique: true,
      uppercase: true,
    },
    slug: {
      type: String,
      required: false,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
    },
    shortDescription: {
      type: String,
      maxlength: [160, "Short description cannot exceed 160 characters"],
    },

    // Category Information
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
    },
    subCategory: String,

    // Pricing
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price must be positive"],
    },
    originalPrice: {
      type: Number,
      min: [0, "Original price must be positive"],
    },
    costPrice: {
      type: Number,
      min: [0, "Cost price must be positive"],
    },
    onSale: {
      type: Boolean,
      default: false,
    },

    // Inventory
    stock: {
      type: Number,
      default: 0,
      min: [0, "Stock cannot be negative"],
    },
    lowStockThreshold: {
      type: Number,
      default: 10,
    },
    manageStock: {
      type: Boolean,
      default: true,
    },

    // Status & Flags
    status: {
      type: String,
      enum: ["draft", "active", "out-of-stock", "archived"],
      default: "draft",
    },
    featured: {
      type: Boolean,
      default: false,
    },
    isNewArrival: { type: Boolean, default: false },

    // Media
    images: [String],
    thumbnail: String,

    // Specifications
    specifications: {
      material: String,
      weight: String,
      fit: String,
      care: String,
      additional: [
        {
          key: String,
          value: String,
        },
      ],
    },

    // Variants
    variants: [variantSchema],

    // SEO
    seo: {
      title: {
        type: String,
        maxlength: [60, "SEO title cannot exceed 60 characters"],
      },
      description: {
        type: String,
        maxlength: [160, "SEO description cannot exceed 160 characters"],
      },
      keywords: [String],
    },

    // Tags
    tags: [String],

    // Analytics
    viewCount: {
      type: Number,
      default: 0,
    },
    purchaseCount: {
      type: Number,
      default: 0,
    },
    averageRating: {
      type: Number,
      default: 0,
      min: [0, "Rating must be at least 0"],
      max: [5, "Rating cannot exceed 5"],
    },
    reviewCount: {
      type: Number,
      default: 0,
    },

    // Shipping
    weight: Number,
    dimensions: {
      length: Number,
      width: Number,
      height: Number,
    },
    freeShipping: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for discount percentage
productSchema.virtual("discountPercentage").get(function () {
  if (this.originalPrice && this.price < this.originalPrice) {
    return Math.round(
      ((this.originalPrice - this.price) / this.originalPrice) * 100
    );
  }
  return 0;
});

// Virtual for inStock with null check
productSchema.virtual("inStock").get(function () {
  if (
    this.variants &&
    Array.isArray(this.variants) &&
    this.variants.length > 0
  ) {
    // This should check inventory, not variants.stock
    // We'll need a different approach
    return true; // Temporary
  }
  return true; // Will check inventory separately
});

// Add another virtual for frontend to check availability
productSchema.virtual("isAvailable").get(function () {
  return this.status === "active" && this.inStock;
});

// Pre-save middleware
productSchema.pre("save", function (next) {
  // Generate slug from name
  if (this.isModified("name")) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }

  // Auto-generate SKU if not provided
  if (!this.sku) {
    const prefix = "FS";
    const categoryCode = this.category
      ? this.category.toString().slice(-3).toUpperCase()
      : "GEN";
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    this.sku = `${prefix}-${categoryCode}-${randomNum}`;
  }

  // Set onSale flag
  if (this.originalPrice && this.price < this.originalPrice) {
    this.onSale = true;
  }

  // Auto-generate SEO fields if empty
  if (!this.seo.title && this.name) {
    this.seo.title = `${this.name} - FashionStore Tunisia`;
  }

  if (!this.seo.description && this.shortDescription) {
    this.seo.description = this.shortDescription.substring(0, 160);
  }

  next();
});

// Indexes for better query performance
// Simplify indexes to only what's necessary:
productSchema.index({ category: 1, status: 1, createdAt: -1 }); // Compound index
productSchema.index({ price: 1, status: 1 }); // Compound index
productSchema.index({ featured: 1, status: 1, createdAt: -1 }); // Compound index
productSchema.index({ isNewArrival: 1, status: 1, createdAt: -1 }); // Compound index
productSchema.index({ onSale: 1, status: 1, price: 1 }); // Compound index
productSchema.index({ "variants.sku": 1 }, { sparse: true });
productSchema.index(
  { "variants.color": 1, "variants.size": 1 },
  { sparse: true }
);
const Product = mongoose.model("Product", productSchema);

module.exports = Product;
