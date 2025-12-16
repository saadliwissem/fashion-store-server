const Category = require("../models/Category");
const Product = require("../models/Product");
const { validationResult } = require("express-validator");

// @desc    Get all categories with optional filtering
// @route   GET /api/admin/categories
// @access  Private/Admin
exports.getCategories = async (req, res) => {
  try {
    const {
      status,
      featured,
      search,
      sortBy = "displayOrder",
      sortOrder = "asc",
      includeChildren = false,
      limit,
      page = 1,
    } = req.query;

    // Build query
    let query = {};

    // Status filter
    if (status) {
      query.status = status;
    }

    // Featured filter
    if (featured !== undefined) {
      query.featured = featured === "true";
    }

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { slug: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = limit ? parseInt(limit) : null;
    const skip = limitNum ? (pageNum - 1) * limitNum : 0;

    // Execute query
    let categoriesQuery = Category.find(query).sort(sort).skip(skip).lean();

    if (limitNum) {
      categoriesQuery = categoriesQuery.limit(limitNum);
    }

    if (includeChildren) {
      categoriesQuery = categoriesQuery.populate({
        path: "children",
        options: { sort: { displayOrder: 1 } },
      });
    }

    const categories = await categoriesQuery;

    // Get total count for pagination
    const total = await Category.countDocuments(query);

    // Build response
    const response = {
      success: true,
      count: categories.length,
      total,
      page: pageNum,
      pages: limitNum ? Math.ceil(total / limitNum) : 1,
      data: categories,
    };

    res.json(response);
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Get single category by ID
// @route   GET /api/admin/categories/:id
// @access  Private/Admin
exports.getCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id)
      .populate("parent", "name slug")
      .populate({
        path: "children",
        options: { sort: { displayOrder: 1 } },
      })
      .lean();

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error("Get category error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Create new category
// @route   POST /api/admin/categories
// @access  Private/Admin
exports.createCategory = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const {
      name,
      slug,
      description,
      parent,
      status,
      featured,
      image,
      seo,
      displayOrder,
      showInMenu,
      showInFooter,
    } = req.body;

    // Check if category with same slug exists
    const existingCategory = await Category.findOne({ slug });
    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: "Category with this slug already exists",
      });
    }

    // Check parent exists
    if (parent) {
      const parentCategory = await Category.findById(parent);
      if (!parentCategory) {
        return res.status(400).json({
          success: false,
          message: "Parent category not found",
        });
      }
    }

    // Create category
    const category = new Category({
      name,
      slug,
      description,
      parent: parent || null,
      status: status || "active",
      featured: featured || false,
      image,
      seo: seo || {},
      displayOrder: displayOrder || 1,
      showInMenu: showInMenu !== undefined ? showInMenu : true,
      showInFooter: showInFooter || false,
    });

    // Save category
    await category.save();

    // Populate parent for response
    await category.populate("parent", "name slug");

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category,
    });
  } catch (error) {
    console.error("Create category error:", error);

    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Category with this name or slug already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Update category
// @route   PUT /api/admin/categories/:id
// @access  Private/Admin
exports.updateCategory = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const {
      name,
      slug,
      description,
      parent,
      status,
      featured,
      image,
      seo,
      displayOrder,
      showInMenu,
      showInFooter,
    } = req.body;

    // Check if category exists
    let category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Check if new slug conflicts with another category
    if (slug && slug !== category.slug) {
      const existingCategory = await Category.findOne({ slug });
      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: "Category with this slug already exists",
        });
      }
    }

    // Check parent exists and not creating circular reference
    if (parent && parent !== category.parent?.toString()) {
      const parentCategory = await Category.findById(parent);
      if (!parentCategory) {
        return res.status(400).json({
          success: false,
          message: "Parent category not found",
        });
      }

      // Prevent circular reference (category can't be parent of its parent)
      if (parentCategory.parent?.toString() === req.params.id) {
        return res.status(400).json({
          success: false,
          message: "Circular reference detected",
        });
      }

      // Prevent category from being its own parent
      if (parent === req.params.id) {
        return res.status(400).json({
          success: false,
          message: "Category cannot be its own parent",
        });
      }
    }

    // Update category
    const updateData = {
      name: name || category.name,
      slug: slug || category.slug,
      description:
        description !== undefined ? description : category.description,
      parent: parent !== undefined ? parent || null : category.parent,
      status: status || category.status,
      featured: featured !== undefined ? featured : category.featured,
      image: image !== undefined ? image : category.image,
      seo: seo || category.seo,
      displayOrder: displayOrder || category.displayOrder,
      showInMenu: showInMenu !== undefined ? showInMenu : category.showInMenu,
      showInFooter:
        showInFooter !== undefined ? showInFooter : category.showInFooter,
    };

    category = await Category.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    }).populate("parent", "name slug");

    res.json({
      success: true,
      message: "Category updated successfully",
      data: category,
    });
  } catch (error) {
    console.error("Update category error:", error);

    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Category with this name or slug already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Delete category
// @route   DELETE /api/admin/categories/:id
// @access  Private/Admin
exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Check if category has products
    const productCount = await Product.countDocuments({
      category: req.params.id,
    });
    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category with ${productCount} products. Remove products first or reassign them.`,
      });
    }

    // Find and delete all child categories
    const childCategories = await Category.find({ parent: req.params.id });
    for (const child of childCategories) {
      // Check if child categories have products
      const childProductCount = await Product.countDocuments({
        category: child._id,
      });
      if (childProductCount > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete category. Child category "${child.name}" has ${childProductCount} products.`,
        });
      }
    }

    // Delete child categories
    await Category.deleteMany({ parent: req.params.id });

    // Delete the category
    await Category.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Category and its sub-categories deleted successfully",
    });
  } catch (error) {
    console.error("Delete category error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Update multiple categories order
// @route   PUT /api/admin/categories/order
// @access  Private/Admin
exports.updateCategoriesOrder = async (req, res) => {
  try {
    const { categories: orderData } = req.body;

    if (!Array.isArray(orderData)) {
      return res.status(400).json({
        success: false,
        message: "Invalid data format. Expected array of categories.",
      });
    }

    // Update each category's display order
    const updatePromises = orderData.map(({ id, displayOrder }) =>
      Category.findByIdAndUpdate(id, { displayOrder }, { new: true })
    );

    await Promise.all(updatePromises);

    res.json({
      success: true,
      message: "Categories order updated successfully",
    });
  } catch (error) {
    console.error("Update categories order error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Bulk update categories
// @route   PUT /api/admin/categories/bulk
// @access  Private/Admin
exports.bulkUpdateCategories = async (req, res) => {
  try {
    const { categoryIds, updateData } = req.body;

    if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No categories selected",
      });
    }

    // Validate update data
    const allowedUpdates = ["status", "featured", "showInMenu", "showInFooter"];

    const updates = {};
    Object.keys(updateData).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        updates[key] = updateData[key];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields to update",
      });
    }

    // Update categories
    const result = await Category.updateMany(
      { _id: { $in: categoryIds } },
      updates
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} categories updated successfully`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Bulk update categories error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Get category statistics
// @route   GET /api/admin/categories/stats
// @access  Private/Admin
exports.getCategoryStats = async (req, res) => {
  try {
    const total = await Category.countDocuments();
    const active = await Category.countDocuments({ status: "active" });
    const draft = await Category.countDocuments({ status: "draft" });
    const archived = await Category.countDocuments({ status: "archived" });
    const featured = await Category.countDocuments({ featured: true });

    // Get total products across all categories
    const totalProducts = await Product.countDocuments();

    res.json({
      success: true,
      data: {
        total,
        active,
        draft,
        archived,
        featured,
        totalProducts,
      },
    });
  } catch (error) {
    console.error("Get category stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
