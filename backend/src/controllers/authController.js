const { db } = require('../config/firebase');
const admin = require('firebase-admin');
const smsService = require('../services/smsService');
const emailService = require('../services/emailService');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required');
}

const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validatePhone = (phone) => /^[0-9]{10,15}$/.test(phone);

const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
};

const saveAccessCode = async (collection, docId, code, expiresInMinutes = 10) => {
  const expiresAt = admin.firestore.Timestamp.fromDate(
    new Date(Date.now() + expiresInMinutes * 60000)
  );

  await db.collection(collection).doc(docId).set({
    accessCode: code,
    codeExpiresAt: expiresAt,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  return expiresAt;
};

exports.createAccessCode = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber || !validatePhone(phoneNumber)) {
      return res.status(400).json({ success: false, error: 'Invalid phone number' });
    }

    const accessCode = generateCode();
    await saveAccessCode('users', phoneNumber, accessCode);

    let smsSent = false;
    try {
      await smsService.sendAccessCode(phoneNumber, accessCode);
      smsSent = true;
    } catch (err) {
      console.error('SMS failed:', err.message);
    }

    res.json({
      success: true,
      message: 'Access code sent successfully',
      smsSent,
      ...(process.env.NODE_ENV === 'development' && { code: accessCode })
    });
  } catch (error) {
    console.error('Create access code error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.validateAccessCode = async (req, res) => {
  try {
    const { phoneNumber, accessCode } = req.body;

    if (!phoneNumber || !accessCode) {
      return res.status(400).json({ success: false, error: 'Missing fields' });
    }

    const userRef = db.collection('users').doc(phoneNumber);
    const doc = await userRef.get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const data = doc.data();

    if (!data.accessCode || data.accessCode !== accessCode) {
      return res.status(401).json({ success: false, error: 'Invalid access code' });
    }

    if (data.codeExpiresAt && data.codeExpiresAt.toDate() < new Date()) {
      return res.status(401).json({ success: false, error: 'Access code has expired' });
    }

    await userRef.update({
      accessCode: admin.firestore.FieldValue.delete(),
      codeExpiresAt: admin.firestore.FieldValue.delete(),
      validatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const token = generateToken({ 
      phoneNumber, 
      role: 'manager', 
      userId: phoneNumber 
    });

    res.json({
      success: true,
      token,
      role: 'manager',
      user: { phoneNumber, role: 'manager' }
    });
  } catch (error) {
    console.error('Validate access code error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.loginWithEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !validateEmail(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email' });
    }

    const snapshot = await db.collection('employees')
      .where('email', '==', email)
      .limit(1)
      .get();

    let employeeId, employeeData;

    if (snapshot.empty) {
      if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ success: false, error: 'Employee not found' });
      }
      
      const newEmployee = {
        name: email.split('@')[0] || 'New Employee',
        email,
        role: 'employee',
        department: 'General',
        isActive: true,
        passwordSet: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const ref = await db.collection('employees').add(newEmployee);
      employeeId = ref.id;
      employeeData = newEmployee;
    } else {
      employeeData = snapshot.docs[0].data();
      employeeId = snapshot.docs[0].id;
    }

    if (employeeData.isActive === false) {
      return res.status(403).json({ success: false, error: 'Account is inactive' });
    }

    const accessCode = generateCode();
    await saveAccessCode('employees', employeeId, accessCode);

    let emailSent = false;
    try {
      await emailService.sendAccessCode(email, accessCode);
      emailSent = true;
    } catch (err) {
      console.error('Email sending failed:', err.message);
    }

    res.json({
      success: true,
      message: 'Access code sent to your email',
      emailSent,
      employeeId,
      ...(process.env.NODE_ENV === 'development' && { code: accessCode })
    });
  } catch (error) {
    console.error('Login with email error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.validateEmailAccessCode = async (req, res) => {
  try {
    const { email, accessCode } = req.body;

    if (!email || !accessCode) {
      return res.status(400).json({ success: false, error: 'Email and access code are required' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email format' });
    }

    const snapshot = await db.collection('employees')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }

    const employeeDoc = snapshot.docs[0];
    const data = employeeDoc.data();
    const employeeId = employeeDoc.id;

    if (!data.accessCode || data.accessCode !== accessCode) {
      return res.status(401).json({ success: false, error: 'Invalid access code' });
    }

    if (data.codeExpiresAt && data.codeExpiresAt.toDate() < new Date()) {
      return res.status(401).json({ success: false, error: 'Access code has expired' });
    }

    if (data.passwordSet) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password already set. Please login with password.' 
      });
    }

    await employeeDoc.ref.update({
      accessCode: admin.firestore.FieldValue.delete(),
      codeExpiresAt: admin.firestore.FieldValue.delete(),
      validatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const token = generateToken({
      email,
      employeeId,
      role: 'employee',
      name: data.name
    });

    res.json({
      success: true,
      message: 'Access code validated successfully',
      token,
      role: 'employee',
      employee: {
        id: employeeId,
        name: data.name,
        email: data.email,
        role: data.role,
        department: data.department,
        phone: data.phone
      }
    });
  } catch (error) {
    console.error('Validate email access code error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.setupPassword = async (req, res) => {
  try {
    const { employeeId, password } = req.body;

    if (!employeeId || !password) {
      return res.status(400).json({ success: false, error: 'Employee ID and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    }

    const employeeRef = db.collection('employees').doc(employeeId);
    const doc = await employeeRef.get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }

    const data = doc.data();

    if (data.passwordSet) {
      return res.status(400).json({ success: false, error: 'Password already set' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await employeeRef.update({
      hashedPassword,
      passwordSet: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      message: 'Password set successfully'
    });
  } catch (error) {
    console.error('Setup password error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.employeeLoginWithPassword = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email format' });
    }

    const snapshot = await db.collection('employees')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const employeeDoc = snapshot.docs[0];
    const data = employeeDoc.data();

    if (data.isActive === false) {
      return res.status(403).json({ success: false, error: 'Account is inactive' });
    }

    if (!data.passwordSet || !data.hashedPassword) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password not set. Please use access code login.' 
      });
    }

    const isPasswordValid = await bcrypt.compare(password, data.hashedPassword);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    await employeeDoc.ref.update({
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const token = generateToken({
      email,
      employeeId: employeeDoc.id,
      role: 'employee',
      name: data.name
    });

    res.json({
      success: true,
      token,
      role: 'employee',
      employee: {
        id: employeeDoc.id,
        name: data.name,
        email: data.email,
        role: data.role,
        department: data.department,
        phone: data.phone
      }
    });
  } catch (error) {
    console.error('Employee password login error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, error: 'Token is required' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }

    const newToken = generateToken({
      email: decoded.email,
      phoneNumber: decoded.phoneNumber,
      employeeId: decoded.employeeId,
      role: decoded.role,
      name: decoded.name
    });

    res.json({ success: true, token: newToken });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.logout = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      console.log('User logged out:', token ? 'Token present' : 'No token');
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.verifyToken = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }

    res.json({
      success: true,
      valid: true,
      user: decoded
    });
  } catch (error) {
    console.error('Verify token error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};