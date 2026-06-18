const { body, param, query, validationResult } = require('express-validator');

const isValidPhoneNumber = (value) => {
  const cleaned = value.replace(/[\s\-\(\)]/g, '');
  const phoneRegex = /^\+?[0-9]{10,15}$/;
  return phoneRegex.test(cleaned);
};

const isValidAccessCode = (value) => {
  return /^[0-9]{6}$/.test(value);
};

exports.authValidation = {
  createAccessCode: [
    body('phoneNumber')
      .notEmpty().withMessage('Phone number is required')
      .custom((value) => {
        const cleaned = value.replace(/[\s\-\(\)]/g, '');
        if (!isValidPhoneNumber(cleaned)) {
          throw new Error('Invalid phone number format. Please enter 10-15 digits.');
        }
        return true;
      })
      .customSanitizer((value) => {
        return value.replace(/[\s\-\(\)]/g, '');
      })
  ],
  
  validateAccessCode: [
    body('phoneNumber')
      .notEmpty().withMessage('Phone number is required')
      .customSanitizer((value) => value.replace(/[\s\-\(\)]/g, '')),
    body('accessCode')
      .notEmpty().withMessage('Access code is required')
      .isLength({ min: 6, max: 6 }).withMessage('Access code must be exactly 6 digits')
      .isNumeric().withMessage('Access code must contain only numbers')
      .custom((value) => {
        if (!isValidAccessCode(value)) {
          throw new Error('Access code must be 6 digits');
        }
        return true;
      })
  ],
  
  loginWithEmail: [
    body('email')
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail()
  ],
  
  setupPassword: [
    body('employeeId')
      .notEmpty().withMessage('Employee ID is required')
      .isString().withMessage('Invalid employee ID'),
    body('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
      .isLength({ max: 100 }).withMessage('Password is too long')
  ]
};

exports.employeeValidation = {
  createEmployee: [
    body('name')
      .notEmpty().withMessage('Name is required')
      .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters')
      .trim()
      .escape(),
    
    body('email')
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail()
      .trim(),
    
    body('role')
      .notEmpty().withMessage('Role is required')
      .isIn(['admin', 'manager', 'developer', 'designer', 'tester', 'employee', 'other'])
      .withMessage('Invalid role'),
    
    body('phone')
      .optional()
      .custom((value) => {
        if (value && !isValidPhoneNumber(value)) {
          throw new Error('Invalid phone number format');
        }
        return true;
      })
      .customSanitizer((value) => value ? value.replace(/[\s\-\(\)]/g, '') : ''),
    
    body('department')
      .optional()
      .isString().withMessage('Department must be a string')
      .trim()
      .escape(),
    
    body('schedule')
      .optional()
      .isObject().withMessage('Schedule must be an object')
  ],
  
  updateEmployee: [
    param('employeeId')
      .notEmpty().withMessage('Employee ID is required')
      .isString().withMessage('Invalid employee ID'),
    
    body('name')
      .optional()
      .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters')
      .trim()
      .escape(),
    
    body('email')
      .optional()
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail()
      .trim(),
    
    body('phone')
      .optional()
      .custom((value) => {
        if (value && !isValidPhoneNumber(value)) {
          throw new Error('Invalid phone number format');
        }
        return true;
      })
      .customSanitizer((value) => value ? value.replace(/[\s\-\(\)]/g, '') : ''),
    
    body('role')
      .optional()
      .isIn(['admin', 'manager', 'developer', 'designer', 'tester', 'employee', 'other'])
      .withMessage('Invalid role'),
    
    body('department')
      .optional()
      .isString().withMessage('Department must be a string')
      .trim()
      .escape(),
    
    body('isActive')
      .optional()
      .isBoolean().withMessage('isActive must be a boolean')
  ],
  
  deleteEmployee: [
    param('employeeId')
      .notEmpty().withMessage('Employee ID is required')
      .isString().withMessage('Invalid employee ID')
  ],
  
  getEmployee: [
    param('employeeId')
      .notEmpty().withMessage('Employee ID is required')
      .isString().withMessage('Employee ID must be a string')
  ],
  
  updateSchedule: [
    param('employeeId')
      .notEmpty().withMessage('Employee ID is required'),
    body('schedule')
      .notEmpty().withMessage('Schedule is required')
      .isObject().withMessage('Schedule must be an object')
  ],
  
  updateProfile: [
    param('employeeId')
      .notEmpty().withMessage('Employee ID is required'),
    body('profile')
      .notEmpty().withMessage('Profile data is required')
      .isObject().withMessage('Profile must be an object')
  ]
};

exports.taskValidation = {
  createTask: [
    body('title')
      .notEmpty().withMessage('Task title is required')
      .isLength({ min: 3, max: 200 }).withMessage('Title must be between 3 and 200 characters')
      .trim()
      .escape(),
    
    body('description')
      .optional()
      .isLength({ max: 1000 }).withMessage('Description is too long')
      .trim()
      .escape(),
    
    body('assignedTo')
      .notEmpty().withMessage('Employee assignment is required')
      .isString().withMessage('Invalid employee ID'),
    
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority')
      .default('medium'),
    
    body('status')
      .optional()
      .isIn(['pending', 'in-progress', 'completed', 'cancelled']).withMessage('Invalid status')
      .default('pending'),
    
    body('dueDate')
      .optional()
      .isISO8601().withMessage('Invalid date format')
      .custom((value) => {
        if (value) {
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            throw new Error('Invalid date');
          }
        }
        return true;
      }),
    
    body('estimatedHours')
      .optional()
      .isFloat({ min: 0, max: 100 }).withMessage('Estimated hours must be between 0 and 100')
      .toFloat(),
    
    body('category')
      .optional()
      .isString().withMessage('Category must be a string')
      .trim()
      .escape()
  ],
  
  updateTask: [
    param('taskId')
      .notEmpty().withMessage('Task ID is required')
      .isString().withMessage('Invalid task ID'),
    
    body('title')
      .optional()
      .isLength({ min: 3, max: 200 }).withMessage('Title must be between 3 and 200 characters')
      .trim()
      .escape(),
    
    body('description')
      .optional()
      .isLength({ max: 1000 }).withMessage('Description is too long')
      .trim()
      .escape(),
    
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
    
    body('status')
      .optional()
      .isIn(['pending', 'in-progress', 'completed', 'cancelled']).withMessage('Invalid status'),
    
    body('dueDate')
      .optional()
      .isISO8601().withMessage('Invalid date format')
      .custom((value) => {
        if (value) {
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            throw new Error('Invalid date');
          }
        }
        return true;
      }),
    
    body('estimatedHours')
      .optional()
      .isFloat({ min: 0, max: 100 }).withMessage('Estimated hours must be between 0 and 100')
      .toFloat(),
    
    body('actualHours')
      .optional()
      .isFloat({ min: 0, max: 100 }).withMessage('Actual hours must be between 0 and 100')
      .toFloat(),
    
    body('progress')
      .optional()
      .isInt({ min: 0, max: 100 }).withMessage('Progress must be between 0 and 100')
      .toInt()
  ],
  
  updateTaskStatus: [
    param('taskId')
      .notEmpty().withMessage('Task ID is required')
      .isString().withMessage('Invalid task ID'),
    
    body('status')
      .notEmpty().withMessage('Status is required')
      .isIn(['pending', 'in-progress', 'completed', 'cancelled']).withMessage('Invalid status')
  ],
  
  addComment: [
    param('taskId')
      .notEmpty().withMessage('Task ID is required')
      .isString().withMessage('Invalid task ID'),
    
    body('text')
      .notEmpty().withMessage('Comment text is required')
      .isLength({ min: 1, max: 500 }).withMessage('Comment must be between 1 and 500 characters')
      .trim()
      .escape()
  ],
  
  getTask: [
    param('taskId')
      .notEmpty().withMessage('Task ID is required')
      .isString().withMessage('Task ID must be a string')
  ],
  
  getEmployeeTasks: [
    param('employeeId')
      .notEmpty().withMessage('Employee ID is required')
      .isString().withMessage('Invalid employee ID'),
    
    query('status')
      .optional()
      .isIn(['pending', 'in-progress', 'completed', 'cancelled']).withMessage('Invalid status')
  ],
  
  assignTask: [
    param('taskId')
      .notEmpty().withMessage('Task ID is required'),
    
    body('employeeId')
      .notEmpty().withMessage('Employee ID is required')
      .isString().withMessage('Invalid employee ID')
  ],
  
  updateTaskProgress: [
    param('taskId')
      .notEmpty().withMessage('Task ID is required'),
    
    body('progress')
      .isInt({ min: 0, max: 100 }).withMessage('Progress must be between 0 and 100')
      .toInt()
  ]
};

exports.validate = (validations) => {
  return async (req, res, next) => {
    try {
      await Promise.all(validations.map(validation => validation.run(req)));

      const errors = validationResult(req);
      if (errors.isEmpty()) {
        return next();
      }

      const formattedErrors = errors.array().map(error => ({
        field: error.param,
        message: error.msg,
        value: error.value
      }));

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors: formattedErrors
      });
    } catch (error) {
      console.error('Validation error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error during validation'
      });
    }
  };
};

exports.sanitize = {
  phone: (value) => {
    if (!value) return '';
    return value.replace(/[\s\-\(\)]/g, '');
  },
  
  email: (value) => {
    if (!value) return '';
    return value.trim().toLowerCase();
  },
  
  text: (value) => {
    if (!value) return '';
    return value.trim();
  },
  
  number: (value) => {
    if (!value) return null;
    return parseFloat(value);
  }
};

module.exports = {
  authValidation: exports.authValidation,
  employeeValidation: exports.employeeValidation,
  taskValidation: exports.taskValidation,
  validate: exports.validate,
  sanitize: exports.sanitize
};