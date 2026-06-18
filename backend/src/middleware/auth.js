const jwt = require('jsonwebtoken');

const logRequest = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
  });
  next();
};

const sanitizeInput = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].trim();
      }
    });
  }
  
  if (req.query && typeof req.query === 'object') {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = req.query[key].trim();
      }
    });
  }
  
  if (req.params && typeof req.params === 'object') {
    Object.keys(req.params).forEach(key => {
      if (typeof req.params[key] === 'string') {
        req.params[key] = req.params[key].trim();
      }
    });
  }
  
  next();
};

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      error: 'Access token required' 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        error: 'Token expired' 
      });
    }
    return res.status(403).json({ 
      success: false, 
      error: 'Invalid token' 
    });
  }
};

const verifyToken = authenticateToken;

const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    } catch (error) {
    }
  }
  next();
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized' 
      });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        error: `Access denied. Required roles: ${roles.join(', ')}` 
      });
    }
    next();
  };
};

const isManager = (req, res, next) => {
  if (!req.user || req.user.role !== 'manager') {
    return res.status(403).json({ 
      success: false, 
      error: 'Manager access required' 
    });
  }
  next();
};

const isEmployee = (req, res, next) => {
  if (!req.user || req.user.role !== 'employee') {
    return res.status(403).json({ 
      success: false, 
      error: 'Employee access required' 
    });
  }
  next();
};

const isEmployeeOrManager = (req, res, next) => {
  if (!req.user || !['employee', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ 
      success: false, 
      error: 'Employee or manager access required' 
    });
  }
  next();
};

const isOwnerOrManager = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      error: 'Unauthorized' 
    });
  }
  
  if (req.user.role === 'manager') {
    return next();
  }
  
  const resourceId = req.params.employeeId || req.params.id || req.params.taskId;
  
  if (req.user.employeeId === resourceId || 
      req.user.userId === resourceId || 
      req.user.id === resourceId ||
      req.user.phoneNumber === resourceId) {
    return next();
  }
  
  return res.status(403).json({ 
    success: false, 
    error: 'You can only access your own resources' 
  });
};

const isOwner = isOwnerOrManager;

module.exports = {
  logRequest,
  sanitizeInput,
  authenticateToken,
  verifyToken,
  optionalAuth,
  authorizeRoles,
  isManager,
  isEmployee,
  isEmployeeOrManager,
  isOwnerOrManager,
  isOwner,
};