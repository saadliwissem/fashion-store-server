const express = require("express");
const router = express.Router();
const productController = require("../controllers/adminProductController");
const { validateProduct } = require("../middleware/productValidation");
const { uploadMultiple } = require("../middleware/uploadMiddleware");
const upload = require("../middleware/upload");

// Admin routes
router.get("/", productController.getProducts);
router.get("/stats", productController.getProductStats);
router.get("/:id", productController.getProduct);
router.post(
  "/",
  validateProduct,
  upload.array("images", 10),
  productController.createProduct
);
router.put("/:id", validateProduct, productController.updateProduct);
router.delete("/:id", productController.deleteProduct);
router.put("/bulk", productController.bulkUpdateProducts);
router.put("/:id/stock", productController.updateProductStock);
router.post(
  "/:id/images",
  uploadMultiple("images", 10),
  productController.uploadProductImages
);

module.exports = router;
