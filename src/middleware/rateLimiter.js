const rateLimit = require("express-rate-limit");

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiter for claims
const claimLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 claim requests per hour
  message: {
    success: false,
    message: "Too many claim attempts, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for waitlist
const waitlistLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 waitlist requests per hour
  message: {
    success: false,
    message: "Too many waitlist requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  apiLimiter,
  claimLimiter,
  waitlistLimiter,
};
