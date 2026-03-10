const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const http = require("http");
const socketio = require("socket.io");

// Load environment variables
dotenv.config();

// Import database connection
const connectDB = require("./src/config/db");

// Import existing e-commerce routes
const authRoutes = require("./src/routes/authRoutes");
const productRoutes = require("./src/routes/productRoutes");
const categoryRoutes = require("./src/routes/categoryRoutes");
const cartRoutes = require("./src/routes/cartRoutes");
const orderRoutes = require("./src/routes/orderRoutes");
const wishlistRoutes = require("./src/routes/wishlistRoutes");
const reviewRoutes = require("./src/routes/reviewRoutes");
const adminRoutes = require("./src/routes/adminRoutes");
const adminCategoryRoutes = require("./src/routes/adminCategoryRoutes");
const adminProductRoutes = require("./src/routes/adminProductRoutes");
const adminInventoryRoutes = require("./src/routes/adminInventoryRoutes");
const adminOrderRoutes = require("./src/routes/adminOrderRoutes");

// Import new enigma platform routes (public)
const enigmaRoutes = require("./src/routes/enigmaRoutes");
const chronicleRoutes = require("./src/routes/chronicleRoutes");
const fragmentRoutes = require("./src/routes/fragmentRoutes");
const claimRoutes = require("./src/routes/claimRoutes");
const waitlistRoutes = require("./src/routes/waitlistRoutes");
const analyticsRoutes = require("./src/routes/analyticsRoutes");
const keeperRoutes = require("./src/routes/keeperRoutes");

// Import admin enigma platform routes
const adminEnigmaRoutes = require("./src/routes/adminEnigmaRoutes");
const adminChronicleRoutes = require("./src/routes/adminChronicleRoutes");
const adminFragmentRoutes = require("./src/routes/adminFragmentRoutes");
const adminClaimRoutes = require("./src/routes/adminClaimRoutes");
const adminWaitlistRoutes = require("./src/routes/adminWaitlistRoutes");
const adminDashboardRoutes = require("./src/routes/adminDashboardRoutes");

// Import middleware
const { errorHandler, notFound } = require("./src/middleware/errorMiddleware");
const { apiLimiter } = require("./src/middleware/rateLimiter");

// Initialize express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = socketio(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Connect to MongoDB
connectDB();

// Middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
); // Security headers
app.use(cors("*"));
// Increase payload size limit
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
//app.use(morgan("dev")); // HTTP request logger

// Static folder (for uploaded images)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Apply rate limiting to all API routes
//app.use("/api/", apiLimiter);

// ==================== PUBLIC API ROUTES ====================

// E-commerce Public Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/reviews", reviewRoutes);

// Enigma Platform Public Routes
app.use("/api/enigmas", enigmaRoutes);
app.use("/api/chronicles", chronicleRoutes);
app.use("/api/fragments", fragmentRoutes);
app.use("/api/claims", claimRoutes);
app.use("/api/waitlist", waitlistRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/keepers", keeperRoutes);

// ==================== ADMIN API ROUTES ====================

// E-commerce Admin Routes
app.use("/api/admin", adminRoutes);
app.use("/api/admin/categories", adminCategoryRoutes);
app.use("/api/admin/products", adminProductRoutes);
app.use("/api/admin/inventory", adminInventoryRoutes);
app.use("/api/admin/orders", adminOrderRoutes);

// Enigma Platform Admin Routes
app.use("/api/admin/enigmas", adminEnigmaRoutes);
app.use("/api/admin/chronicles", adminChronicleRoutes);
app.use("/api/admin/fragments", adminFragmentRoutes);
app.use("/api/admin/claims", adminClaimRoutes);
app.use("/api/admin/waitlist", adminWaitlistRoutes);
app.use("/api/admin/dashboard", adminDashboardRoutes);

// Health check route
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// WebSocket connection handling
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("subscribe-to-chronicle", (chronicleId) => {
    socket.join(`chronicle-${chronicleId}`);
    console.log(`Client ${socket.id} subscribed to chronicle ${chronicleId}`);
  });

  socket.on("unsubscribe-from-chronicle", (chronicleId) => {
    socket.leave(`chronicle-${chronicleId}`);
    console.log(
      `Client ${socket.id} unsubscribed from chronicle ${chronicleId}`
    );
  });

  socket.on("fragment-claimed", (data) => {
    // Broadcast to all clients watching this chronicle
    io.to(`chronicle-${data.chronicleId}`).emit("fragment-update", data);
  });

  socket.on("waitlist-update", (data) => {
    io.to(`chronicle-${data.chronicleId}`).emit("waitlist-changed", data);
  });

  socket.on("production-update", (data) => {
    io.to(`chronicle-${data.chronicleId}`).emit(
      "production-status-changed",
      data
    );
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// Make io accessible to controllers
app.set("io", io);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(
    `🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`
  );
  console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL}`);
  console.log(`📦 E-commerce API loaded`);
  console.log(`🔍 Enigma Platform API loaded`);
  console.log(`📊 Enigma Platform Admin API loaded`);
  console.log(`🔌 WebSocket server initialized`);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err, promise) => {
  console.log(`❌ Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});

module.exports = { app, server, io };
