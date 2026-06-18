const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { verifyToken, isManager, isOwnerOrManager } = require('../middleware/auth');
const { validate, employeeValidation } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/errorHandler');

const employeeController = require('../controllers/employeeController');

router.get(
  '/',
  verifyToken,
  isManager,
  asyncHandler(employeeController.getAllEmployees)
);

router.get(
  '/:employeeId',
  verifyToken,
  isOwnerOrManager,
  validate(employeeValidation.getEmployee),
  asyncHandler(employeeController.getEmployee)
);

router.post(
  '/',
  verifyToken,
  isManager,
  validate(employeeValidation.createEmployee),
  asyncHandler(employeeController.createEmployee)
);

router.put(
  '/:employeeId',
  verifyToken,
  isOwnerOrManager,
  validate(employeeValidation.updateEmployee),
  asyncHandler(employeeController.updateEmployee)
);

router.delete(
  '/:employeeId',
  verifyToken,
  isManager,
  validate(employeeValidation.deleteEmployee),
  asyncHandler(employeeController.deleteEmployee)
);

router.put(
  '/:employeeId/schedule',
  verifyToken,
  isManager,
  validate(employeeValidation.updateSchedule),
  asyncHandler(employeeController.updateSchedule)
);

router.put(
  '/:employeeId/profile',
  verifyToken,
  isOwnerOrManager,
  validate(employeeValidation.updateProfile),
  asyncHandler(employeeController.updateProfile)
);

router.get(
  '/:employeeId/stats',
  verifyToken,
  isOwnerOrManager,
  asyncHandler(employeeController.getEmployeeStats)
);

module.exports = router;