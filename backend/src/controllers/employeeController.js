const { db } = require('../config/firebase');
const admin = require('firebase-admin');
const emailService = require('../services/emailService');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const sanitizeEmployeeData = (data) => {
  const sanitized = { ...data };
  delete sanitized.hashedPassword;
  delete sanitized.accessCode;
  delete sanitized.codeExpiresAt;
  return sanitized;
};

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

exports.getEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;

    if (!employeeId) {
      return res.status(400).json({ success: false, error: 'Employee ID is required' });
    }

    const employeeRef = db.collection('employees').doc(employeeId);
    const doc = await employeeRef.get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }

    const data = doc.data();
    const employee = sanitizeEmployeeData(data);

    res.json({
      success: true,
      employee: {
        id: doc.id,
        ...employee
      }
    });
  } catch (error) {
    console.error('Get employee error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.getAllEmployees = async (req, res) => {
  try {
    const { activeOnly = 'true' } = req.query;

    let query = db.collection('employees');

    if (activeOnly === 'true') {
      query = query.where('isActive', '==', true);
    }

    const snapshot = await query.get();

    const employees = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      employees.push({
        id: doc.id,
        ...sanitizeEmployeeData(data)
      });
    });

    res.json({
      success: true,
      count: employees.length,
      employees
    });
  } catch (error) {
    console.error('Get all employees error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.createEmployee = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      role,
      department,
      position,
      hireDate,
      salary,
      schedule
    } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name, email, and role are required' 
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email format' });
    }

    const existing = await db.collection('employees')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (!existing.empty) {
      return res.status(409).json({ success: false, error: 'Employee with this email already exists' });
    }

    const tempPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-2);
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    const employeeId = uuidv4();

    const employeeData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone?.trim() || '',
      role,
      department: department?.trim() || 'General',
      position: position?.trim() || role,
      hireDate: hireDate || admin.firestore.Timestamp.now(),
      salary: Number(salary) || 0,
      schedule: schedule || { days: [], shift: '' },
      hashedPassword,
      passwordSet: false,
      isActive: true,
      tasks: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLoginAt: null,
      profile: {
        address: '',
        emergencyContact: '',
        notes: ''
      }
    };

    await db.collection('employees').doc(employeeId).set(employeeData);

    const setupLink = `${process.env.FRONTEND_URL}/setup-password?employeeId=${employeeId}`;
    
    try {
      await emailService.sendVerificationLink(email, setupLink);
      await emailService.sendCredentials(email, email, tempPassword);
    } catch (emailErr) {
      console.error('Email sending failed (non-blocking):', emailErr.message);
    }

    const responseData = sanitizeEmployeeData(employeeData);

    res.status(201).json({
      success: true,
      message: 'Employee created successfully. Credentials sent to email.',
      employeeId,
      employee: {
        id: employeeId,
        ...responseData
      }
    });
  } catch (error) {
    console.error('Create employee error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.updateEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const updateData = { ...req.body };

    if (!employeeId) {
      return res.status(400).json({ success: false, error: 'Employee ID is required' });
    }

    const employeeRef = db.collection('employees').doc(employeeId);
    const doc = await employeeRef.get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }

    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.hashedPassword;
    delete updateData.passwordSet;
    delete updateData.accessCode;
    delete updateData.codeExpiresAt;

    const updatePayload = {
      ...updateData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await employeeRef.update(updatePayload);

    const updatedDoc = await employeeRef.get();
    const updatedData = sanitizeEmployeeData(updatedDoc.data());

    res.json({
      success: true,
      message: 'Employee updated successfully',
      employee: {
        id: updatedDoc.id,
        ...updatedData
      }
    });
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.deleteEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;

    if (!employeeId) {
      return res.status(400).json({ success: false, error: 'Employee ID is required' });
    }

    const employeeRef = db.collection('employees').doc(employeeId);
    const doc = await employeeRef.get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }

    await employeeRef.update({
      isActive: false,
      deletedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      message: 'Employee has been deactivated (soft delete)'
    });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.updateSchedule = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { schedule } = req.body;

    if (!employeeId || !schedule) {
      return res.status(400).json({ success: false, error: 'Employee ID and schedule are required' });
    }

    const employeeRef = db.collection('employees').doc(employeeId);
    const doc = await employeeRef.get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }

    await employeeRef.update({
      schedule,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      message: 'Schedule updated successfully',
      schedule
    });
  } catch (error) {
    console.error('Update schedule error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { profile } = req.body;

    if (!employeeId || !profile) {
      return res.status(400).json({ success: false, error: 'Employee ID and profile data are required' });
    }

    if (req.user?.role !== 'manager' && req.user?.employeeId !== employeeId) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const employeeRef = db.collection('employees').doc(employeeId);
    const doc = await employeeRef.get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }

    await employeeRef.update({
      profile: admin.firestore.FieldValue.arrayUnion ? 
        { ...doc.data().profile, ...profile } : 
        { ...profile },
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.getEmployeeStats = async (req, res) => {
  try {
    const { employeeId } = req.params;

    if (!employeeId) {
      return res.status(400).json({ success: false, error: 'Employee ID is required' });
    }

    const tasksSnapshot = await db.collection('tasks')
      .where('assignedTo', '==', employeeId)
      .get();

    let totalTasks = 0;
    let completed = 0;
    let pending = 0;
    let inProgress = 0;

    tasksSnapshot.forEach(doc => {
      totalTasks++;
      const status = doc.data().status;
      if (status === 'completed') completed++;
      else if (status === 'pending') pending++;
      else if (status === 'in-progress') inProgress++;
    });

    res.json({
      success: true,
      stats: {
        totalTasks,
        completedTasks: completed,
        pendingTasks: pending,
        inProgressTasks: inProgress,
        completionRate: totalTasks > 0 ? ((completed / totalTasks) * 100).toFixed(2) : 0
      }
    });
  } catch (error) {
    console.error('Get employee stats error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};