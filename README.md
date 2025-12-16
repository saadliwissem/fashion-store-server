# FashionStore Backend API

A complete backend for the FashionStore E-commerce platform built with Node.js, Express, and MongoDB.

## Features

- **User Authentication**: JWT-based authentication with roles (customer, admin, editor, manager)
- **Product Management**: CRUD operations with variants, categories, and inventory
- **Shopping Cart**: Full cart functionality with quantity management
- **Order Processing**: Complete order lifecycle with payment integration
- **Wishlist**: Save products for later
- **Reviews & Ratings**: Product reviews with ratings
- **Admin Dashboard**: Comprehensive admin interface for management
- **Search & Filtering**: Advanced product search and filtering
- **Pagination**: Efficient data pagination for large datasets
- **File Upload**: Image upload with Cloudinary integration
- **Email Notifications**: Order confirmations, password reset, etc.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **File Upload**: Multer + Cloudinary
- **Email**: Nodemailer
- **Validation**: Validator.js
- **Security**: Helmet, CORS, bcryptjs

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or Atlas)
- npm or yarn

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd fashionstore-backend
   ```
