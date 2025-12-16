const express = require("express");
const {
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
  //   syncInventoryFromProducts,
  //   getLowStockAlerts,
  //   getInventoryByProductId,
} = require("../controllers/adminInventoryController");
const { protect, admin } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.use(admin);

router.route("/").get(getInventory);
router.route("/stats").get(getInventoryStats);
router.route("/export").get(exportInventory);
router.route("/reorder-report").post(generateReorderReport);
router.route("/bulk").put(bulkUpdateInventory);
router
  .route("/movements")
  .get(getInventoryMovements)
  .post(addInventoryMovement);
// router.route("/alerts").get(getLowStockAlerts);
// router.route("/sync").post(syncInventoryFromProducts);
// router.route("/product/:productId").get(getInventoryByProductId);

router
  .route("/:id")
  .get(getInventoryItem)
  .put(updateInventoryItem)
  .delete(deleteInventoryItem);

router.route("/:id/stock").put(updateInventoryStock);

module.exports = router;
