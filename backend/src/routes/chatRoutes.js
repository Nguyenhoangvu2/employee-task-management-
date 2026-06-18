const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { verifyToken } = require('../middleware/auth');

router.get('/messages', verifyToken, async (req, res) => {
  try {
    const { userId, with: otherUserId } = req.query;

    if (!userId || !otherUserId) {
      return res.status(400).json({ error: 'userId and with are required' });
    }

    console.log('Getting messages between:', userId, 'and', otherUserId);

    const possibleUsers = new Set([userId, otherUserId]);
    
    if (userId !== 'manager' && otherUserId !== 'manager') {
      possibleUsers.add('manager');
    }
    
    possibleUsers.add('0328851734');

    const userList = Array.from(possibleUsers);
    console.log('Possible users:', userList);

    const snapshot = await db.collection('chatMessages')
      .where('from', 'in', userList)
      .where('to', 'in', userList)
      .get();

    const messages = [];
    snapshot.forEach(doc => {
      messages.push({
        id: doc.id,
        ...doc.data()
      });
    });

    const filteredMessages = messages.filter(msg => {
      const from = msg.from;
      const to = msg.to;
      
      const isFromRelevant = from === userId || from === otherUserId || from === 'manager' || from === '0328851734';
      const isToRelevant = to === userId || to === otherUserId || to === 'manager' || to === '0328851734';
      
      return isFromRelevant && isToRelevant;
    });

    const uniqueMessages = [];
    const ids = new Set();
    filteredMessages.forEach(msg => {
      if (!ids.has(msg.id)) {
        ids.add(msg.id);
        uniqueMessages.push(msg);
      }
    });

    uniqueMessages.sort((a, b) => {
      return new Date(a.timestamp) - new Date(b.timestamp);
    });

    console.log('Found ' + uniqueMessages.length + ' messages');
    console.log('Messages:', uniqueMessages.map(m => ({ 
      from: m.from, 
      to: m.to, 
      message: m.message,
      timestamp: m.timestamp 
    })));

    res.json(uniqueMessages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ 
      error: 'Failed to get messages', 
      details: error.message 
    });
  }
});

router.post('/messages', verifyToken, async (req, res) => {
  try {
    const { from, to, message, type = 'text' } = req.body;

    if (!from || !to || !message) {
      return res.status(400).json({ 
        error: 'from, to, and message are required' 
      });
    }

    if (message.length > 1000) {
      return res.status(400).json({ 
        error: 'Message too long (max 1000 characters)' 
      });
    }

    const messageData = {
      from,
      to,
      message: message.trim(),
      type,
      timestamp: new Date().toISOString(),
      read: false,
      createdAt: new Date().toISOString()
    };

    const docRef = await db.collection('chatMessages').add(messageData);
    const savedMessage = { id: docRef.id, ...messageData };

    if (from === '0328851734' && to !== 'manager') {
      const messageData2 = {
        from: '0328851734',
        to: 'manager',
        message: message.trim(),
        type,
        timestamp: new Date().toISOString(),
        read: false,
        createdAt: new Date().toISOString()
      };
      await db.collection('chatMessages').add(messageData2);
      console.log('Also saved as to: manager');
    }

    console.log('Message saved:', savedMessage.id);
    console.log('From:', from, 'To:', to, 'Message:', message);

    res.status(201).json(savedMessage);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ 
      error: 'Failed to send message', 
      details: error.message 
    });
  }
});

router.get('/unread/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { from } = req.query;

    let query = db.collection('chatMessages')
      .where('to', '==', userId)
      .where('read', '==', false);

    if (from) {
      query = query.where('from', '==', from);
    }

    const snapshot = await query.get();
    const count = snapshot.size;

    res.json({ unread: count });
  } catch (error) {
    console.error('Get unread error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

router.post('/read', verifyToken, async (req, res) => {
  try {
    const { userId, from } = req.body;

    if (!userId || !from) {
      return res.status(400).json({ error: 'userId and from are required' });
    }

    const snapshot = await db.collection('chatMessages')
      .where('to', '==', userId)
      .where('from', '==', from)
      .where('read', '==', false)
      .get();

    const batch = db.batch();
    snapshot.forEach(doc => {
      batch.update(doc.ref, { 
        read: true, 
        readAt: new Date().toISOString() 
      });
    });

    await batch.commit();
    console.log('Marked ' + snapshot.size + ' messages as read');

    res.json({ 
      success: true, 
      count: snapshot.size 
    });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

module.exports = router;