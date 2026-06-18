import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import socketService from '../../services/socket';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { FaPaperPlane, FaUserCircle, FaSpinner } from 'react-icons/fa';
import './Chat.css';

const Chat = ({ employees = [] }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState(null);
  
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const { user } = useAuth();
  const isSendingRef = useRef(false);
  
  const employeeArray = Array.isArray(employees) ? employees : [];

  const getUserId = useCallback(() => {
    return user?.employeeId || user?.phoneNumber || 'user';
  }, [user]);

  const getUserRole = useCallback(() => {
    return user?.role || 'employee';
  }, [user]);

  const getCurrentChatPartner = useCallback(() => {
    if (getUserRole() === 'employee') {
      return 'manager';
    }
    return selectedEmployee?.id || null;
  }, [selectedEmployee, getUserRole]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const loadMessages = useCallback(async () => {
    const partner = getCurrentChatPartner();
    if (!partner) {
      setMessages([]);
      return;
    }

    try {
      setLoadingMessages(true);
      setError(null);
      const userId = getUserId();
      
      const response = await api.get('/chat/messages', {
        params: {
          userId: userId,
          with: partner
        }
      });
      
      const data = Array.isArray(response.data) ? response.data : [];
      
      const messagesWithOwn = data.map(msg => ({
        ...msg,
        isOwn: msg.from === userId || msg.from === user?.phoneNumber
      }));
      
      setMessages(messagesWithOwn);
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error('Error loading messages:', error);
      setError('Failed to load messages');
      toast.error('Failed to load messages');
    } finally {
      setLoadingMessages(false);
    }
  }, [getCurrentChatPartner, getUserId, user, scrollToBottom]);

  useEffect(() => {
    const userId = getUserId();
    const role = getUserRole();
    
    socketService.disconnect();
    socketService.connect(userId, role);

    const handleConnect = () => {
      console.log('Connected to chat server');
      setIsConnected(true);
    };

    const handleDisconnect = () => {
      console.log('Disconnected from chat server');
      setIsConnected(false);
    };

    const handleReceiveMessage = (data) => {
      console.log('Received message:', data);
      const userId = getUserId();
      const partner = getCurrentChatPartner();
      
      const isRelevant = (
        data.from === userId || 
        data.to === userId ||
        data.from === partner ||
        data.to === partner
      );

      if (!isRelevant) {
        console.log('Ignoring irrelevant message');
        return;
      }
      
      setMessages(prev => {
        const exists = prev.some(msg => 
          msg.id === data.id || 
          (msg.message === data.message && 
           msg.timestamp === data.timestamp &&
           msg.from === data.from &&
           msg.to === data.to)
        );
        
        if (exists) return prev;
        
        const newMsg = { 
          ...data, 
          isOwn: data.from === userId || data.from === user?.phoneNumber 
        };
        
        return [...prev, newMsg];
      });
      
      setTimeout(scrollToBottom, 100);
    };

    const handleUserTyping = (data) => {
      const partner = getCurrentChatPartner();
      if (data.from === partner && data.from !== getUserId()) {
        setTypingUser(data.from);
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          setTypingUser(null);
        }, 3000);
      }
    };

    socketService.on('connect', handleConnect);
    socketService.on('disconnect', handleDisconnect);
    socketService.on('receive-message', handleReceiveMessage);
    socketService.on('user-typing', handleUserTyping);

    loadMessages();

    return () => {
      console.log('Cleaning up socket listeners...');
      
      socketService.off('connect', handleConnect);
      socketService.off('disconnect', handleDisconnect);
      socketService.off('receive-message', handleReceiveMessage);
      socketService.off('user-typing', handleUserTyping);
      
      socketService.disconnect();
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      setIsConnected(false);
      setTypingUser(null);
    };
  }, [user, getUserId, getUserRole, getCurrentChatPartner, loadMessages, scrollToBottom]);

  useEffect(() => {
    if (selectedEmployee || getUserRole() === 'employee') {
      loadMessages();
      setTypingUser(null);
    }
  }, [selectedEmployee, loadMessages, getUserRole]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim()) {
      toast.error('Please enter a message');
      return;
    }
    
    if (isSendingRef.current) {
      console.log('Already sending, please wait...');
      return;
    }
    
    const partner = getCurrentChatPartner();
    if (!partner) {
      toast.error('Please select a chat partner');
      return;
    }

    if (!isConnected) {
      toast.error('Not connected to server');
      return;
    }

    isSendingRef.current = true;
    
    const from = getUserId();
    const messageText = newMessage.trim();
    
    const tempId = Date.now() + '-' + Math.random().toString(36).substr(2, 9) + '-' + from;
    const tempMessage = {
      id: tempId,
      from,
      to: partner,
      message: messageText,
      timestamp: new Date().toISOString(),
      type: 'text',
      isOwn: true,
      status: 'sending'
    };
    
    console.log('Sending message:', tempMessage);
    
    setMessages(prev => [...prev, tempMessage]);
    setNewMessage('');
    scrollToBottom();

    try {
      const response = await api.post('/chat/messages', {
        from,
        to: partner,
        message: messageText,
        timestamp: new Date().toISOString(),
        type: 'text'
      });
      
      console.log('API response:', response.data);
      const savedMessage = response.data;
      
      setMessages(prev => 
        prev.map(msg => 
          msg.id === tempId 
            ? { ...savedMessage, isOwn: true, status: 'sent' } 
            : msg
        )
      );
      
      socketService.emit('send-message', {
        from,
        to: partner,
        message: messageText,
        timestamp: new Date().toISOString(),
        type: 'text'
      });
      
    } catch (error) {
      console.error('Error sending message:', error);
      
      setMessages(prev => 
        prev.map(msg => 
          msg.id === tempId 
            ? { ...msg, status: 'error' } 
            : msg
        )
      );
      
      toast.error('Failed to send message');
    } finally {
      setTimeout(() => {
        isSendingRef.current = false;
      }, 500);
    }
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    const partner = getCurrentChatPartner();
    
    if (!partner) return;
    
    if (!typing && e.target.value.trim()) {
      setTyping(true);
      socketService.emit('typing', { 
        from: getUserId(), 
        to: partner, 
        isTyping: true 
      });
    }

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (typing) {
        setTyping(false);
        socketService.emit('typing', { 
          from: getUserId(), 
          to: partner, 
          isTyping: false 
        });
      }
    }, 2000);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.charAt(0).toUpperCase();
  };

  return (
    <div className="chat-container">
      <div className="chat-sidebar">
        <div className="chat-sidebar-header">
          <h4>Contacts</h4>
          {isConnected && <span className="online-badge">Online</span>}
        </div>
        <div className="chat-contact-list">
          {getUserRole() === 'manager' && employeeArray.map(emp => (
            <div
              key={emp?.id || emp?._id}
              className={'chat-contact ' + (selectedEmployee?.id === emp?.id ? 'active' : '')}
              onClick={() => {
                setSelectedEmployee(emp);
                setMessages([]);
              }}
              role="button"
              tabIndex={0}
              onKeyPress={(e) => e.key === 'Enter' && setSelectedEmployee(emp)}
            >
              <div className="contact-avatar-wrapper">
                <FaUserCircle className="contact-avatar" />
                <span className={'online-dot ' + (isConnected ? 'online' : 'offline')} />
              </div>
              <div className="contact-info">
                <div className="contact-name-wrapper">
                  <span className="contact-name">{emp?.name || 'Unknown'}</span>
                </div>
                <span className="contact-role">{emp?.role || 'Employee'}</span>
              </div>
            </div>
          ))}
          
          {getUserRole() === 'employee' && (
            <div className="chat-contact active">
              <div className="contact-avatar-wrapper">
                <FaUserCircle className="contact-avatar" />
                <span className={'online-dot ' + (isConnected ? 'online' : 'offline')} />
              </div>
              <div className="contact-info">
                <div className="contact-name-wrapper">
                  <span className="contact-name">Manager</span>
                </div>
                <span className="contact-role">Admin</span>
              </div>
            </div>
          )}
          
          {getUserRole() === 'manager' && employeeArray.length === 0 && (
            <div className="chat-contact empty-contact">
              <span>No employees available</span>
            </div>
          )}
        </div>
      </div>

      <div className="chat-main">
        <div className="chat-header">
          <div className="chat-header-left">
            <div className="chat-avatar">
              {getUserRole() === 'employee' 
                ? 'M' 
                : selectedEmployee 
                  ? getInitials(selectedEmployee?.name)
                  : '?'}
            </div>
            <div className="chat-header-info">
              <h4>
                {getUserRole() === 'employee' 
                  ? 'Manager' 
                  : selectedEmployee 
                    ? selectedEmployee?.name || 'Employee' 
                    : 'Select a contact'}
              </h4>
              <span className="chat-header-role">
                {getUserRole() === 'employee' ? 'Admin' : selectedEmployee?.role || 'Employee'}
              </span>
            </div>
          </div>
          <div className="chat-header-right">
            <button 
              onClick={loadMessages} 
              className="refresh-btn" 
              title="Refresh"
              disabled={loadingMessages}
            >
              {loadingMessages ? <FaSpinner className="spinning" /> : '↻'}
            </button>
            <span className={'connection-status ' + (isConnected ? 'online' : 'offline')}>
              {isConnected ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>

        <div className="chat-messages">
          {loadingMessages ? (
            <div className="loading-messages">
              <FaSpinner className="spinner" />
              <span>Loading messages...</span>
            </div>
          ) : error ? (
            <div className="error-messages">
              <span>{error}</span>
              <button onClick={loadMessages} className="retry-btn">
                Retry
              </button>
            </div>
          ) : messages.length === 0 ? (
            <div className="empty-chat">
              <span className="empty-icon">💬</span>
              <span>No messages yet</span>
              <span className="empty-hint">Start chatting!</span>
            </div>
          ) : (
            <>
              {messages.map((msg, index) => (
                <div
                  key={msg?.id || index}
                  className={'message ' + (msg?.isOwn ? 'message-own' : 'message-other')}
                >
                  <div className="message-content">
                    <p>{msg?.message || ''}</p>
                    <span className="message-time">
                      {formatTime(msg?.timestamp)}
                      {msg?.status === 'sending' && (
                        <span className="status-icon sending">⏳</span>
                      )}
                      {msg?.status === 'sent' && (
                        <span className="status-icon sent">✓</span>
                      )}
                      {msg?.status === 'error' && (
                        <span className="status-icon error">✗</span>
                      )}
                    </span>
                  </div>
                </div>
              ))}
              {typingUser && (
                <div className="typing-indicator">
                  <div className="typing-dots">
                    <span className="dot" />
                    <span className="dot" />
                    <span className="dot" />
                  </div>
                  <span>Typing...</span>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSendMessage} className="chat-input-form">
          <input
            type="text"
            placeholder={
              !isConnected 
                ? "Connecting..." 
                : !getCurrentChatPartner() 
                  ? "Select a contact first" 
                  : "Type a message..."
            }
            value={newMessage}
            onChange={handleTyping}
            className="chat-input"
            disabled={!isConnected || !getCurrentChatPartner() || isSendingRef.current}
          />
          <button 
            type="submit" 
            className="send-btn" 
            disabled={!isConnected || !newMessage.trim() || isSendingRef.current || !getCurrentChatPartner()}
          >
            {isSendingRef.current ? (
              <FaSpinner className="spinning" />
            ) : (
              <FaPaperPlane />
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chat;