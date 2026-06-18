import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import socketService from '../../services/socket';
import api from '../../services/api';
import { FaCircle, FaSpinner } from 'react-icons/fa';
import toast from 'react-hot-toast';
import './Chat.css';

const ChatList = ({ onSelectUser, selectedUserId }) => {
  const [activeUsers, setActiveUsers] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  const getUserId = useCallback(() => {
    return user?.employeeId || user?.phoneNumber || user?.id;
  }, [user]);

  const getUserRole = useCallback(() => {
    return user?.role || 'employee';
  }, [user]);

  const fetchUnreadCounts = useCallback(async () => {
    const userId = getUserId();
    if (!userId) return;

    try {
      const response = await api.get('/chat/unread/' + userId);
      console.log('Unread counts:', response.data);
      
      if (response.data && typeof response.data === 'object') {
        setUnreadCounts(response.data);
      } else if (response.data?.unread !== undefined) {
        setUnreadCounts(prev => ({
          ...prev,
          manager: response.data.unread
        }));
      }
    } catch (error) {
      console.error('Error fetching unread counts:', error);
    }
  }, [getUserId]);

  const markAsRead = useCallback(async (userId) => {
    try {
      const currentUserId = getUserId();
      await api.post('/chat/read', {
        userId: currentUserId,
        from: userId
      });
      
      setUnreadCounts(prev => ({
        ...prev,
        [userId]: 0
      }));
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [getUserId]);

  useEffect(() => {
    const userId = getUserId();
    if (!userId) {
      setLoading(false);
      return;
    }

    const handleActiveUsers = (users) => {
      console.log('Active users received:', users);
      setActiveUsers(users || []);
      setLoading(false);
      setError(null);
    };

    const handleUserJoined = (data) => {
      console.log('User joined:', data);
      setActiveUsers(prev => {
        const exists = prev.some(u => u.userId === data.userId);
        if (exists) return prev;
        return [...prev, data];
      });
    };

    const handleUserLeft = (data) => {
      console.log('User left:', data);
      setActiveUsers(prev => prev.filter(u => u.userId !== data.userId));
    };

    const handleConnectError = (error) => {
      console.error('Socket error:', error);
      setError('Connection error. Please refresh.');
      setLoading(false);
    };

    const handleConnect = () => {
      console.log('Socket connected');
      setLoading(false);
    };

    socketService.on('active-users', handleActiveUsers);
    socketService.on('user-joined', handleUserJoined);
    socketService.on('user-left', handleUserLeft);
    socketService.on('connect', handleConnect);
    socketService.on('connect_error', handleConnectError);

    fetchUnreadCounts();

    const pollInterval = setInterval(fetchUnreadCounts, 10000);

    const timeoutId = setTimeout(() => {
      if (loading) {
        setLoading(false);
        console.log('Loading timeout');
      }
    }, 5000);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(pollInterval);
      socketService.off('active-users', handleActiveUsers);
      socketService.off('user-joined', handleUserJoined);
      socketService.off('user-left', handleUserLeft);
      socketService.off('connect', handleConnect);
      socketService.off('connect_error', handleConnectError);
    };
  }, [getUserId, fetchUnreadCounts, loading]);

  const handleSelectUser = useCallback(async (activeUser) => {
    if (unreadCounts[activeUser.userId] > 0) {
      await markAsRead(activeUser.userId);
    }
    
    if (onSelectUser) {
      onSelectUser(activeUser);
    }
  }, [unreadCounts, markAsRead, onSelectUser]);

  const getStatusColor = useCallback((userId) => {
    return activeUsers.some(u => u.userId === userId) ? '#4CAF50' : '#9e9e9e';
  }, [activeUsers]);

  const getUserStatus = useCallback((userId) => {
    return activeUsers.some(u => u.userId === userId) ? 'Online' : 'Offline';
  }, [activeUsers]);

  const getUserDisplayName = useCallback((activeUser) => {
    if (activeUser.role === 'manager') {
      return 'Manager';
    }
    return activeUser.name || 'Unknown User';
  }, []);

  const getUserDisplayRole = useCallback((activeUser) => {
    if (activeUser.role === 'manager') {
      return 'Admin';
    }
    return activeUser.role || 'Employee';
  }, []);

  if (loading) {
    return (
      <div className="chat-list">
        <div className="chat-list-header">
          <h4>Active Users</h4>
          <span className="user-count">Loading...</span>
        </div>
        <div className="chat-list-items">
          <div className="chat-list-item loading-item">
            <FaSpinner className="spinner" />
            <span>Loading users...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="chat-list">
        <div className="chat-list-header">
          <h4>Active Users</h4>
        </div>
        <div className="chat-list-items">
          <div className="chat-list-item error-item">
            <span className="error-icon">⚠️</span>
            <span>{error}</span>
            <button 
              onClick={() => window.location.reload()} 
              className="retry-btn"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-list">
      <div className="chat-list-header">
        <h4>Active Users</h4>
        <span className="user-count">
          <span className="online-indicator" />
          {activeUsers.length} online
        </span>
      </div>
      
      <div className="chat-list-items">
        {activeUsers.length === 0 ? (
          <div className="chat-list-item empty-item">
            <span className="empty-icon">👤</span>
            <span>No users online</span>
            <span className="empty-hint">Waiting for others to connect...</span>
          </div>
        ) : (
          activeUsers.map((activeUser) => {
            const isSelected = selectedUserId === activeUser.userId;
            const unreadCount = unreadCounts[activeUser.userId] || 0;
            const isOnline = getUserStatus(activeUser.userId) === 'Online';
            
            return (
              <div
                key={activeUser.userId}
                className={'chat-list-item ' + (isSelected ? 'selected' : '')}
                onClick={() => handleSelectUser(activeUser)}
                role="button"
                tabIndex={0}
                onKeyPress={(e) => e.key === 'Enter' && handleSelectUser(activeUser)}
              >
                <div className="user-avatar">
                  <span className="avatar-text">
                    {getUserDisplayName(activeUser).charAt(0).toUpperCase()}
                  </span>
                  <FaCircle 
                    className={'status-dot ' + (isOnline ? 'online' : 'offline')}
                  />
                </div>
                <div className="user-info">
                  <div className="user-name-wrapper">
                    <span className="user-name">
                      {getUserDisplayName(activeUser)}
                    </span>
                    <span className={'user-status ' + (isOnline ? 'online' : 'offline')}>
                      {isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <span className="user-role">
                    {getUserDisplayRole(activeUser)}
                  </span>
                </div>
                {unreadCount > 0 && (
                  <span className="unread-badge">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ChatList;