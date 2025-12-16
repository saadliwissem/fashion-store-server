const { body, param, query } = require("express-validator");

exports.validateProduct = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Product name is required")
    .isLength({ min: 3, max: 200 })
    .withMessage("Product name must be between 3 and 200 characters"),

  body("sku")
    .trim()
    .notEmpty()
    .withMessage("SKU is required")
    .isUppercase()
    .withMessage("SKU must be uppercase"),

  body("category")
    .notEmpty()
    .withMessage("Category is required")
    .isMongoId()
    .withMessage("Category must be a valid MongoDB ID"),

  body("price")
    .isFloat({ min: 0 })
    .withMessage("Price must be a positive number"),

  body("stock")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Stock must be a positive integer or zero"),

  body("description")
    .trim()
    .notEmpty()
    .withMessage("Description is required")
    .isLength({ min: 10 })
    .withMessage("Description must be at least 10 characters"),

  body("status")
    .optional()
    .isIn(["draft", "active", "out-of-stock", "archived"])
    .withMessage("Status must be draft, active, out-of-stock, or archived"),

  body("images").optional().isArray().withMessage("Images must be an array"),

  body("variants")
    .optional()
    .isArray()
    .withMessage("Variants must be an array"),
];
