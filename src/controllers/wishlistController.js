const asyncHandler = require("express-async-handler");
const Wishlist = require("../models/Wishlist");
const Product = require("../models/Product");

// @desc    Get user wishlist
// @route   GET /api/wishlist
// @access  Private
const getWishlist = asyncHandler(async (req, res) => {
  // First, get wishlist without lean() so we have Mongoose document
  let wishlist = await Wishlist.findOne({ user: req.user.id }).populate(
    "items.product",
    "name price images slug originalPrice averageRating status"
  );

  if (!wishlist) {
    // Create empty wishlist if not exists
    const newWishlist = await Wishlist.create({ user: req.user.id });
    return res.json({
      success: true,
      wishlist: newWishlist,
    });
  }

  // Check if we need to filter out unavailable products
  const availableItems = wishlist.items.filter(
    (item) => item.product && item.product.status === "active"
  );

  // Update wishlist if items were filtered out
  if (availableItems.length !== wishlist.items.length) {
    wishlist.items = availableItems;
    await wishlist.save();

    // Re-populate after save if needed
    await wishlist.populate(
      "items.product",
      "name price images slug originalPrice averageRating status"
    );
  }

  // Convert to plain object for response (optional)
  const wishlistResponse = wishlist.toObject ? wishlist.toObject() : wishlist;

  res.json({
    success: true,
    wishlist: wishlistResponse,
  });
});

// @desc    Add item to wishlist
// @route   POST /api/wishlist/add
// @access  Private
const addToWishlist = asyncHandler(async (req, res) => {
  console.log("=== addToWishlist START ===");
  console.log("Request body:", JSON.stringify(req.body, null, 2));
  console.log("User ID:", req.user?.id);

  try {
    const { productId } = req.body;

    if (!productId) {
      console.log("❌ ERROR: productId is required");
      res.status(400);
      throw new Error("Product ID is required");
    }

    // Validate product
    const product = await Product.findById(productId);

    if (!product) {
      console.log("❌ ERROR: Product not found");
      res.status(404);
      throw new Error("Product not found");
    }

    if (product.status !== "active") {
      console.log("❌ ERROR: Product not active");
      res.status(400);
      throw new Error("Product is not available");
    }

    // Get or create wishlist
    let wishlist = await Wishlist.findOne({ user: req.user.id });

    if (!wishlist) {
      wishlist = await Wishlist.create({
        user: req.user.id,
        items: [],
      });
      console.log("New wishlist created");
    }

    // Check if product already in wishlist
    const exists = wishlist.items.some(
      (item) => item.product.toString() === productId
    );

    if (exists) {
      console.log("❌ ERROR: Product already in wishlist");
      res.status(400);
      throw new Error("Product already in wishlist");
    }

    // Add to wishlist
    wishlist.items.push({
      product: productId,
      addedAt: new Date(),
    });

    await wishlist.save();

    try {
      // Try to populate, but don't fail if it errors
      await wishlist.populate("items.product", "name price images slug status");
      console.log("Product populated successfully");
    } catch (populateError) {
      console.warn(
        "Warning: Could not populate product:",
        populateError.message
      );
      // Continue without populated data
    }

    // Manually prepare response to avoid virtual getter issues
    const responseData = {
      success: true,
      message: "Added to wishlist",
      wishlist: {
        _id: wishlist._id,
        user: wishlist.user,
        items: wishlist.items.map((item) => {
          const itemData = {
            _id: item._id,
            product: item.product,
            addedAt: item.addedAt,
          };

          // If product was populated, add its data
          if (item.product && typeof item.product === "object") {
            itemData.product = {
              _id: item.product._id,
              name: item.product.name,
              price: item.product.price,
              images: item.product.images || [],
              slug: item.product.slug,
              status: item.product.status,
              // Don't include virtuals
            };
          }

          return itemData;
        }),
        createdAt: wishlist.createdAt,
        updatedAt: wishlist.updatedAt,
      },
    };

    console.log("=== addToWishlist SUCCESS ===");
    res.json(responseData);
  } catch (error) {
    console.log("=== addToWishlist ERROR ===");
    console.error("Error:", error.message);
    console.error("Stack:", error.stack);

    // Ensure we always send a response
    if (!res.headersSent) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Internal server error",
        error: process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  }
});

// @desc    Remove item from wishlist
// @route   DELETE /api/wishlist/:itemId
// @access  Private
const removeFromWishlist = asyncHandler(async (req, res) => {
  const { itemId } = req.params; // This should be productId, not wishlist item ID

  console.log("=== removeFromWishlist START ===");
  console.log("Looking for productId:", itemId);
  console.log("User ID:", req.user.id);

  const wishlist = await Wishlist.findOne({ user: req.user.id });

  if (!wishlist) {
    console.log("❌ Wishlist not found for user");
    res.status(404);
    throw new Error("Wishlist not found");
  }

  console.log(
    "Current wishlist items:",
    wishlist.items.map((item) => ({
      wishlistItemId: item._id,
      productId: item.product.toString(),
    }))
  );

  const initialCount = wishlist.items.length;

  // Filter by product ID (not wishlist item ID)
  wishlist.items = wishlist.items.filter(
    (item) => item.product.toString() !== itemId
  );

  console.log(`Items before: ${initialCount}, after: ${wishlist.items.length}`);

  if (wishlist.items.length === initialCount) {
    console.log("❌ Product not found in wishlist");
    res.status(404);
    throw new Error("Item not found in wishlist");
  }

  await wishlist.save();
  console.log("Wishlist saved successfully");

  await wishlist.populate("items.product", "name price images slug");
  console.log("Wishlist populated");

  console.log("=== removeFromWishlist SUCCESS ===");

  res.json({
    success: true,
    message: "Removed from wishlist",
    wishlist,
  });
});

// @desc    Move wishlist item to cart
// @route   POST /api/wishlist/:itemId/move-to-cart
// @access  Private
const moveToCart = asyncHandler(async (req, res) => {
  const wishlist = await Wishlist.findOne({ user: req.user.id });

  if (!wishlist) {
    res.status(404);
    throw new Error("Wishlist not found");
  }

  const itemIndex = wishlist.items.findIndex(
    (item) => item._id.toString() === req.params.itemId
  );

  if (itemIndex === -1) {
    res.status(404);
    throw new Error("Item not found in wishlist");
  }

  // Get product details
  const product = await Product.findById(wishlist.items[itemIndex].product);

  if (!product || product.status !== "active") {
    wishlist.items.splice(itemIndex, 1);
    await wishlist.save();

    res.status(400);
    throw new Error("Product is no longer available");
  }

  // Remove from wishlist
  wishlist.items.splice(itemIndex, 1);
  await wishlist.save();

  // Here you would call the cart controller to add the product to cart
  // For now, we'll return the product details so frontend can handle it
  res.json({
    success: true,
    message: "Product ready to add to cart",
    product: {
      id: product._id,
      name: product.name,
      price: product.price,
      images: product.images,
      slug: product.slug,
    },
  });
});

// @desc    Clear wishlist
// @route   DELETE /api/wishlist/clear
// @access  Private
const clearWishlist = asyncHandler(async (req, res) => {
  const wishlist = await Wishlist.findOne({ user: req.user.id });

  if (!wishlist) {
    res.status(404);
    throw new Error("Wishlist not found");
  }

  wishlist.items = [];
  await wishlist.save();

  res.json({
    success: true,
    message: "Wishlist cleared",
    wishlist,
  });
});

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  moveToCart,
  clearWishlist,
};
