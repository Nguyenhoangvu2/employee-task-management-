import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import TaskList from './TaskList';
import Chat from '../chat/Chat';
import { FaTasks, FaUser, FaComments, FaSignOutAlt, FaSpinner } from 'react-icons/fa';
import api from '../../services/api';
import toast from 'react-hot-toast';
import './Dashboard.css';

const EmployeeDashboard = () => {
  const [activeTab, setActiveTab] = useState('tasks');
  const [tasks, setTasks] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [taskLoading, setTaskLoading] = useState(false);
  const chatKeyRef = useRef(0);
  const [chatKey, setChatKey] = useState(0);
  const { user, logout } = useAuth();

  const fetchMyTasks = useCallback(async () => {
    try {
      setTaskLoading(true);
      const employeeId = user?.employeeId;
      if (!employeeId) {
        console.warn('No employee ID found');
        setTasks([]);
        return;
      }
      
      const response = await api.get('/tasks/employee/' + employeeId);
      const data = Array.isArray(response.data) ? response.data : [];
      setTasks(data);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setTasks([]);
      if (error.response?.status !== 404) {
        toast.error('Failed to fetch tasks');
      }
    } finally {
      setTaskLoading(false);
    }
  }, [user?.employeeId]);

  const fetchProfile = useCallback(async () => {
    try {
      const employeeId = user?.employeeId;
      if (!employeeId) {
        console.warn('No employee ID found');
        setProfile(null);
        setLoading(false);
        return;
      }
      
      const response = await api.get('/employees/' + employeeId);
      setProfile(response.data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
      if (error.response?.status === 404) {
        toast.error('Profile not found');
      }
    } finally {
      setLoading(false);
    }
  }, [user?.employeeId]);

  useEffect(() => {
    fetchMyTasks();
    fetchProfile();
  }, [fetchMyTasks, fetchProfile]);

  useEffect(() => {
    if (activeTab === 'chat') {
      chatKeyRef.current += 1;
      setChatKey(chatKeyRef.current);
    }
  }, [activeTab]);

  const handleTaskUpdate = useCallback(() => {
    fetchMyTasks();
  }, [fetchMyTasks]);

  const tabs = [
    { id: 'tasks', label: 'My Tasks', icon: FaTasks },
    { id: 'profile', label: 'Profile', icon: FaUser },
    { id: 'chat', label: 'Chat', icon: FaComments },
  ];

  if (loading) {
    return (
      <div className="dashboard loading-dashboard">
        <div className="loading-spinner">
          <FaSpinner className="spinner" />
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <nav className="dashboard-nav">
        <div className="nav-brand">
          <h2>Employee Dashboard</h2>
        </div>
        <div className="nav-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={'tab-btn ' + (activeTab === tab.id ? 'active' : '')}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
        <div className="nav-actions">
          <span className="user-info">
            Welcome, {profile?.name || user?.name || 'Employee'}
          </span>
          <button onClick={logout} className="logout-btn" title="Logout">
            <FaSignOutAlt />
          </button>
        </div>
      </nav>

      <div className="dashboard-content">
        {activeTab === 'tasks' && (
          <div className="tab-content">
            <div className="tab-header">
              <h3>My Tasks</h3>
              <span className="task-count">
                {taskLoading ? (
                  <FaSpinner className="spinner-small" />
                ) : (
                  tasks.length + ' tasks'
                )}
              </span>
            </div>
            <TaskList 
              employeeId={user?.employeeId}
              tasks={tasks}
              isEmployee={true}
              onTaskUpdate={handleTaskUpdate}
              loading={taskLoading}
            />
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="tab-content">
            <div className="tab-header">
              <h3>My Profile</h3>
            </div>
            <div className="profile-card">
              <div className="profile-avatar">
                <span>{profile?.name?.charAt(0)?.toUpperCase() || 'U'}</span>
              </div>
              <div className="profile-info">
                <div className="info-item">
                  <label>Name</label>
                  <span>{profile?.name || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <label>Email</label>
                  <span>{profile?.email || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <label>Phone</label>
                  <span>{profile?.phone || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <label>Role</label>
                  <span className={'role-badge ' + (profile?.role || 'employee')}>
                    {profile?.role || 'Employee'}
                  </span>
                </div>
                <div className="info-item">
                  <label>Department</label>
                  <span>{profile?.department || 'General'}</span>
                </div>
                {profile?.position && (
                  <div className="info-item">
                    <label>Position</label>
                    <span>{profile.position}</span>
                  </div>
                )}
                {profile?.hireDate && (
                  <div className="info-item">
                    <label>Hire Date</label>
                    <span>{new Date(profile.hireDate).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="tab-content">
            <div className="tab-header">
              <h3>Chat with Manager</h3>
            </div>
            <Chat 
              key={chatKey}
              employees={[]}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeDashboard;