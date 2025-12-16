const validator = require("validator");

const validateRegister = (data) => {
  const errors = {};

  // First name validation
  if (!data.firstName || data.firstName.trim().length < 2) {
    errors.firstName = "First name must be at least 2 characters";
  }

  // Last name validation
  if (!data.lastName || data.lastName.trim().length < 2) {
    errors.lastName = "Last name must be at least 2 characters";
  }

  // Email validation
  if (!data.email || !validator.isEmail(data.email)) {
    errors.email = "Please provide a valid email";
  }

  // Password validation
  if (!data.password || data.password.length < 8) {
    errors.password = "Password must be at least 8 characters";
  }

  if (data.password) {
    if (!/[A-Z]/.test(data.password)) {
      errors.password = "Password must contain at least one uppercase letter";
    }
    if (!/[0-9]/.test(data.password)) {
      errors.password = "Password must contain at least one number";
    }
    if (!/[^A-Za-z0-9]/.test(data.password)) {
      errors.password = "Password must contain at least one special character";
    }
  }

  // Confirm password validation
  if (data.password !== data.confirmPassword) {
    errors.confirmPassword = "Passwords do not match";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

const validateLogin = (data) => {
  const errors = {};

  if (!data.email || !validator.isEmail(data.email)) {
    errors.email = "Please provide a valid email";
  }

  if (!data.password) {
    errors.password = "Password is required";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

const validateProduct = (data) => {
  const errors = {};

  if (!data.name || data.name.trim().length < 3) {
    errors.name = "Product name must be at least 3 characters";
  }

  if (!data.price || data.price <= 0) {
    errors.price = "Price must be greater than 0";
  }

  if (!data.description || data.description.trim().length < 10) {
    errors.description = "Description must be at least 10 characters";
  }

  if (!data.category) {
    errors.category = "Category is required";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

const validateAddress = (data) => {
  const errors = {};

  if (!data.firstName || data.firstName.trim().length < 2) {
    errors.firstName = "First name is required";
  }

  if (!data.lastName || data.lastName.trim().length < 2) {
    errors.lastName = "Last name is required";
  }

  if (!data.email || !validator.isEmail(data.email)) {
    errors.email = "Valid email is required";
  }

  if (!data.phone || !/^\+?[\d\s\-\(\)]+$/.test(data.phone)) {
    errors.phone = "Valid phone number is required";
  }

  if (!data.governorate) {
    errors.governorate = "Governorate is required";
  }

  if (!data.city) {
    errors.city = "City is required";
  }

  if (!data.address) {
    errors.address = "Address is required";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

module.exports = {
  validateRegister,
  validateLogin,
  validateProduct,
  validateAddress,
};
