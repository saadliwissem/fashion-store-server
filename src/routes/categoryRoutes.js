const express = require("express");
const router = express.Router();
const {
  getCategories,
  getCategoryBySlug,
  getFeaturedCategories,
  getCategoryBreadcrumbs,
} = require("../controllers/categoryController");

router.get("/", getCategories);
router.get("/featured", getFeaturedCategories);
router.get("/:slug", getCategoryBySlug);
router.get("/:slug/breadcrumbs", getCategoryBreadcrumbs);

module.exports = router;
