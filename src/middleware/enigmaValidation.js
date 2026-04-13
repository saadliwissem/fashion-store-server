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

  body("tags")
    .optional()
    .isArray()
    .withMessage("Tags must be an array")
    .custom((tags) => {
      if (tags && tags.length > 20) {
        throw new Error("Cannot have more than 20 tags");
      }
      return true;
    }),

  body("tags.*")
    .optional()
    .trim()
    .isLength({ min: 1, max: 30 })
    .withMessage("Each tag must be between 1 and 30 characters"),

  body("creator.name")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Creator name cannot exceed 100 characters"),

  // body("creator.avatar")
  //   .optional()
  //   .isURL()
  //   .withMessage("Creator avatar must be a valid URL")
  //   .custom((value) => {
  //     if (value === "") return true; // Allow empty string
  //     return true;
  //   }),

  // body("creator.bio")
  //   .optional()
  //   .trim()
  //   .isLength({ max: 500 })
  //   .withMessage("Creator bio cannot exceed 500 characters"),

  body("location.country")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Country name cannot exceed 100 characters"),

  body("location.city")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("City name cannot exceed 100 characters"),

  body("location.virtual")
    .optional()
    .isBoolean()
    .withMessage("Virtual must be a boolean"),

  // Cover Image Validation
  body("coverImage.url")
    .optional()
    .custom((value) => {
      if (
        value &&
        !value.startsWith("data:image") &&
        !value.startsWith("http")
      ) {
        throw new Error(
          "Cover image must be a valid image URL or base64 string"
        );
      }
      return true;
    }),

  body("coverImage.alt")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Alt text cannot exceed 200 characters"),

  // Banner Image Validation
  body("bannerImage.url")
    .optional()
    .custom((value) => {
      if (
        value &&
        !value.startsWith("data:image") &&
        !value.startsWith("http")
      ) {
        throw new Error(
          "Banner image must be a valid image URL or base64 string"
        );
      }
      return true;
    }),

  body("bannerImage.alt")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Alt text cannot exceed 200 characters"),

  // Rewards Validation
  body("rewards").optional().isArray().withMessage("Rewards must be an array"),

  body("rewards.*.name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Reward name is required if reward is provided")
    .isLength({ max: 100 })
    .withMessage("Reward name cannot exceed 100 characters"),

  body("rewards.*.description")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Reward description is required if reward is provided")
    .isLength({ max: 500 })
    .withMessage("Reward description cannot exceed 500 characters"),

  body("rewards.*.type")
    .optional()
    .isIn(["badge", "nft", "physical", "experience"])
    .withMessage("Reward type must be badge, nft, physical, or experience"),

  body("rewards.*.rarity")
    .optional()
    .isIn(["common", "rare", "legendary"])
    .withMessage("Reward rarity must be common, rare, or legendary"),

  body("rewards.*.image")
    .optional()
    .custom((value) => {
      if (value && value !== "" && !value.match(/^https?:\/\/.+/)) {
        throw new Error(
          "Reward image must be a valid URL (starting with http:// or https://)"
        );
      }
      return true;
    }),
  // Stats Validation (for updates)
  body("stats.activeKeepers")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Active keepers must be a positive integer"),

  body("stats.totalValueLocked")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Total value locked must be a positive number"),

  body("stats.completionRate")
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage("Completion rate must be between 0 and 100"),

  body("stats.averageTimeToComplete")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Average time to complete must be a positive number"),

  // Metadata Validation
  body("metadata.totalChronicles")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Total chronicles must be a positive integer"),

  body("metadata.totalFragments")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Total fragments must be a positive integer"),

  body("metadata.fragmentsClaimed")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Fragments claimed must be a positive integer"),

  // SEO Validation
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

  body("seo.keywords")
    .optional()
    .isArray()
    .withMessage("SEO keywords must be an array"),

  body("seo.keywords.*")
    .optional()
    .trim()
    .isLength({ min: 1, max: 30 })
    .withMessage("Each keyword must be between 1 and 30 characters"),

  // Date Validation
  body("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid date"),

  body("estimatedEnd")
    .optional()
    .isISO8601()
    .withMessage("Estimated end date must be a valid date")
    .custom((value, { req }) => {
      if (
        req.body.startDate &&
        value &&
        new Date(value) <= new Date(req.body.startDate)
      ) {
        throw new Error("Estimated end date must be after start date");
      }
      return true;
    }),
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

  // body("estimatedDelivery")
  //   .optional()
  //   .isISO8601()
  //   .withMessage("Estimated delivery must be a valid date"),

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
