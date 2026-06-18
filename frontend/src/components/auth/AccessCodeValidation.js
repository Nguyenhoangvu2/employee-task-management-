import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import './Login.css';

const AccessCodeValidation = () => {
  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [loginType, setLoginType] = useState('manager');
  const [timeLeft, setTimeLeft] = useState(600);
  const [canResend, setCanResend] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const storedPhone = localStorage.getItem('phoneNumber');
    const storedEmail = localStorage.getItem('email');
    const storedType = localStorage.getItem('loginType');

    console.log('AccessCodeValidation - storedType:', storedType);
    console.log('AccessCodeValidation - storedPhone:', storedPhone);
    console.log('AccessCodeValidation - storedEmail:', storedEmail);

    if (storedType === 'manager' && storedPhone) {
      setPhoneNumber(storedPhone);
      setLoginType('manager');
    } else if (storedType === 'employee' && storedEmail) {
      setEmail(storedEmail);
      setLoginType('employee');
    } else {
      toast.error('Please login first');
      navigate('/login');
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanResend(true);
          toast.error('Access code expired. Please request a new one.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

  useEffect(() => {
    if (timeLeft === 0) {
      setCanResend(true);
    } else {
      setCanResend(false);
    }
  }, [timeLeft]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins + ':' + secs.toString().padStart(2, '0');
  };

  const handleValidate = async (e) => {
    e.preventDefault();
    
    if (!accessCode || accessCode.length !== 6) {
      toast.error('Please enter a valid 6-digit access code');
      return;
    }

    setLoading(true);
    try {
      let response;
      
      if (loginType === 'manager') {
        console.log('Validating manager with phone:', phoneNumber);
        response = await api.post('/auth/manager/validate-code', {
          phoneNumber,
          accessCode
        });
      } else {
        console.log('Validating employee with email:', email);
        console.log('Access code:', accessCode);
        response = await api.post('/auth/employee/validate-code', {
          email,
          accessCode
        });
      }

      console.log('Validation response:', response.data);

      if (response.data.success) {
        const { token, role, employee, user } = response.data;
        
        const userData = {
          role,
          phoneNumber: loginType === 'manager' ? phoneNumber : undefined,
          email: loginType === 'employee' ? email : undefined,
          employeeId: employee?.id || user?.employeeId,
          name: employee?.name || user?.name || 'User'
        };
        
        login(userData, token);
        toast.success('Login successful!');
        
        localStorage.removeItem('phoneNumber');
        localStorage.removeItem('email');
        localStorage.removeItem('loginType');
        localStorage.removeItem('employeeId');
        
        setTimeout(() => {
          if (role === 'manager') {
            navigate('/admin');
          } else {
            navigate('/employee');
          }
        }, 500);
      }
    } catch (error) {
      console.error('Validation error:', error);
      
      if (error.response?.status === 429) {
        toast.error('Too many attempts. Please wait a moment.');
        setCanResend(false);
        setTimeLeft(60);
      } else if (error.response?.status === 401) {
        const errorMsg = error.response?.data?.error || 'Invalid access code';
        toast.error(errorMsg);
        if (process.env.NODE_ENV === 'development' && error.response?.data?.debug) {
          console.log('Debug info:', error.response.data.debug);
        }
      } else {
        toast.error(error.response?.data?.error || 'Invalid access code');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend && timeLeft > 0) {
      toast.error('Please wait ' + formatTime(timeLeft) + ' before resending');
      return;
    }

    setLoading(true);
    try {
      if (loginType === 'manager') {
        await api.post('/auth/manager/create-code', { phoneNumber });
      } else {
        await api.post('/auth/employee/login-email', { email });
      }
      toast.success('New access code sent!');
      setTimeLeft(600);
      setCanResend(false);
      setAccessCode('');
    } catch (error) {
      console.error('Resend error:', error);
      toast.error(error.response?.data?.error || 'Failed to resend code');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/login');
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>Verify Access Code</h1>
          <p className="subtitle">
            Enter the 6-digit code sent to your {loginType === 'manager' ? 'phone' : 'email'}
          </p>
        </div>
        
        <div className="timer-container">
          <div className="timer">
            Time remaining: 
            <span className={timeLeft < 60 ? 'urgent' : ''}>
              {formatTime(timeLeft)}
            </span>
          </div>
          <div className="recipient-info">
            {loginType === 'manager' 
              ? 'Sent to: ' + phoneNumber
              : 'Sent to: ' + email}
          </div>
        </div>
        
        <form onSubmit={handleValidate} className="login-form">
          <div className="form-group">
            <label>Access Code</label>
            <div className="input-group">
              <span className="input-icon"></span>
              <input
                type="text"
                placeholder="Enter 6-digit code"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                disabled={loading || timeLeft === 0}
                className="form-input code-input"
                autoFocus
              />
            </div>
            <small>Enter the 6-digit code you received</small>
          </div>
          
          <button 
            type="submit" 
            disabled={loading || timeLeft === 0 || accessCode.length !== 6} 
            className="login-btn"
          >
            {loading ? 'Verifying...' : 'Verify Code'}
          </button>
          
          <div className="resend-section">
            <button 
              type="button" 
              onClick={handleResend} 
              disabled={loading || (!canResend && timeLeft > 0)}
              className="resend-btn"
            >
              {canResend ? 'Resend Code' : 'Resend in ' + formatTime(timeLeft)}
            </button>
          </div>

          <button 
            type="button" 
            onClick={handleBack}
            className="back-btn"
            disabled={loading}
          >
            Back to Login
          </button>
        </form>

        {process.env.NODE_ENV === 'development' && (
          <div className="debug-info" style={{ marginTop: '20px', fontSize: '12px', color: '#999', borderTop: '1px solid #eee', paddingTop: '10px' }}>
            <p>Debug Info:</p>
            <p>Login Type: {loginType}</p>
            <p>Phone: {phoneNumber || '(empty)'}</p>
            <p>Email: {email || '(empty)'}</p>
            <p>Access Code: {accessCode || '(empty)'}</p>
            <p>Time Left: {timeLeft}s</p>
            <p>Can Resend: {canResend ? 'Yes' : 'No'}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccessCodeValidation;