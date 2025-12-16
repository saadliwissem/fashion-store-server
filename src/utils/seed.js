const mongoose = require("mongoose");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Category = require("../models/Category");
const Product = require("../models/Product");

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB Connected for seeding");
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error);
    process.exit(1);
  }
};

const createAdminUser = async () => {
  try {
    // Check if admin already exists
    const adminExists = await User.findOne({ email: process.env.ADMIN_EMAIL });

    if (adminExists) {
      console.log("✅ Admin user already exists");
      return adminExists;
    }

    // Create admin user

    const admin = await User.create({
      firstName: "Admin",
      lastName: "User",
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      phone: "+216 20 000 000",
      role: "admin",
      emailVerified: true,
      status: "active",
    });

    console.log("✅ Admin user created:", admin.email);
    return admin;
  } catch (error) {
    console.error("❌ Error creating admin user:", error);
  }
};

const createCategories = async () => {
  try {
    // Clear existing categories
    await Category.deleteMany({});

    const categories = [
      {
        name: "Men's Fashion",
        slug: "mens-fashion",
        description: "Premium clothing for men",
        image:
          "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&h=300&fit=crop",
        featured: true,
        productCount: 25,
      },
      {
        name: "Women's Fashion",
        slug: "womens-fashion",
        description: "Elegant clothing for women",
        image:
          "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=400&h=300&fit=crop",
        featured: true,
        productCount: 30,
      },
      {
        name: "Accessories",
        slug: "accessories",
        description: "Fashion accessories",
        image:
          "https://images.unsplash.com/photo-1539185441755-769473a23570?w=400&h=300&fit=crop",
        featured: false,
        productCount: 15,
      },
      {
        name: "Footwear",
        slug: "footwear",
        description: "Shoes and footwear",
        image:
          "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&h=300&fit=crop",
        featured: false,
        productCount: 20,
      },
    ];

    const createdCategories = await Category.insertMany(categories);
    console.log(`✅ ${createdCategories.length} categories created`);

    return createdCategories;
  } catch (error) {
    console.error("❌ Error creating categories:", error);
  }
};

const createProducts = async (categories) => {
  try {
    // Clear existing products
    await Product.deleteMany({});

    const products = [
      {
        name: "Premium Cotton T-Shirt",
        sku: "FS-MEN-001",
        slug: "premium-cotton-t-shirt",
        description:
          "Experience ultimate comfort with our premium cotton t-shirt. Made from 100% organic cotton, this t-shirt offers exceptional softness and breathability.",
        shortDescription: "100% Organic Cotton T-Shirt",
        category: categories[0]._id,
        price: 29.99,
        originalPrice: 39.99,
        costPrice: 15.5,
        stock: 100,
        status: "active",
        featured: true,
        isNewArrival: true,
        onSale: true,
        images: [
          "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&h=1000&fit=crop",
          "https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?w=800&h=1000&fit=crop",
        ],
        tags: ["cotton", "organic", "casual", "t-shirt"],
        specifications: {
          material: "100% Organic Cotton",
          weight: "180 GSM",
          fit: "Regular Fit",
          care: "Machine Washable",
        },
        variants: [
          {
            color: "Navy Blue",
            size: "M",
            price: 29.99,
            stock: 50,
            sku: "FS-MEN-001-NAVY-M",
          },
          {
            color: "Charcoal Gray",
            size: "L",
            price: 29.99,
            stock: 50,
            sku: "FS-MEN-001-GRAY-L",
          },
        ],
      },
      {
        name: "Designer Denim Jacket",
        sku: "FS-WOM-001",
        slug: "designer-denim-jacket",
        description:
          "A stylish denim jacket perfect for any occasion. Made from high-quality denim with premium stitching.",
        shortDescription: "High-quality denim jacket",
        category: categories[1]._id,
        price: 89.99,
        originalPrice: 119.99,
        costPrice: 45.0,
        stock: 50,
        status: "active",
        featured: true,
        isNewArrival: false,
        onSale: true,
        images: [
          "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&h=1000&fit=crop",
        ],
        tags: ["denim", "jacket", "casual"],
        specifications: {
          material: "100% Cotton Denim",
          weight: "500 GSM",
          fit: "Regular Fit",
          care: "Dry Clean Only",
        },
      },
      {
        name: "Leather Belt",
        sku: "FS-ACC-001",
        slug: "leather-belt",
        description: "Genuine leather belt with stainless steel buckle.",
        shortDescription: "Genuine leather belt",
        category: categories[2]._id,
        price: 34.99,
        originalPrice: 44.99,
        costPrice: 18.0,
        stock: 75,
        status: "active",
        featured: false,
        isNewArrival: true,
        onSale: true,
        images: [
          "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&h=1000&fit=crop",
        ],
        tags: ["leather", "belt", "accessory"],
        specifications: {
          material: "Genuine Leather",
          weight: "150 GSM",
          fit: "Adjustable",
          care: "Wipe Clean",
        },
      },
      {
        name: "Running Sneakers",
        sku: "FS-SHO-001",
        slug: "running-sneakers",
        description: "Comfortable running sneakers with cushioning technology.",
        shortDescription: "Performance running shoes",
        category: categories[3]._id,
        price: 59.99,
        originalPrice: 79.99,
        costPrice: 30.0,
        stock: 60,
        status: "active",
        featured: true,
        isNewArrival: false,
        onSale: true,
        images: [
          "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800&h=1000&fit=crop",
        ],
        tags: ["shoes", "sneakers", "running"],
        specifications: {
          material: "Mesh & Synthetic",
          weight: "300 GSM",
          fit: "True to Size",
          care: "Wipe Clean",
        },
        variants: [
          {
            color: "Black",
            size: "42",
            price: 59.99,
            stock: 30,
            sku: "FS-SHO-001-BLK-42",
          },
          {
            color: "White",
            size: "41",
            price: 59.99,
            stock: 30,
            sku: "FS-SHO-001-WHT-41",
          },
        ],
      },
    ];

    const createdProducts = await Product.insertMany(products);
    console.log(`✅ ${createdProducts.length} products created`);

    return createdProducts;
  } catch (error) {
    console.error("❌ Error creating products:", error);
  }
};

const seedDatabase = async () => {
  try {
    await connectDB();

    console.log("🌱 Starting database seeding...");

    // Create admin user
    await createAdminUser();

    // Create categories
    const categories = await createCategories();

    // Create products
    if (categories) {
      await createProducts(categories);
    }

    console.log("✅ Database seeding completed!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  }
};

// Run seed if called directly
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
