const asyncHandler = require("express-async-handler");
const Category = require("../models/Category");
const Product = require("../models/Product");

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
const getCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({ status: "active" })
    .select("name slug description image parent featured productCount")
    .sort({ displayOrder: 1, name: 1 })
    .lean();

  // Build category tree
  const buildTree = (categories, parentId = null) => {
    const tree = [];

    categories
      .filter((category) => {
        if (parentId === null) {
          return !category.parent;
        }
        return category.parent && category.parent.toString() === parentId;
      })
      .forEach((category) => {
        const children = buildTree(categories, category._id.toString());
        if (children.length) {
          category.children = children;
        }
        tree.push(category);
      });

    return tree;
  };

  const categoryTree = buildTree(categories);

  res.json({
    success: true,
    categories: categoryTree,
  });
});

// @desc    Get category by slug
// @route   GET /api/categories/:slug
// @access  Public
const getCategoryBySlug = asyncHandler(async (req, res) => {
  const category = await Category.findOne({
    slug: req.params.slug,
    status: "active",
  }).lean();

  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }

  // Get category products with pagination
  const pageSize = 12;
  const page = Number(req.query.page) || 1;

  // Get all subcategories recursively
  const getAllSubcategories = async (categoryId) => {
    const subcategories = await Category.find({ parent: categoryId })
      .select("_id")
      .lean();

    let categoryIds = [categoryId];

    for (const sub of subcategories) {
      const subIds = await getAllSubcategories(sub._id);
      categoryIds = [...categoryIds, ...subIds];
    }

    return categoryIds;
  };

  const categoryIds = await getAllSubcategories(category._id);

  // Build query
  let query = {
    category: { $in: categoryIds },
    status: "active",
  };

  // Sort options
  let sort = { createdAt: -1 };
  if (req.query.sort) {
    switch (req.query.sort) {
      case "price-asc":
        sort = { price: 1 };
        break;
      case "price-desc":
        sort = { price: -1 };
        break;
      case "name-asc":
        sort = { name: 1 };
        break;
      case "name-desc":
        sort = { name: -1 };
        break;
      case "rating":
        sort = { averageRating: -1 };
        break;
      case "popular":
        sort = { purchaseCount: -1 };
        break;
      default:
        sort = { createdAt: -1 };
    }
  }

  // Execute query
  const count = await Product.countDocuments(query);
  const products = await Product.find(query)
    .select("name price images slug originalPrice averageRating")
    .sort(sort)
    .limit(pageSize)
    .skip(pageSize * (page - 1))
    .lean();

  // Calculate pagination
  const pages = Math.ceil(count / pageSize);

  // Get subcategories
  const subcategories = await Category.find({
    parent: category._id,
    status: "active",
  })
    .select("name slug image productCount")
    .sort({ displayOrder: 1 })
    .lean();

  res.json({
    success: true,
    category: {
      ...category,
      subcategories,
      products,
      page,
      pages,
      count,
      hasMore: page < pages,
    },
  });
});

// @desc    Get featured categories
// @route   GET /api/categories/featured
// @access  Public
const getFeaturedCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({
    featured: true,
    status: "active",
    parent: null, // Only top-level categories
  })
    .select("name slug image description productCount")
    .limit(6)
    .sort({ displayOrder: 1 })
    .lean();

  res.json({
    success: true,
    categories,
  });
});

// @desc    Get category breadcrumbs
// @route   GET /api/categories/:slug/breadcrumbs
// @access  Public
const getCategoryBreadcrumbs = asyncHandler(async (req, res) => {
  const category = await Category.findOne({ slug: req.params.slug });

  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }

  // Build breadcrumbs
  const breadcrumbs = [];
  let currentCategory = category;

  while (currentCategory) {
    breadcrumbs.unshift({
      name: currentCategory.name,
      slug: currentCategory.slug,
    });

    if (currentCategory.parent) {
      currentCategory = await Category.findById(currentCategory.parent);
    } else {
      currentCategory = null;
    }
  }

  // Add home as first breadcrumb
  breadcrumbs.unshift({
    name: "Home",
    slug: "",
  });

  res.json({
    success: true,
    breadcrumbs,
  });
});

module.exports = {
  getCategories,
  getCategoryBySlug,
  getFeaturedCategories,
  getCategoryBreadcrumbs,
};
