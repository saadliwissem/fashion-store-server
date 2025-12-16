const asyncHandler = require("express-async-handler");
const Inventory = require("../models/Inventory");
const Product = require("../models/Product");
const mongoose = require("mongoose");

// @desc    Get all inventory items
// @route   GET /api/admin/inventory
// @access  Private/Admin
const getInventory = asyncHandler(async (req, res) => {
  const {
    search,
    status,
    category,
    lowStock,
    page = 1,
    limit = 10,
    sortBy = "currentStock",
    sortOrder = "asc",
  } = req.query;

  const query = {};

  // Search filter
  if (search) {
    query.$or = [
      { "product.name": { $regex: search, $options: "i" } },
      { "product.sku": { $regex: search, $options: "i" } },
      { location: { $regex: search, $options: "i" } },
    ];
  }

  // Status filter
  if (status && status !== "all") {
    query.status = status;
  }

  // Low stock filter
  if (lowStock === "true") {
    query.currentStock = { $lte: query.lowStockThreshold || 10 };
  }

  // Category filter
  if (category && category !== "all") {
    query["product.category.name"] = category;
  }

  // Sort configuration
  const sort = {};
  if (sortBy) {
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;
  }

  // Pagination
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  // Get total count
  const total = await Inventory.countDocuments(query);

  // Get inventory with populated product data
  const inventory = await Inventory.find(query)
    .populate({
      path: "product",
      select: "name sku category price costPrice images",
      populate: {
        path: "category",
        select: "name slug",
      },
    })
    .sort(sort)
    .skip(skip)
    .limit(limitNum)
    .lean();

  // Transform data for frontend
  const transformedInventory = inventory.map((item) => {
    const product = item.product || {};
    return {
      id: item._id,
      productId: product._id,
      name: product.name || "N/A",
      sku: product.sku || "N/A",
      category: product.category?.name || "Uncategorized",
      subCategory: product.subCategory || "",
      color: item.variant?.color || "Default",
      size: item.variant?.size || "One Size",
      currentStock: item.currentStock,
      initialStock:
        item.currentStock +
        (item.movements?.reduce((sum, mov) => sum + mov.quantity, 0) || 0),
      lowStockThreshold: item.lowStockThreshold,
      soldLastMonth:
        item.movements
          ?.filter(
            (m) =>
              m.type === "out" &&
              new Date(m.createdAt) >
                new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          )
          .reduce((sum, mov) => sum + mov.quantity, 0) || 0,
      soldLastWeek:
        item.movements
          ?.filter(
            (m) =>
              m.type === "out" &&
              new Date(m.createdAt) >
                new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          )
          .reduce((sum, mov) => sum + mov.quantity, 0) || 0,
      status: item.status,
      location: item.location,
      lastUpdated: item.updatedAt,
      cost: item.unitCost || product.costPrice || 0,
      price: product.price || 0,
      profitPerUnit:
        (product.price || 0) - (item.unitCost || product.costPrice || 0),
      availableStock: item.availableStock,
    };
  });

  res.json({
    success: true,
    data: transformedInventory,
    pagination: {
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      limit: limitNum,
    },
  });
});

// @desc    Get inventory stats
// @route   GET /api/admin/inventory/stats
// @access  Private/Admin
const getInventoryStats = asyncHandler(async (req, res) => {
  const stats = await Inventory.aggregate([
    {
      $group: {
        _id: null,
        totalItems: { $sum: 1 },
        totalStockValue: {
          $sum: { $multiply: ["$currentStock", "$unitCost"] },
        },
        outOfStockItems: {
          $sum: { $cond: [{ $eq: ["$status", "out-of-stock"] }, 1, 0] },
        },
        lowStockItems: {
          $sum: { $cond: [{ $eq: ["$status", "low-stock"] }, 1, 0] },
        },
        averageStock: { $avg: "$currentStock" },
        totalAvailableStock: { $sum: "$availableStock" },
      },
    },
  ]);

  // Get monthly sales
  const monthlySales = await Inventory.aggregate([
    { $unwind: "$movements" },
    {
      $match: {
        "movements.type": "out",
        "movements.createdAt": {
          $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    },
    {
      $group: {
        _id: null,
        totalSales: { $sum: "$movements.quantity" },
      },
    },
  ]);

  const result = {
    totalItems: stats[0]?.totalItems || 0,
    totalStockValue: stats[0]?.totalStockValue || 0,
    outOfStockItems: stats[0]?.outOfStockItems || 0,
    lowStockItems: stats[0]?.lowStockItems || 0,
    totalSalesLastMonth: monthlySales[0]?.totalSales || 0,
    averageStock: Math.round(stats[0]?.averageStock || 0),
    totalAvailableStock: stats[0]?.totalAvailableStock || 0,
  };

  res.json({
    success: true,
    data: result,
  });
});

// @desc    Update inventory stock
// @route   PUT /api/admin/inventory/:id/stock
// @access  Private/Admin
const updateInventoryStock = asyncHandler(async (req, res) => {
  const { quantity, reason, note } = req.body;
  const { id } = req.params;

  const inventory = await Inventory.findById(id);
  if (!inventory) {
    res.status(404);
    throw new Error("Inventory item not found");
  }

  // Calculate new stock
  const newStock = inventory.currentStock + quantity;
  if (newStock < 0) {
    res.status(400);
    throw new Error("Stock cannot be negative");
  }

  // Add movement record
  const movement = {
    type: quantity > 0 ? "in" : "out",
    quantity: Math.abs(quantity),
    reason: reason || (quantity > 0 ? "manual_addition" : "manual_reduction"),
    note,
    user: req.user._id,
    createdAt: new Date(),
  };

  inventory.currentStock = newStock;
  inventory.movements.push(movement);
  inventory.lastUpdated = new Date();

  await inventory.save();

  // Populate product for response
  await inventory.populate({
    path: "product",
    select: "name sku category price",
    populate: {
      path: "category",
      select: "name",
    },
  });

  res.json({
    success: true,
    data: inventory,
    message: `Stock updated successfully. New stock: ${newStock}`,
  });
});

// @desc    Bulk update inventory
// @route   PUT /api/admin/inventory/bulk
// @access  Private/Admin
const bulkUpdateInventory = asyncHandler(async (req, res) => {
  const { items, quantity, reason, note } = req.body;

  if (!items || !items.length) {
    res.status(400);
    throw new Error("No items selected");
  }

  if (quantity === undefined || quantity === null) {
    res.status(400);
    throw new Error("Quantity is required");
  }

  const results = [];
  const errors = [];

  for (const itemId of items) {
    try {
      const inventory = await Inventory.findById(itemId);
      if (!inventory) {
        errors.push({ itemId, error: "Item not found" });
        continue;
      }

      const newStock = inventory.currentStock + quantity;
      if (newStock < 0) {
        errors.push({ itemId, error: "Stock cannot be negative" });
        continue;
      }

      // Add movement record
      const movement = {
        type: quantity > 0 ? "in" : "out",
        quantity: Math.abs(quantity),
        reason: reason || (quantity > 0 ? "bulk_addition" : "bulk_reduction"),
        note: note || `Bulk update: ${quantity > 0 ? "+" : ""}${quantity}`,
        user: req.user._id,
        createdAt: new Date(),
      };

      inventory.currentStock = newStock;
      inventory.movements.push(movement);
      inventory.lastUpdated = new Date();

      await inventory.save();
      results.push({
        itemId,
        success: true,
        newStock,
      });
    } catch (error) {
      errors.push({ itemId, error: error.message });
    }
  }

  res.json({
    success: true,
    data: {
      updated: results.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
    },
    message: `Updated ${results.length} items successfully`,
  });
});

// @desc    Generate reorder report
// @route   POST /api/admin/inventory/reorder-report
// @access  Private/Admin
const generateReorderReport = asyncHandler(async (req, res) => {
  const { threshold } = req.body;

  const lowStockItems = await Inventory.find({
    $or: [
      { status: "low-stock" },
      { status: "out-of-stock" },
      {
        currentStock: { $lte: threshold || 10 },
      },
    ],
  })
    .populate({
      path: "product",
      select: "name sku category supplier leadTime",
    })
    .lean();

  const report = lowStockItems.map((item) => {
    const product = item.product || {};
    const suggestedOrder = Math.max(
      item.reorderQuantity || 50,
      (item.lowStockThreshold || 10) - item.currentStock
    );

    return {
      productId: product._id,
      name: product.name,
      sku: product.sku,
      currentStock: item.currentStock,
      lowStockThreshold: item.lowStockThreshold,
      status: item.status,
      suggestedOrder,
      leadTime: product.leadTime || 7,
      supplier: product.supplier || "Default Supplier",
      location: item.location,
      unitCost: item.unitCost,
      totalCost: item.unitCost ? item.unitCost * suggestedOrder : 0,
    };
  });

  res.json({
    success: true,
    data: report,
    summary: {
      totalItems: report.length,
      totalUnits: report.reduce((sum, item) => sum + item.suggestedOrder, 0),
      totalCost: report.reduce((sum, item) => sum + item.totalCost, 0),
    },
  });
});

// @desc    Export inventory to CSV
// @route   GET /api/admin/inventory/export
// @access  Private/Admin
const exportInventory = asyncHandler(async (req, res) => {
  const inventory = await Inventory.find()
    .populate({
      path: "product",
      select: "name sku category price costPrice",
      populate: {
        path: "category",
        select: "name",
      },
    })
    .lean();

  // Convert to CSV format
  const csvData = [
    [
      "SKU",
      "Product Name",
      "Category",
      "Color",
      "Size",
      "Current Stock",
      "Available Stock",
      "Status",
      "Location",
      "Unit Cost",
      "Price",
      "Stock Value",
      "Last Updated",
    ].join(","),
  ];

  inventory.forEach((item) => {
    const product = item.product || {};
    const row = [
      product.sku || "",
      product.name || "",
      product.category?.name || "",
      item.variant?.color || "",
      item.variant?.size || "",
      item.currentStock,
      item.availableStock,
      item.status,
      item.location || "",
      item.unitCost || product.costPrice || 0,
      product.price || 0,
      (item.currentStock * (item.unitCost || product.costPrice || 0)).toFixed(
        2
      ),
      new Date(item.updatedAt).toLocaleDateString(),
    ]
      .map((field) => `"${field}"`)
      .join(",");

    csvData.push(row);
  });

  const csv = csvData.join("\n");
  const filename = `inventory-export-${
    new Date().toISOString().split("T")[0]
  }.csv`;

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
});

// @desc    Delete inventory item
// @route   DELETE /api/admin/inventory/:id
// @access  Private/Admin
const deleteInventoryItem = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const inventory = await Inventory.findById(id);
  if (!inventory) {
    res.status(404);
    throw new Error("Inventory item not found");
  }

  // Check if there's stock
  if (inventory.currentStock > 0) {
    res.status(400);
    throw new Error("Cannot delete inventory item with existing stock");
  }

  await inventory.deleteOne();

  res.json({
    success: true,
    message: "Inventory item deleted successfully",
  });
});
// @desc    Get single inventory item
// @route   GET /api/admin/inventory/:id
// @access  Private/Admin
const getInventoryItem = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const inventory = await Inventory.findById(id).populate({
    path: "product",
    select: "name sku category price costPrice images variants",
    populate: {
      path: "category",
      select: "name slug",
    },
  });

  if (!inventory) {
    res.status(404);
    throw new Error("Inventory item not found");
  }

  // Transform data for frontend
  const product = inventory.product || {};
  const transformedItem = {
    id: inventory._id,
    productId: product._id,
    name: product.name || "N/A",
    sku: product.sku || "N/A",
    category: product.category?.name || "Uncategorized",
    subCategory: product.subCategory || "",
    color: inventory.variant?.color || "Default",
    size: inventory.variant?.size || "One Size",
    currentStock: inventory.currentStock,
    initialStock:
      inventory.currentStock +
      (inventory.movements?.reduce((sum, mov) => sum + mov.quantity, 0) || 0),
    lowStockThreshold: inventory.lowStockThreshold,
    soldLastMonth:
      inventory.movements
        ?.filter(
          (m) =>
            m.type === "out" &&
            new Date(m.createdAt) >
              new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        )
        .reduce((sum, mov) => sum + mov.quantity, 0) || 0,
    soldLastWeek:
      inventory.movements
        ?.filter(
          (m) =>
            m.type === "out" &&
            new Date(m.createdAt) >
              new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        )
        .reduce((sum, mov) => sum + mov.quantity, 0) || 0,
    status: inventory.status,
    location: inventory.location,
    lastUpdated: inventory.updatedAt,
    cost: inventory.unitCost || product.costPrice || 0,
    price: product.price || 0,
    profitPerUnit:
      (product.price || 0) - (inventory.unitCost || product.costPrice || 0),
    availableStock: inventory.availableStock,
    reservedStock: inventory.reservedStock,
    movements: inventory.movements || [],
    reorderPoint: inventory.reorderPoint,
    reorderQuantity: inventory.reorderQuantity,
    supplier: inventory.supplier,
    leadTime: inventory.leadTime,
    warehouse: inventory.warehouse,
    lastRestocked: inventory.lastRestocked,
    lastSold: inventory.lastSold,
  };

  res.json({
    success: true,
    data: transformedItem,
  });
});

// @desc    Update inventory item details
// @route   PUT /api/admin/inventory/:id
// @access  Private/Admin
const updateInventoryItem = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    location,
    lowStockThreshold,
    reorderPoint,
    reorderQuantity,
    supplier,
    leadTime,
    warehouse,
    unitCost,
    variant,
  } = req.body;

  const inventory = await Inventory.findById(id);
  if (!inventory) {
    res.status(404);
    throw new Error("Inventory item not found");
  }

  // Update fields
  if (location !== undefined) inventory.location = location;
  if (lowStockThreshold !== undefined)
    inventory.lowStockThreshold = lowStockThreshold;
  if (reorderPoint !== undefined) inventory.reorderPoint = reorderPoint;
  if (reorderQuantity !== undefined)
    inventory.reorderQuantity = reorderQuantity;
  if (supplier !== undefined) inventory.supplier = supplier;
  if (leadTime !== undefined) inventory.leadTime = leadTime;
  if (warehouse !== undefined) inventory.warehouse = warehouse;
  if (unitCost !== undefined) inventory.unitCost = unitCost;
  if (variant !== undefined) inventory.variant = variant;

  inventory.lastUpdated = new Date();

  await inventory.save();

  // Populate for response
  await inventory.populate({
    path: "product",
    select: "name sku category price",
    populate: {
      path: "category",
      select: "name",
    },
  });

  res.json({
    success: true,
    data: inventory,
    message: "Inventory item updated successfully",
  });
});

// @desc    Get inventory movements
// @route   GET /api/admin/inventory/movements
// @access  Private/Admin
const getInventoryMovements = asyncHandler(async (req, res) => {
  const {
    type,
    startDate,
    endDate,
    productId,
    page = 1,
    limit = 20,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  const query = {};

  // Type filter
  if (type && type !== "all") {
    query.type = type;
  }

  // Date range filter
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  // Product filter
  if (productId) {
    query.product = productId;
  }

  // Sort configuration
  const sort = {};
  if (sortBy) {
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;
  }

  // Pagination
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  // First, get inventory items with movements that match the query
  const inventoryItems = await Inventory.find({
    movements: { $exists: true, $ne: [] },
    ...(productId && { product: productId }),
  })
    .populate({
      path: "product",
      select: "name sku",
    })
    .select("_id product variant movements")
    .lean();

  // Extract and flatten movements
  let allMovements = [];
  inventoryItems.forEach((item) => {
    if (item.movements && item.movements.length > 0) {
      item.movements.forEach((movement) => {
        // Apply filters to each movement
        const matchesType = !type || type === "all" || movement.type === type;
        const matchesDate =
          (!startDate || new Date(movement.createdAt) >= new Date(startDate)) &&
          (!endDate || new Date(movement.createdAt) <= new Date(endDate));

        if (matchesType && matchesDate) {
          allMovements.push({
            ...movement,
            inventoryId: item._id,
            product: item.product,
            variant: item.variant,
            _id: movement._id || mongoose.Types.ObjectId(), // Ensure unique ID
          });
        }
      });
    }
  });

  // Apply sorting
  allMovements.sort((a, b) => {
    const aValue = a[sortBy];
    const bValue = b[sortBy];
    const multiplier = sortOrder === "desc" ? -1 : 1;

    if (aValue < bValue) return -1 * multiplier;
    if (aValue > bValue) return 1 * multiplier;
    return 0;
  });

  // Apply pagination
  const total = allMovements.length;
  const paginatedMovements = allMovements.slice(skip, skip + limitNum);

  res.json({
    success: true,
    data: paginatedMovements,
    pagination: {
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      limit: limitNum,
    },
  });
});

// @desc    Add inventory movement
// @route   POST /api/admin/inventory/movements
// @access  Private/Admin
const addInventoryMovement = asyncHandler(async (req, res) => {
  const {
    inventoryId,
    type,
    quantity,
    reason,
    reference,
    note,
    adjustStock = true,
  } = req.body;

  // Validate required fields
  if (!inventoryId || !type || quantity === undefined) {
    res.status(400);
    throw new Error("Inventory ID, type, and quantity are required");
  }

  const inventory = await Inventory.findById(inventoryId);
  if (!inventory) {
    res.status(404);
    throw new Error("Inventory item not found");
  }

  // Create movement record
  const movement = {
    type,
    quantity: Math.abs(quantity),
    reason: reason || "manual_adjustment",
    reference,
    note,
    user: req.user._id,
    createdAt: new Date(),
  };

  // Adjust stock if requested
  if (adjustStock) {
    if (type === "in" || type === "return") {
      inventory.currentStock += quantity;
    } else if (type === "out" || type === "damage") {
      const newStock = inventory.currentStock - quantity;
      if (newStock < 0) {
        res.status(400);
        throw new Error("Insufficient stock for this movement");
      }
      inventory.currentStock = newStock;
    }
    // For "adjustment" type, we don't adjust automatically
    // The frontend should calculate the difference
  }

  // Add movement to history
  inventory.movements.push(movement);
  inventory.lastUpdated = new Date();

  // Update lastSold date for outgoing movements
  if (type === "out") {
    inventory.lastSold = new Date();
  }

  // Update lastRestocked date for incoming movements
  if (type === "in") {
    inventory.lastRestocked = new Date();
  }

  await inventory.save();

  // Populate for response
  await inventory.populate({
    path: "product",
    select: "name sku",
  });

  res.status(201).json({
    success: true,
    data: {
      movement,
      inventory: {
        id: inventory._id,
        currentStock: inventory.currentStock,
        availableStock: inventory.availableStock,
        product: inventory.product,
      },
    },
    message: "Inventory movement recorded successfully",
  });
});

// @desc    Sync inventory from products (one-time migration or sync)
// @route   POST /api/admin/inventory/sync
// @access  Private/Admin
const syncInventoryFromProducts = asyncHandler(async (req, res) => {
  const { force = false } = req.body;

  // Get all products
  const products = await Product.find({
    status: { $in: ["active", "draft"] },
  }).lean();

  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const product of products) {
    // Check if inventory already exists for this product
    const existingInventory = await Inventory.findOne({
      product: product._id,
    });

    if (existingInventory && !force) {
      skippedCount++;
      continue;
    }

    // Handle products with variants
    if (product.variants && product.variants.length > 0) {
      for (const variant of product.variants) {
        const variantInventory = await Inventory.findOne({
          product: product._id,
          "variant.color": variant.color,
          "variant.size": variant.size,
        });

        if (!variantInventory || force) {
          await Inventory.findOneAndUpdate(
            {
              product: product._id,
              "variant.color": variant.color,
              "variant.size": variant.size,
            },
            {
              product: product._id,
              variant: {
                color: variant.color,
                size: variant.size,
              },
              currentStock: variant.stock || 0,
              unitCost: product.costPrice || 0,
              lowStockThreshold: product.lowStockThreshold || 10,
              location: `A${Math.floor(Math.random() * 10) + 1}-${
                Math.floor(Math.random() * 20) + 1
              }`,
              status:
                (variant.stock || 0) <= (product.lowStockThreshold || 10)
                  ? "low-stock"
                  : (variant.stock || 0) > 0
                  ? "in-stock"
                  : "out-of-stock",
            },
            { upsert: true, new: true }
          );

          if (variantInventory) {
            updatedCount++;
          } else {
            createdCount++;
          }
        } else {
          skippedCount++;
        }
      }
    } else {
      // Handle products without variants
      if (!existingInventory || force) {
        await Inventory.findOneAndUpdate(
          { product: product._id, variant: { $exists: false } },
          {
            product: product._id,
            currentStock: product.stock || 0,
            unitCost: product.costPrice || 0,
            lowStockThreshold: product.lowStockThreshold || 10,
            location: `A${Math.floor(Math.random() * 10) + 1}-${
              Math.floor(Math.random() * 20) + 1
            }`,
            status:
              (product.stock || 0) <= (product.lowStockThreshold || 10)
                ? "low-stock"
                : (product.stock || 0) > 0
                ? "in-stock"
                : "out-of-stock",
          },
          { upsert: true, new: true }
        );

        if (existingInventory) {
          updatedCount++;
        } else {
          createdCount++;
        }
      } else {
        skippedCount++;
      }
    }
  }

  res.json({
    success: true,
    data: {
      created: createdCount,
      updated: updatedCount,
      skipped: skippedCount,
      total: products.length,
    },
    message: `Inventory sync completed. Created: ${createdCount}, Updated: ${updatedCount}, Skipped: ${skippedCount}`,
  });
});

// @desc    Get low stock alerts
// @route   GET /api/admin/inventory/alerts
// @access  Private/Admin
const getLowStockAlerts = asyncHandler(async (req, res) => {
  const { threshold } = req.query;

  const lowStockItems = await Inventory.find({
    $or: [
      { status: "low-stock" },
      { status: "out-of-stock" },
      {
        currentStock: { $lte: parseInt(threshold) || 10 },
      },
    ],
  })
    .populate({
      path: "product",
      select: "name sku category images price",
      populate: {
        path: "category",
        select: "name",
      },
    })
    .sort({ currentStock: 1 })
    .limit(50)
    .lean();

  const alerts = lowStockItems.map((item) => {
    const product = item.product || {};
    return {
      id: item._id,
      productId: product._id,
      name: product.name,
      sku: product.sku,
      currentStock: item.currentStock,
      lowStockThreshold: item.lowStockThreshold,
      status: item.status,
      location: item.location,
      category: product.category?.name,
      price: product.price,
      image: product.images?.[0] || null,
      urgency:
        item.currentStock === 0
          ? "critical"
          : item.currentStock <= item.lowStockThreshold / 2
          ? "high"
          : "medium",
      suggestedReorder: Math.max(
        item.reorderQuantity || 50,
        (item.lowStockThreshold || 10) - item.currentStock
      ),
    };
  });

  res.json({
    success: true,
    data: alerts,
    summary: {
      total: alerts.length,
      critical: alerts.filter((a) => a.urgency === "critical").length,
      high: alerts.filter((a) => a.urgency === "high").length,
      medium: alerts.filter((a) => a.urgency === "medium").length,
    },
  });
});

// @desc    Get inventory by product ID
// @route   GET /api/admin/inventory/product/:productId
// @access  Private/Admin
const getInventoryByProductId = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  const inventoryItems = await Inventory.find({ product: productId })
    .populate({
      path: "product",
      select: "name sku category price",
    })
    .sort({ "variant.color": 1, "variant.size": 1 })
    .lean();

  if (!inventoryItems.length) {
    res.status(404);
    throw new Error("No inventory found for this product");
  }

  // Group by variant for better presentation
  const variants = inventoryItems.map((item) => ({
    id: item._id,
    color: item.variant?.color || "Default",
    size: item.variant?.size || "One Size",
    currentStock: item.currentStock,
    availableStock: item.availableStock,
    status: item.status,
    location: item.location,
    lowStockThreshold: item.lowStockThreshold,
    lastUpdated: item.updatedAt,
  }));

  const product = inventoryItems[0].product;

  res.json({
    success: true,
    data: {
      product: {
        id: product._id,
        name: product.name,
        sku: product.sku,
        category: product.category?.name,
        price: product.price,
      },
      variants,
      summary: {
        totalStock: variants.reduce((sum, v) => sum + v.currentStock, 0),
        totalValue: variants.reduce(
          (sum, v) => sum + v.currentStock * (product.costPrice || 0),
          0
        ),
        lowStockCount: variants.filter((v) => v.status === "low-stock").length,
        outOfStockCount: variants.filter((v) => v.status === "out-of-stock")
          .length,
      },
    },
  });
});

module.exports = {
  getInventory,
  getInventoryItem,
  updateInventoryItem,
  updateInventoryStock,
  bulkUpdateInventory,
  deleteInventoryItem,
  getInventoryStats,
  generateReorderReport,
  exportInventory,
  getInventoryMovements,
  addInventoryMovement,
};
