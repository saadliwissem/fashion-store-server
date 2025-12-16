const asyncHandler = require("express-async-handler");
const Review = require("../models/Review");
const Product = require("../models/Product");
const Order = require("../models/Order");

// @desc    Get product reviews
// @route   GET /api/reviews/product/:productId
// @access  Public
const getProductReviews = asyncHandler(async (req, res) => {
  const pageSize = 10;
  const page = Number(req.query.page) || 1;
  const filter = req.query.filter; // latest, helpful, highest, lowest

  // Validate product
  const product = await Product.findById(req.params.productId);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  // Build query
  let query = { product: req.params.productId };
  let sort = { createdAt: -1 };

  // Apply filters
  if (filter === "helpful") {
    sort = { helpful: -1 };
  } else if (filter === "highest") {
    sort = { rating: -1 };
  } else if (filter === "lowest") {
    sort = { rating: 1 };
  }

  // Get reviews
  const count = await Review.countDocuments(query);
  const reviews = await Review.find(query)
    .populate("user", "firstName lastName")
    .sort(sort)
    .limit(pageSize)
    .skip(pageSize * (page - 1))
    .lean();

  // Calculate rating distribution
  const ratingDistribution = await Review.aggregate([
    { $match: { product: product._id } },
    {
      $group: {
        _id: "$rating",
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: -1 } },
  ]);

  const pages = Math.ceil(count / pageSize);

  res.json({
    success: true,
    reviews,
    ratingDistribution,
    averageRating: product.averageRating,
    reviewCount: product.reviewCount,
    page,
    pages,
    count,
  });
});

// @desc    Create review
// @route   POST /api/reviews
// @access  Private
const createReview = asyncHandler(async (req, res) => {
  const { productId, rating, comment, images } = req.body;

  // Validate product
  const product = await Product.findById(productId);
  if (!product || product.status !== "active") {
    res.status(404);
    throw new Error("Product not found or unavailable");
  }

  // Check if user has purchased the product
  const hasPurchased = await Order.exists({
    user: req.user.id,
    "items.product": productId,
    status: "delivered",
  });

  if (!hasPurchased) {
    res.status(400);
    throw new Error("You must purchase this product before reviewing");
  }

  // Check if already reviewed
  const existingReview = await Review.findOne({
    product: productId,
    user: req.user.id,
  });

  if (existingReview) {
    res.status(400);
    throw new Error("You have already reviewed this product");
  }

  // Create review
  const review = await Review.create({
    product: productId,
    user: req.user.id,
    rating: Number(rating),
    comment,
    images: images || [],
    verifiedPurchase: true,
  });

  // Update product rating
  const reviews = await Review.find({ product: productId });
  const averageRating =
    reviews.reduce((acc, item) => item.rating + acc, 0) / reviews.length;

  product.averageRating = parseFloat(averageRating.toFixed(1));
  product.reviewCount = reviews.length;
  await product.save();

  // Populate user info
  await review.populate("user", "firstName lastName");

  res.status(201).json({
    success: true,
    message: "Review submitted successfully",
    review,
  });
});

// @desc    Update review
// @route   PUT /api/reviews/:id
// @access  Private
const updateReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    res.status(404);
    throw new Error("Review not found");
  }

  // Check ownership
  if (review.user.toString() !== req.user.id && req.user.role !== "admin") {
    res.status(401);
    throw new Error("Not authorized");
  }

  const { rating, comment, images } = req.body;

  // Update fields
  if (rating) review.rating = Number(rating);
  if (comment) review.comment = comment;
  if (images !== undefined) review.images = images;

  const updatedReview = await review.save();

  // Update product rating if rating changed
  if (rating) {
    const reviews = await Review.find({ product: review.product });
    const averageRating =
      reviews.reduce((acc, item) => item.rating + acc, 0) / reviews.length;

    await Product.findByIdAndUpdate(review.product, {
      averageRating: parseFloat(averageRating.toFixed(1)),
      reviewCount: reviews.length,
    });
  }

  await updatedReview.populate("user", "firstName lastName");

  res.json({
    success: true,
    message: "Review updated",
    review: updatedReview,
  });
});

// @desc    Delete review
// @route   DELETE /api/reviews/:id
// @access  Private
const deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    res.status(404);
    throw new Error("Review not found");
  }

  // Check ownership
  if (review.user.toString() !== req.user.id && req.user.role !== "admin") {
    res.status(401);
    throw new Error("Not authorized");
  }

  const productId = review.product;

  await review.deleteOne();

  // Update product rating
  const reviews = await Review.find({ product: productId });

  if (reviews.length > 0) {
    const averageRating =
      reviews.reduce((acc, item) => item.rating + acc, 0) / reviews.length;

    await Product.findByIdAndUpdate(productId, {
      averageRating: parseFloat(averageRating.toFixed(1)),
      reviewCount: reviews.length,
    });
  } else {
    await Product.findByIdAndUpdate(productId, {
      averageRating: 0,
      reviewCount: 0,
    });
  }

  res.json({
    success: true,
    message: "Review deleted",
  });
});

// @desc    Mark review as helpful
// @route   POST /api/reviews/:id/helpful
// @access  Private
const markHelpful = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    res.status(404);
    throw new Error("Review not found");
  }

  // Check if user already marked as helpful
  // In a real app, you would track which users marked which reviews
  // For simplicity, we'll just increment

  review.helpful += 1;
  await review.save();

  res.json({
    success: true,
    message: "Thank you for your feedback",
    helpfulCount: review.helpful,
  });
});

module.exports = {
  getProductReviews,
  createReview,
  updateReview,
  deleteReview,
  markHelpful,
};
