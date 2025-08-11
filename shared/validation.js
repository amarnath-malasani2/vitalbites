const { body, validationResult } = require('express-validator');

// Generic validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array(),
      correlationId: req.correlationId || 'unknown',
      timestamp: new Date().toISOString()
    });
  }
  next();
};

// Email validation
const validateEmail = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  handleValidationErrors
];

// OTP validation
const validateOTP = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('otp')
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('OTP must be exactly 6 digits'),
  handleValidationErrors
];

// Registration validation
const validateRegistration = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('username')
    .trim()
    .isLength({ min: 2, max: 50 })
    .matches(/^[a-zA-Z\s]{2,50}$/)
    .withMessage('Name must contain only letters and be 2-50 characters long'),
  body('mobile')
    .matches(/^\+91[6-9]\d{9}$/)
    .withMessage('Mobile number must be in format +91XXXXXXXXXX and start with 6-9'),
  handleValidationErrors
];

// Menu item validation
const validateMenuItem = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be 2-100 characters long'),
  body('description')
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Description must be 10-500 characters long'),
  body('price')
    .isFloat({ min: 0.01 })
    .withMessage('Price must be a positive number'),
  body('category')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Category must be 2-50 characters long'),
  body('available')
    .optional()
    .isBoolean()
    .withMessage('Available must be true or false'),
  handleValidationErrors
];

// Order validation
const validateOrder = [
  body('userId')
    .isMongoId()
    .withMessage('Valid user ID is required'),
  body('items')
    .isArray({ min: 1 })
    .withMessage('At least one item is required'),
  body('items.*.itemId')
    .isMongoId()
    .withMessage('Valid item ID is required for each item'),
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1'),
  body('address')
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Address must be 10-500 characters long'),
  body('phone')
    .matches(/^\+91[6-9]\d{9}$/)
    .withMessage('Phone number must be in format +91XXXXXXXXXX'),
  body('total')
    .isFloat({ min: 0.01 })
    .withMessage('Total must be a positive number'),
  handleValidationErrors
];

// User profile validation
const validateUserProfile = [
  body('username')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .matches(/^[a-zA-Z\s]{2,50}$/)
    .withMessage('Name must contain only letters and be 2-50 characters long'),
  body('gender')
    .optional()
    .isIn(['male', 'female', 'other'])
    .withMessage('Gender must be male, female, or other'),
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Date of birth must be a valid date'),
  handleValidationErrors
];

// Address validation
const validateAddress = [
  body('fullName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .matches(/^[a-zA-Z\s]{2,100}$/)
    .withMessage('Full name must contain only letters and be 2-100 characters long'),
  body('mobile')
    .matches(/^\+91[6-9]\d{9}$/)
    .withMessage('Mobile number must be in format +91XXXXXXXXXX'),
  body('street')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Street address must be 5-200 characters long'),
  body('city')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('City must be 2-50 characters long'),
  body('state')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('State must be 2-50 characters long'),
  body('pincode')
    .matches(/^[1-9][0-9]{5}$/)
    .withMessage('Pincode must be 6 digits and not start with 0'),
  body('deliveryInstructions')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Delivery instructions must be less than 200 characters'),
  body('isDefault')
    .optional()
    .isBoolean()
    .withMessage('isDefault must be true or false'),
  handleValidationErrors
];

// Sanitize input
const sanitizeInput = (req, res, next) => {
  // Remove any potentially dangerous HTML/script tags
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .trim();
  };

  // Recursively sanitize request body
  const sanitizeObject = (obj) => {
    if (typeof obj === 'string') {
      return sanitizeString(obj);
    } else if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    } else if (obj !== null && typeof obj === 'object') {
      const sanitized = {};
      for (const key in obj) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
      return sanitized;
    }
    return obj;
  };

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  next();
};

module.exports = {
  handleValidationErrors,
  validateEmail,
  validateOTP,
  validateRegistration,
  validateMenuItem,
  validateOrder,
  validateUserProfile,
  validateAddress,
  sanitizeInput
};