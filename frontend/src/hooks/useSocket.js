import { useEffect, useState, useRef } from 'react';
import socketService from '../services/socket';
import { useAuth } from '../context/AuthContext';

export const useSocket = (eventHandlers = {}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const handlersRef = useRef(eventHandlers);

  useEffect(() => {
    handlersRef.current = eventHandlers;
  }, [eventHandlers]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const userId = user.employeeId || user.phoneNumber || 'user';
    const role = user.role || 'employee';
    
    const socket = socketService.connect(userId, role);

    const handleConnect = () => {
      setIsConnected(true);
      setError(null);
      console.log('Socket connected');
      if (handlersRef.current.onConnect) {
        handlersRef.current.onConnect();
      }
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      console.log('Socket disconnected');
      if (handlersRef.current.onDisconnect) {
        handlersRef.current.onDisconnect();
      }
    };

    const handleConnectError = (err) => {
      setError(err);
      console.error('Socket connection error:', err);
      if (handlersRef.current.onError) {
        handlersRef.current.onError(err);
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);

    Object.entries(handlersRef.current).forEach(([event, handler]) => {
      if (typeof handler === 'function' && !['onConnect', 'onDisconnect', 'onError'].includes(event)) {
        socket.on(event, handler);
      }
    });

    return () => {
      if (socket) {
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        socket.off('connect_error', handleConnectError);
        
        Object.keys(handlersRef.current).forEach(event => {
          if (typeof handlersRef.current[event] === 'function') {
            socket.off(event, handlersRef.current[event]);
          }
        });
      }
    };
  }, [user]);

  const emit = (event, data) => {
    if (isConnected) {
      socketService.emit(event, data);
    } else {
      console.warn('Socket not connected. Cannot emit event:', event);
    }
  };

  return { isConnected, error, emit };
};

export default useSocket;