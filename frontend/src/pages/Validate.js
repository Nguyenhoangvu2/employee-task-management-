import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import './Validate.css';

const Validate = () => {
  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginType, setLoginType] = useState('manager');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const storedLoginType = localStorage.getItem('loginType');
    const storedPhone = localStorage.getItem('phoneNumber');
    const storedEmail = localStorage.getItem('email');
    const storedEmployeeId = localStorage.getItem('employeeId');

    if (storedLoginType) {
      setLoginType(storedLoginType);
    }
    if (storedPhone) {
      setPhoneNumber(storedPhone);
    }
    if (storedEmail) {
      setEmail(storedEmail);
    }
    if (storedEmployeeId) {
      setEmployeeId(storedEmployeeId);
    }

    if (!storedPhone && !storedEmail) {
      navigate('/login');
    }
  }, [navigate]);

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
        response = await api.post('/auth/manager/validate-code', {
          phoneNumber,
          accessCode
        });
      } else {
        response = await api.post('/auth/employee/validate-code', {
          email,
          accessCode
        });
      }

      console.log('Validate response:', response.data);

      if (response.data.success) {
        toast.success('Login successful!');
        
        const userData = response.data.user || response.data.employee;
        login(userData, response.data.token);
        
        if (response.data.role === 'manager') {
          navigate('/admin');
        } else {
          navigate('/employee');
        }
      }
    } catch (error) {
      console.error('Validate error:', error);
      toast.error(error.response?.data?.error || 'Invalid access code');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    try {
      if (loginType === 'manager') {
        await api.post('/auth/manager/create-code', { phoneNumber });
      } else {
        await api.post('/auth/employee/login-email', { email });
      }
      toast.success('New code sent!');
    } catch (error) {
      toast.error('Failed to resend code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="validate-container">
      <div className="validate-card">
        <h2>Enter Access Code</h2>
        <p>We sent a 6-digit code to ' + (loginType === 'manager' ? phoneNumber : email) + '</p>
        
        <form onSubmit={handleValidate}>
          <div className="form-group">
            <input
              type="text"
              placeholder="Enter 6-digit code"
              value={accessCode}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                setAccessCode(value.slice(0, 6));
              }}
              disabled={loading}
              maxLength={6}
              autoFocus
            />
          </div>
          
          <button type="submit" disabled={loading || accessCode.length !== 6}>
            {loading ? 'Verifying...' : 'Verify'}
          </button>
        </form>
        
        <button onClick={handleResend} disabled={loading}>
          Resend Code
        </button>
        
        <button onClick={() => navigate('/login')}>
          Back to Login
        </button>
      </div>
    </div>
  );
};

export default Validate;