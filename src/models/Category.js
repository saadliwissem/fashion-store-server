const mongoose = require("mongoose");
const slugify = require("slugify");

const categorySchema = new mongoose.Schema(
  {
    // Basic Information
    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
      unique: true,
      minlength: [2, "Category name must be at least 2 characters"],
      maxlength: [100, "Category name cannot exceed 100 characters"],
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },

    // Hierarchy
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    level: {
      type: Number,
      default: 1,
    },
    path: {
      type: [String],
      default: [],
    },

    // Media
    image: String,
    bannerImage: String,

    // Display Settings
    displayOrder: {
      type: Number,
      default: 1,
      min: 1,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["active", "draft", "archived"],
      default: "active",
    },

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

    // Settings
    showInMenu: {
      type: Boolean,
      default: true,
    },
    showInFooter: {
      type: Boolean,
      default: false,
    },

    // Analytics
    productCount: {
      type: Number,
      default: 0,
    },
    viewCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for children
categorySchema.virtual("children", {
  ref: "Category",
  localField: "_id",
  foreignField: "parent",
});

// Pre-save middleware to generate slug
categorySchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }

  // Auto-generate SEO fields if empty
  if (!this.seo.title && this.name) {
    this.seo.title = `${this.name} - FashionStore Tunisia`;
  }

  if (!this.seo.description && this.name) {
    this.seo.description = `Shop ${this.name} at FashionStore Tunisia. Premium quality fashion items with free shipping across Tunisia.`;
  }

  next();
});

// Static method to build category tree
categorySchema.statics.buildTree = function (categories, parentId = null) {
  const tree = [];

  categories
    .filter((category) => String(category.parent) === String(parentId))
    .forEach((category) => {
      const children = this.buildTree(categories, category._id);
      if (children.length) {
        category.children = children;
      }
      tree.push(category);
    });

  return tree;
};

const Category = mongoose.model("Category", categorySchema);

module.exports = Category;
