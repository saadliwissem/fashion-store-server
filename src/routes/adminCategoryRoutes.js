const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/adminCategoryController");
const { validateCategory } = require("../middleware/validation");

// Public routes (if needed)
//router.get("/public", categoryController.getPublicCategories);

// Admin routes
router.get("/", categoryController.getCategories);
router.get("/stats", categoryController.getCategoryStats);
router.get("/:id", categoryController.getCategory);
router.post("/", validateCategory, categoryController.createCategory);
router.put("/:id", validateCategory, categoryController.updateCategory);
router.delete("/:id", categoryController.deleteCategory);
router.put("/order", categoryController.updateCategoriesOrder);
router.put("/bulk", categoryController.bulkUpdateCategories);

module.exports = router;
