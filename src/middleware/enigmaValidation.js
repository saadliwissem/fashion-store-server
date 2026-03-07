const { body, param, query } = require("express-validator");

// Enigma validation
exports.validateEnigma = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Enigma name is required")
    .isLength({ min: 3, max: 100 })
    .withMessage("Enigma name must be between 3 and 100 characters"),

  body("description")
    .trim()
    .notEmpty()
    .withMessage("Description is required")
    .isLength({ min: 10, max: 1000 })
    .withMessage("Description must be between 10 and 1000 characters"),

  body("lore")
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage("Lore cannot exceed 2000 characters"),

  body("status")
    .optional()
    .isIn(["active", "upcoming", "archived", "solved"])
    .withMessage("Status must be active, upcoming, archived, or solved"),

  body("difficulty")
    .optional()
    .isIn(["beginner", "intermediate", "advanced", "expert"])
    .withMessage(
      "Difficulty must be beginner, intermediate, advanced, or expert"
    ),

  body("featured")
    .optional()
    .isBoolean()
    .withMessage("Featured must be a boolean"),

  body("tags").optional().isArray().withMessage("Tags must be an array"),

  body("creator.name")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Creator name cannot exceed 100 characters"),

  body("rewards.*.name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Reward name is required if reward is provided"),
];

// Chronicle validation
exports.validateChronicle = [
  body("enigma")
    .notEmpty()
    .withMessage("Parent enigma ID is required")
    .isMongoId()
    .withMessage("Enigma ID must be a valid MongoDB ID"),

  body("name")
    .trim()
    .notEmpty()
    .withMessage("Chronicle name is required")
    .isLength({ min: 3, max: 100 })
    .withMessage("Chronicle name must be between 3 and 100 characters"),

  body("description")
    .trim()
    .notEmpty()
    .withMessage("Description is required")
    .isLength({ min: 10, max: 1000 })
    .withMessage("Description must be between 10 and 1000 characters"),

  body("lore")
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage("Lore cannot exceed 2000 characters"),

  body("difficulty")
    .optional()
    .isIn(["beginner", "intermediate", "advanced", "expert"])
    .withMessage(
      "Difficulty must be beginner, intermediate, advanced, or expert"
    ),

  body("status")
    .optional()
    .isIn(["available", "forging", "cipher", "solved"])
    .withMessage("Status must be available, forging, cipher, or solved"),

  body("productionStatus")
    .optional()
    .isIn([
      "awaiting",
      "design",
      "forging",
      "enchanting",
      "shipping",
      "delivered",
    ])
    .withMessage(
      "Production status must be awaiting, design, forging, enchanting, shipping, or delivered"
    ),

  body("basePrice")
    .isFloat({ min: 0 })
    .withMessage("Base price must be a positive number"),

  body("stats.requiredFragments")
    .isInt({ min: 1 })
    .withMessage("Required fragments must be at least 1"),

  body("featured")
    .optional()
    .isBoolean()
    .withMessage("Featured must be a boolean"),

  body("estimatedStartDate")
    .optional()
    .isISO8601()
    .withMessage("Estimated start date must be a valid date"),

  body("estimatedCompletion")
    .optional()
    .isISO8601()
    .withMessage("Estimated completion must be a valid date"),
];

// Fragment validation
exports.validateFragment = [
  body("chronicle")
    .notEmpty()
    .withMessage("Parent chronicle ID is required")
    .isMongoId()
    .withMessage("Chronicle ID must be a valid MongoDB ID"),

  body("number")
    .isInt({ min: 1 })
    .withMessage("Fragment number must be a positive integer"),

  body("name")
    .trim()
    .notEmpty()
    .withMessage("Fragment name is required")
    .isLength({ max: 100 })
    .withMessage("Fragment name cannot exceed 100 characters"),

  body("description")
    .trim()
    .notEmpty()
    .withMessage("Description is required")
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),

  body("price")
    .isFloat({ min: 0 })
    .withMessage("Price must be a positive number"),

  body("rarity")
    .optional()
    .isIn(["common", "rare", "legendary"])
    .withMessage("Rarity must be common, rare, or legendary"),

  body("estimatedDelivery")
    .optional()
    .isISO8601()
    .withMessage("Estimated delivery must be a valid date"),

  body("features")
    .optional()
    .isArray()
    .withMessage("Features must be an array"),

  body("clues.total")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Total clues must be at least 1"),
];

// Claim validation
exports.validateClaim = [
  body("fragmentId")
    .notEmpty()
    .withMessage("Fragment ID is required")
    .isMongoId()
    .withMessage("Fragment ID must be a valid MongoDB ID"),

  body("userData.fullName")
    .trim()
    .notEmpty()
    .withMessage("Full name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Full name must be between 2 and 100 characters"),

  body("userData.email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Valid email is required")
    .normalizeEmail(),

  body("userData.phone")
    .optional()
    .matches(/^\+?[\d\s\-\(\)]+$/)
    .withMessage("Please provide a valid phone number"),

  body("userData.shippingAddress.address")
    .if(body("userData.shippingAddress").exists())
    .notEmpty()
    .withMessage("Shipping address is required"),

  body("userData.shippingAddress.city")
    .if(body("userData.shippingAddress").exists())
    .notEmpty()
    .withMessage("City is required"),

  body("userData.shippingAddress.postalCode")
    .if(body("userData.shippingAddress").exists())
    .notEmpty()
    .withMessage("Postal code is required"),

  body("userData.shippingAddress.country")
    .if(body("userData.shippingAddress").exists())
    .notEmpty()
    .withMessage("Country is required"),

  body("userData.acceptTerms")
    .isBoolean()
    .equals("true")
    .withMessage("Terms must be accepted"),

  body("paymentMethod")
    .isIn(["stripe", "paypal", "crypto"])
    .withMessage("Valid payment method required"),
];

// Waitlist validation
exports.validateWaitlist = [
  body("chronicleId")
    .notEmpty()
    .withMessage("Chronicle ID is required")
    .isMongoId()
    .withMessage("Chronicle ID must be a valid MongoDB ID"),

  body("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Valid email is required")
    .normalizeEmail(),

  body("preferences.notifyOnAvailable")
    .optional()
    .isBoolean()
    .withMessage("notifyOnAvailable must be a boolean"),

  body("preferences.notifyOnNewChronicle")
    .optional()
    .isBoolean()
    .withMessage("notifyOnNewChronicle must be a boolean"),

  body("preferences.notificationMethods.email")
    .optional()
    .isBoolean()
    .withMessage("Email notification preference must be a boolean"),

  body("preferences.notificationMethods.sms")
    .optional()
    .isBoolean()
    .withMessage("SMS notification preference must be a boolean"),
];

// Production status validation
exports.validateProductionStatus = [
  body("status")
    .notEmpty()
    .withMessage("Status is required")
    .isIn([
      "awaiting",
      "design",
      "forging",
      "enchanting",
      "shipping",
      "delivered",
    ])
    .withMessage("Invalid production status"),

  body("estimatedCompletion")
    .optional()
    .isISO8601()
    .withMessage("Estimated completion must be a valid date"),

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes cannot exceed 500 characters"),
];

// ID parameter validation
exports.validateIdParam = [
  param("id").isMongoId().withMessage("Invalid ID format"),
];

// Query parameter validation
exports.validateChronicleQuery = [
  query("status")
    .optional()
    .isIn(["available", "forging", "cipher", "solved"])
    .withMessage("Invalid status filter"),

  query("difficulty")
    .optional()
    .isIn(["beginner", "intermediate", "advanced", "expert"])
    .withMessage("Invalid difficulty filter"),

  query("featured")
    .optional()
    .isBoolean()
    .withMessage("Featured must be a boolean"),

  query("minPrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Minimum price must be a positive number"),

  query("maxPrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Maximum price must be a positive number"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
];

exports.validateFragmentQuery = [
  query("status")
    .optional()
    .isIn(["available", "claimed", "reserved"])
    .withMessage("Invalid status filter"),

  query("rarity")
    .optional()
    .isIn(["common", "rare", "legendary"])
    .withMessage("Invalid rarity filter"),

  query("featured")
    .optional()
    .isBoolean()
    .withMessage("Featured must be a boolean"),
];
