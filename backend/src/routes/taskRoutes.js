const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { verifyToken, isManager } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/errorHandler');
const taskController = require('../controllers/taskController');

router.get(
  '/',
  verifyToken,
  isManager,
  validate([
    query('status').optional().isIn(['pending', 'in-progress', 'completed', 'cancelled']),
    query('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
    query('assignedTo').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ]),
  asyncHandler(taskController.getAllTasks)
);

router.get(
  '/:taskId',
  verifyToken,
  validate([
    param('taskId').notEmpty().withMessage('Task ID is required')
  ]),
  asyncHandler(taskController.getTask)
);

router.post(
  '/',
  verifyToken,
  isManager,
  validate([
    body('title').notEmpty().withMessage('Task title is required'),
    body('assignedTo').notEmpty().withMessage('Employee assignment is required'),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
    body('status').optional().isIn(['pending', 'in-progress', 'completed', 'cancelled'])
  ]),
  asyncHandler(taskController.createTask)
);

router.put(
  '/:taskId',
  verifyToken,
  isManager,
  validate([
    param('taskId').notEmpty().withMessage('Task ID is required'),
    body('title').optional().isLength({ min: 3 }),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
    body('status').optional().isIn(['pending', 'in-progress', 'completed', 'cancelled'])
  ]),
  asyncHandler(taskController.updateTask)
);

router.delete(
  '/:taskId',
  verifyToken,
  isManager,
  validate([
    param('taskId').notEmpty().withMessage('Task ID is required')
  ]),
  asyncHandler(taskController.deleteTask)
);

router.patch(
  '/:taskId/status',
  verifyToken,
  validate([
    param('taskId').notEmpty().withMessage('Task ID is required'),
    body('status').notEmpty().withMessage('Status is required')
      .isIn(['pending', 'in-progress', 'completed', 'cancelled'])
  ]),
  asyncHandler(taskController.updateTaskStatus)
);

router.post(
  '/:taskId/assign',
  verifyToken,
  isManager,
  validate([
    param('taskId').notEmpty().withMessage('Task ID is required'),
    body('employeeId').notEmpty().withMessage('Employee ID is required')
  ]),
  asyncHandler(taskController.assignTask)
);

router.post(
  '/:taskId/comments',
  verifyToken,
  validate([
    param('taskId').notEmpty().withMessage('Task ID is required'),
    body('text').notEmpty().withMessage('Comment text is required')
      .isLength({ min: 1, max: 500 })
  ]),
  asyncHandler(taskController.addComment)
);

router.get(
  '/employee/:employeeId',
  verifyToken,
  validate([
    param('employeeId').notEmpty().withMessage('Employee ID is required'),
    query('status').optional().isIn(['pending', 'in-progress', 'completed', 'cancelled'])
  ]),
  asyncHandler(taskController.getEmployeeTasks)
);

router.get(
  '/overdue',
  verifyToken,
  isManager,
  asyncHandler(taskController.getOverdueTasks)
);

module.exports = router;