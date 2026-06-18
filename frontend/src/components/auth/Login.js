import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import './Login.css';

const Login = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [loginType, setLoginType] = useState('manager');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (token && user) {
      try {
        const userData = JSON.parse(user);
        if (userData.role === 'manager') {
          navigate('/admin');
        } else if (userData.role === 'employee') {
          navigate('/employee');
        }
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
  }, [navigate]);

  const formatPhoneNumber = (value) => {
    return value.replace(/\D/g, '');
  };

  const isValidPhoneNumber = (value) => {
    const cleaned = formatPhoneNumber(value);
    return cleaned.length >= 10 && cleaned.length <= 15;
  };

  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleManagerLogin = async (e) => {
    e.preventDefault();
    
    const cleanPhone = formatPhoneNumber(phoneNumber);
    
    if (!cleanPhone) {
      toast.error('Please enter your phone number');
      return;
    }

    if (!isValidPhoneNumber(cleanPhone)) {
      toast.error('Phone number must be 10-15 digits');
      return;
    }

    setLoading(true);
    try {
      console.log('Sending manager login request:', { phoneNumber: cleanPhone });
      
      const response = await api.post('/auth/manager/create-code', {
        phoneNumber: cleanPhone
      });

      console.log('Manager login response:', response.data);

      if (response.data.success) {
        toast.success('Access code sent to your phone!');
        localStorage.setItem('phoneNumber', cleanPhone);
        localStorage.setItem('loginType', 'manager');
        localStorage.removeItem('email');
        navigate('/validate');
      }
    } catch (error) {
      console.error('Manager login error:', error);
      
      if (error.response?.status === 429) {
        toast.error('Too many attempts. Please wait a moment.');
      } else if (error.response?.status === 400) {
        toast.error(error.response?.data?.error || 'Invalid phone number');
      } else {
        toast.error(error.response?.data?.error || 'Failed to send access code');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeLogin = async (e) => {
    e.preventDefault();
    
    const formattedEmail = email.trim().toLowerCase();
    
    if (!formattedEmail) {
      toast.error('Please enter your email address');
      return;
    }

    if (!isValidEmail(formattedEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      console.log('Sending employee login request:', { email: formattedEmail });
      
      const response = await api.post('/auth/employee/login-email', {
        email: formattedEmail
      });

      console.log('Employee login response:', response.data);

      if (response.data.success) {
        toast.success('Access code sent to your email!');
        localStorage.setItem('email', formattedEmail);
        localStorage.setItem('loginType', 'employee');
        if (response.data.employeeId) {
          localStorage.setItem('employeeId', response.data.employeeId);
        }
        localStorage.removeItem('phoneNumber');
        navigate('/validate');
      }
    } catch (error) {
      console.error('Employee login error:', error);
      
      if (error.response?.status === 429) {
        toast.error('Too many attempts. Please wait a moment.');
      } else if (error.response?.status === 404) {
        toast.error('Employee not found. Please check your email.');
      } else {
        toast.error(error.response?.data?.error || 'Failed to send access code');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTabSwitch = (type) => {
    setLoginType(type);
    setPhoneNumber('');
    setEmail('');
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>Task Management System</h1>
          <p>Welcome back! Please login to continue</p>
        </div>
        
        <div className="login-type-selector">
          <button
            className={'tab-btn ' + (loginType === 'manager' ? 'active' : '')}
            onClick={() => handleTabSwitch('manager')}
          >
            Manager
          </button>
          <button
            className={'tab-btn ' + (loginType === 'employee' ? 'active' : '')}
            onClick={() => handleTabSwitch('employee')}
          >
            Employee
          </button>
        </div>

        {loginType === 'manager' ? (
          <form onSubmit={handleManagerLogin} className="login-form">
            <div className="form-group">
              <label>Phone Number</label>
              <div className="input-group">
                <span className="input-icon"></span>
                <input
                  type="tel"
                  placeholder="0328851734"
                  value={phoneNumber}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    setPhoneNumber(value);
                  }}
                  disabled={loading}
                  className="form-input"
                  maxLength={15}
                  autoFocus={loginType === 'manager'}
                />
              </div>
              <small>Enter your phone number (10-15 digits)</small>
            </div>
            <button 
              type="submit" 
              disabled={loading || !phoneNumber || phoneNumber.length < 10}
              className="login-btn"
            >
              {loading ? 'Sending...' : 'Send Access Code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleEmployeeLogin} className="login-form">
            <div className="form-group">
              <label>Email Address</label>
              <div className="input-group">
                <span className="input-icon"></span>
                <input
                  type="email"
                  placeholder="employee@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="form-input"
                  autoFocus={loginType === 'employee'}
                />
              </div>
              <small>Enter your work email address</small>
            </div>
            <button 
              type="submit" 
              disabled={loading || !email}
              className="login-btn"
            >
              {loading ? 'Sending...' : 'Send Access Code'}
            </button>
          </form>
        )}
        
        {process.env.NODE_ENV === 'development' && (
          <div className="debug-info">
            <p>Debug Info:</p>
            <p>Login Type: {loginType}</p>
            {loginType === 'manager' && <p>Phone: {phoneNumber || '(empty)'}</p>}
            {loginType === 'employee' && <p>Email: {email || '(empty)'}</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;