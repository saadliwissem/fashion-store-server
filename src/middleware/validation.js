const { body, param, query } = require("express-validator");

exports.validateCategory = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Category name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Category name must be between 2 and 100 characters"),

  body("slug")
    .trim()
    .notEmpty()
    .withMessage("Slug is required")
    .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .withMessage(
      "Slug can only contain lowercase letters, numbers, and hyphens"
    ),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),

  body("status")
    .optional()
    .isIn(["active", "draft", "archived"])
    .withMessage("Status must be active, draft, or archived"),

  body("displayOrder")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Display order must be a positive integer"),

  body("seo.title")
    .optional()
    .trim()
    .isLength({ max: 60 })
    .withMessage("SEO title cannot exceed 60 characters"),

  body("seo.description")
    .optional()
    .trim()
    .isLength({ max: 160 })
    .withMessage("SEO description cannot exceed 160 characters"),

  body("parent")
    .optional()
    .isMongoId()
    .withMessage("Parent must be a valid MongoDB ID"),
];
