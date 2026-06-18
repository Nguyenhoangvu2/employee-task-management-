const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

router.post('/manager/create-code', authController.createAccessCode);
router.post('/manager/validate-code', authController.validateAccessCode);

router.post('/employee/login-email', authController.loginWithEmail);
router.post('/employee/validate-code', authController.validateEmailAccessCode);

router.post('/employee/setup-password', authController.setupPassword);
router.post('/employee/login-password', authController.employeeLoginWithPassword);

router.post('/refresh-token', authController.refreshToken);

router.get('/verify', authenticateToken, authController.verifyToken);

router.post('/logout', authenticateToken, authController.logout);

module.exports = router;