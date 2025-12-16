const asyncHandler = require("express-async-handler");
const Cart = require("../models/Cart");
const Inventory = require("../models/Inventory");
const Product = require("../models/Product");

// @desc    Get user cart
// @route   GET /api/cart
// @access  Private
const getCart = asyncHandler(async (req, res) => {
  // Get cart as Mongoose document (no lean) so we can save it
  let cart = await Cart.findOne({ user: req.user.id }).populate(
    "items.product",
    "name price images slug status"
  );

  if (!cart) {
    // Create empty cart if not exists
    const newCart = await Cart.create({ user: req.user.id });
    return res.json({
      success: true,
      cart: newCart,
    });
  }

  // Check which items need to be removed (unavailable products)
  const itemsToRemove = [];

  for (let i = 0; i < cart.items.length; i++) {
    const item = cart.items[i];
    const product = item.product;

    if (!product || product.status !== "active") {
      itemsToRemove.push(i);
    }
  }

  // Remove unavailable items if any
  if (itemsToRemove.length > 0) {
    // Remove items in reverse order to maintain correct indices
    itemsToRemove.reverse().forEach((index) => {
      cart.items.splice(index, 1);
    });

    await cart.save();

    // Re-populate after saving
    await cart.populate("items.product", "name price images slug status");
  }

  // Transform cart items for response
  const transformedItems = cart.items.map((item) => ({
    _id: item._id,
    product: {
      id: item.product._id,
      name: item.product.name,
      price: item.product.price,
      images: item.product.images || [],
      slug: item.product.slug,
      inStock: item.product.stock > 0,
      status: item.product.status,
    },
    quantity: item.quantity,
    selectedSize: item.selectedSize,
    selectedColor: item.selectedColor,
    addedAt: item.addedAt,
  }));

  res.json({
    success: true,
    cart: {
      _id: cart._id,
      user: cart.user,
      items: transformedItems,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
      // Add cart summary if needed
      summary: {
        itemCount: transformedItems.length,
        totalItems: transformedItems.reduce(
          (sum, item) => sum + item.quantity,
          0
        ),
        subtotal: transformedItems.reduce(
          (sum, item) => sum + item.product.price * item.quantity,
          0
        ),
      },
    },
  });
});

// @desc    Add item to cart
// @route   POST /api/cart/add
// @access  Private
// @desc    Add item to cart
// @route   POST /api/cart/add
// @access  Private
const addToCart = asyncHandler(async (req, res) => {
  const { productId, quantity = 1, color, size } = req.body;

  if (!productId) {
    res.status(400);
    throw new Error("Product ID is required");
  }

  // Validate product
  const product = await Product.findById(productId);
  if (!product || product.status !== "active") {
    res.status(404);
    throw new Error("Product not found or unavailable");
  }

  // Find inventory for this product (and variant if provided)
  let inventoryQuery = { product: productId };

  // Add variant filters if color/size provided
  if (color || size) {
    inventoryQuery["variant.color"] = color || null;
    inventoryQuery["variant.size"] = size || null;
  }

  // Check inventory - find the specific inventory record
  const inventory = await Inventory.findOne(inventoryQuery);

  if (!inventory) {
    res.status(404);
    throw new Error(
      `Inventory not found for this product${
        color || size
          ? ` with ${color ? "color: " + color : ""}${
              color && size ? " and " : ""
            }${size ? "size: " + size : ""}`
          : ""
      }`
    );
  }

  // Check available stock (currentStock - reservedStock)
  const availableStock = Math.max(
    0,
    inventory.currentStock - inventory.reservedStock
  );

  if (availableStock < quantity) {
    res.status(400);
    throw new Error(
      `Not enough stock available. Only ${availableStock} items in stock${
        color || size
          ? ` for ${color ? "color: " + color : ""}${
              color && size ? " and " : ""
            }${size ? "size: " + size : ""}`
          : ""
      }`
    );
  }

  // Get or create cart
  let cart = await Cart.findOne({ user: req.user.id });
  if (!cart) {
    cart = await Cart.create({ user: req.user.id, items: [] });
  }

  // Check if item already exists with same product, color, and size
  const existingItemIndex = cart.items.findIndex((item) => {
    const sameProduct = item.product.toString() === productId;
    const sameColor = item.color === (color || null);
    const sameSize = item.size === (size || null);
    return sameProduct && sameColor && sameSize;
  });

  if (existingItemIndex > -1) {
    // Check if adding the quantity would exceed available stock
    const newTotalQuantity = cart.items[existingItemIndex].quantity + quantity;
    if (availableStock < newTotalQuantity) {
      res.status(400);
      throw new Error(
        `Cannot add ${quantity} more items. You already have ${cart.items[existingItemIndex].quantity} in cart, total would exceed available stock of ${availableStock}`
      );
    }

    // Update quantity
    cart.items[existingItemIndex].quantity += quantity;
  } else {
    // Add new item
    cart.items.push({
      product: productId,
      quantity,
      color: color || null,
      size: size || null,
      price: product.price,
      name: product.name,
      image: product.images[0] || "",
    });
  }

  await cart.save();

  // Populate product info
  await cart.populate("items.product", "name price images slug");

  res.json({
    success: true,
    message: "Item added to cart",
    cart,
  });
});

// @desc    Update cart item quantity
// @route   PUT /api/cart/:itemId
// @access  Private
// @desc    Update cart item quantity
// @route   PUT /api/cart/:itemId
// @access  Private
const updateCartItem = asyncHandler(async (req, res) => {
  const { quantity } = req.body;

  if (quantity < 1) {
    res.status(400);
    throw new Error("Quantity must be at least 1");
  }

  const cart = await Cart.findOne({ user: req.user.id });
  if (!cart) {
    res.status(404);
    throw new Error("Cart not found");
  }

  const itemIndex = cart.items.findIndex(
    (item) => item._id.toString() === req.params.itemId
  );

  if (itemIndex === -1) {
    res.status(404);
    throw new Error("Item not found in cart");
  }

  const cartItem = cart.items[itemIndex];

  // Validate product
  const product = await Product.findById(cartItem.product);
  if (!product || product.status !== "active") {
    cart.items.splice(itemIndex, 1);
    await cart.save();
    res.status(400);
    throw new Error("Product is no longer available");
  }

  // Check inventory for this specific variant
  let inventoryQuery = { product: cartItem.product };
  if (cartItem.color || cartItem.size) {
    inventoryQuery["variant.color"] = cartItem.color || null;
    inventoryQuery["variant.size"] = cartItem.size || null;
  }

  const inventory = await Inventory.findOne(inventoryQuery);

  if (!inventory) {
    res.status(404);
    throw new Error("Inventory not found for this product variant");
  }

  // Check available stock
  const availableStock = Math.max(
    0,
    inventory.currentStock - inventory.reservedStock
  );

  if (availableStock < quantity) {
    res.status(400);
    throw new Error(
      `Not enough stock available. Only ${availableStock} items in stock${
        cartItem.color || cartItem.size
          ? ` for ${cartItem.color ? "color: " + cartItem.color : ""}${
              cartItem.color && cartItem.size ? " and " : ""
            }${cartItem.size ? "size: " + cartItem.size : ""}`
          : ""
      }`
    );
  }

  cart.items[itemIndex].quantity = quantity;
  await cart.save();

  await cart.populate("items.product", "name price images slug");

  res.json({
    success: true,
    message: "Cart updated",
    cart,
  });
});

// @desc    Remove item from cart
// @route   DELETE /api/cart/:itemId
// @access  Private
const removeCartItem = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user.id });
  if (!cart) {
    res.status(404);
    throw new Error("Cart not found");
  }

  const itemIndex = cart.items.findIndex(
    (item) => item._id.toString() === req.params.itemId
  );

  if (itemIndex === -1) {
    res.status(404);
    throw new Error("Item not found in cart");
  }

  cart.items.splice(itemIndex, 1);
  await cart.save();

  await cart.populate("items.product", "name price images slug");

  res.json({
    success: true,
    message: "Item removed from cart",
    cart,
  });
});

// @desc    Clear cart
// @route   DELETE /api/cart/clear
// @access  Private
const clearCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user.id });
  if (!cart) {
    res.status(404);
    throw new Error("Cart not found");
  }

  cart.items = [];
  await cart.save();

  res.json({
    success: true,
    message: "Cart cleared",
    cart,
  });
});

// @desc    Apply coupon to cart
// @route   POST /api/cart/coupon
// @access  Private
const applyCoupon = asyncHandler(async (req, res) => {
  const { code } = req.body;

  // This is a simplified version. You would normally:
  // 1. Validate coupon from database
  // 2. Check expiration
  // 3. Apply discount logic
  // 4. Recalculate totals

  // For now, we'll simulate a 10% discount
  const cart = await Cart.findOne({ user: req.user.id });
  if (!cart) {
    res.status(404);
    throw new Error("Cart not found");
  }

  // Simulate coupon validation
  const validCoupons = ["SUMMER25", "NEW10", "FREESHIP"];

  if (!validCoupons.includes(code.toUpperCase())) {
    res.status(400);
    throw new Error("Invalid coupon code");
  }

  // Apply discount based on code
  let discountAmount = 0;

  switch (code.toUpperCase()) {
    case "SUMMER25":
      discountAmount = cart.subtotal * 0.25;
      break;
    case "NEW10":
      discountAmount = cart.subtotal * 0.1;
      break;
    case "FREESHIP":
      cart.shipping = 0;
      break;
  }

  // Update cart with discount
  cart.discountAmount = discountAmount;
  cart.total = cart.subtotal + cart.shipping + cart.tax - discountAmount;

  // In a real app, you would save the coupon info
  cart.coupon = {
    code: code.toUpperCase(),
    discountAmount,
  };

  await cart.save();

  res.json({
    success: true,
    message: `Coupon "${code}" applied successfully`,
    cart,
  });
});

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  applyCoupon,
};
