const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const taskRoutes = require('./routes/taskRoutes');
const chatRoutes = require('./routes/chatRoutes');

const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { logRequest, sanitizeInput } = require('./middleware/auth');

const smsService = require('./services/smsService');
const emailService = require('./services/emailService');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  },
  path: '/socket.io/',
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

app.set('io', io);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
}));

app.use(compression());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(logRequest);
app.use(sanitizeInput);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 5 : 50,
  message: {
    error: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', globalLimiter);
app.use('/api/auth/', authLimiter);

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/', (req, res) => {
  res.json({
    message: 'Task Management API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      employees: '/api/employees',
      tasks: '/api/tasks',
      chat: '/api/chat',
      sms: '/api/sms'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    services: {
      firebase: require('./config/firebase').db ? 'connected' : 'disconnected',
      email: emailService.transporter ? 'ready' : 'not ready',
      sms: smsService.client ? 'ready' : 'not ready'
    }
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/chat', chatRoutes);

app.post('/api/sms/incoming', async (req, res) => {
  try {
    await smsService.handleIncomingSMS(req, res);
  } catch (error) {
    console.error('SMS incoming webhook error:', error);
    res.status(500).json({ error: 'Failed to process incoming SMS' });
  }
});

app.post('/api/sms/status', async (req, res) => {
  try {
    await smsService.handleStatusCallback(req, res);
  } catch (error) {
    console.error('SMS status webhook error:', error);
    res.status(500).json({ error: 'Failed to process SMS status' });
  }
});

app.get('/api/sms/status', async (req, res) => {
  try {
    const status = await smsService.checkServiceStatus();
    res.json(status);
  } catch (error) {
    console.error('SMS status check error:', error);
    res.status(500).json({ error: 'Failed to check SMS status' });
  }
});

app.get('/api/email/status', (req, res) => {
  try {
    const status = {
      success: true,
      message: 'Email service is operational',
      transporter: emailService.transporter ? 'Initialized' : 'Not initialized'
    };
    res.json(status);
  } catch (error) {
    console.error('Email status check error:', error);
    res.status(500).json({ error: 'Failed to check email status' });
  }
});

const activeUsers = new Map();

io.on('connection', (socket) => {
  console.log('New client connected: ' + socket.id);
  
  socket.on('join-chat', (data) => {
    const { userId, role, name } = data;
    
    if (!userId) {
      console.error('Join chat: Missing userId');
      return;
    }
    
    socket.userId = userId;
    socket.role = role || 'employee';
    socket.name = name || 'User';
    
    socket.join('user-' + userId);
    
    activeUsers.set(userId, {
      socketId: socket.id,
      userId,
      role: socket.role,
      name: socket.name,
      joinedAt: new Date().toISOString()
    });
    
    if (socket.role === 'manager') {
      socket.join('manager-room');
      console.log('Manager ' + userId + ' joined chat');
    } else {
      console.log('Employee ' + userId + ' joined chat');
    }
    
    const activeUsersList = Array.from(activeUsers.values());
    socket.emit('active-users', activeUsersList);
    
    io.emit('user-joined', {
      userId,
      role: socket.role,
      name: socket.name,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('send-message', async (data) => {
    try {
      const { to, message, from, timestamp, type = 'text' } = data;
      
      if (!to || !message || !from) {
        socket.emit('message-error', { error: 'Missing required fields' });
        return;
      }

      if (message.length > 1000) {
        socket.emit('message-error', { error: 'Message too long (max 1000 characters)' });
        return;
      }

      const { db } = require('./config/firebase');
      
      const messageData = {
        from,
        to,
        message,
        type,
        timestamp: timestamp || new Date().toISOString(),
        read: false,
        createdAt: new Date().toISOString()
      };
      
      const docRef = await db.collection('chatMessages').add(messageData);
      const savedMessage = { id: docRef.id, ...messageData };

      const recipientSocketId = activeUsers.get(to)?.socketId;
      
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('receive-message', {
          ...savedMessage,
          isOwn: false
        });
        console.log('Message sent to ' + to);
      } else {
        await db.collection('chatMessages').doc(docRef.id).update({
          delivered: false,
          offline: true
        });
        console.log('User ' + to + ' is offline. Message saved.');
      }

      socket.emit('message-sent', {
        ...savedMessage,
        delivered: !!recipientSocketId
      });

      if (to === 'manager') {
        io.to('manager-room').emit('receive-message', {
          ...savedMessage,
          isOwn: false
        });
      }

    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('message-error', { error: 'Failed to send message' });
    }
  });

  socket.on('typing', (data) => {
    const { to, from, isTyping } = data;
    
    if (!to || !from) return;
    
    const recipientSocketId = activeUsers.get(to)?.socketId;
    
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('user-typing', {
        from,
        isTyping,
        timestamp: new Date().toISOString()
      });
    }
  });

  socket.on('mark-read', async (data) => {
    try {
      const { from, to } = data;
      
      if (!from || !to) return;
      
      const { db } = require('./config/firebase');
      
      const snapshot = await db.collection('chatMessages')
        .where('from', '==', from)
        .where('to', '==', to)
        .where('read', '==', false)
        .get();
      
      const batch = db.batch();
      snapshot.forEach(doc => {
        batch.update(doc.ref, { read: true, readAt: new Date().toISOString() });
      });
      
      await batch.commit();
      
      const senderSocketId = activeUsers.get(from)?.socketId;
      if (senderSocketId) {
        io.to(senderSocketId).emit('messages-read', {
          by: to,
          timestamp: new Date().toISOString()
        });
      }
      
      console.log('Messages from ' + from + ' to ' + to + ' marked as read');
    } catch (error) {
      console.error('Mark read error:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected: ' + socket.id);
    
    if (socket.userId) {
      activeUsers.delete(socket.userId);
      
      io.emit('user-left', {
        userId: socket.userId,
        timestamp: new Date().toISOString()
      });
      
      console.log('User ' + socket.userId + ' removed from active users');
    }
  });

  socket.on('error', (error) => {
    console.error('Socket error for ' + socket.id + ':', error);
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  server.close(() => process.exit(1));
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  server.close(() => process.exit(1));
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('Server is running on port ' + PORT);
  console.log('Environment: ' + (process.env.NODE_ENV || 'development'));
  console.log('API URL: http://localhost:' + PORT + '/api');
  console.log('Socket URL: http://localhost:' + PORT);
  console.log('='.repeat(60));
  
  console.log('\nEmail Service: ' + (emailService.transporter ? 'Initialized' : 'Not initialized'));
  console.log('SMS Service: ' + (smsService.client ? 'Initialized' : 'Not initialized'));
  console.log('Firebase: ' + (require('./config/firebase').db ? 'Connected' : 'Not connected'));
  console.log('='.repeat(60));
});

const gracefulShutdown = () => {
  console.log('\nReceived shutdown signal. Closing server gracefully...');
  
  server.close(() => {
    console.log('Server closed successfully');
    process.exit(0);
  });
  
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

module.exports = { app, server, io };