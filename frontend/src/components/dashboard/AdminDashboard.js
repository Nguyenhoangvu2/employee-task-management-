import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import EmployeeList from './EmployeeList';
import EmployeeForm from './EmployeeForm';
import TaskList from './TaskList';
import TaskForm from './TaskForm';
import Chat from '../chat/Chat';
import { FaUsers, FaTasks, FaComments, FaSignOutAlt, FaPlus, FaSpinner } from 'react-icons/fa';
import api from '../../services/api';
import toast from 'react-hot-toast';
import './Dashboard.css';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('employees');
  const [employees, setEmployees] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [taskLoading, setTaskLoading] = useState(false);
  const [chatKey, setChatKey] = useState(0);
  const { user, logout } = useAuth();

  const fetchEmployees = useCallback(async () => {
    try {
      const response = await api.get('/employees');
      let data = [];
      if (Array.isArray(response.data)) {
        data = response.data;
      } else if (response.data?.employees && Array.isArray(response.data.employees)) {
        data = response.data.employees;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        data = response.data.data;
      }
      setEmployees(data);
    } catch (error) {
      console.error('Error fetching employees:', error);
      setEmployees([]);
      toast.error('Failed to fetch employees');
    }
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      setTaskLoading(true);
      const response = await api.get('/tasks');
      const data = Array.isArray(response.data) ? response.data : 
                   response.data?.tasks ? response.data.tasks : [];
      setTasks(data);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setTasks([]);
    } finally {
      setTaskLoading(false);
    }
  }, []);

  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([fetchEmployees(), fetchTasks()]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchEmployees, fetchTasks]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  useEffect(() => {
    if (activeTab === 'chat') {
      setChatKey(prev => prev + 1);
    }
  }, [activeTab]);

  const handleAddEmployee = () => {
    setEditingEmployee(null);
    setShowEmployeeForm(true);
  };

  const handleEditEmployee = (employee) => {
    setEditingEmployee(employee);
    setShowEmployeeForm(true);
  };

  const handleEmployeeFormClose = () => {
    setShowEmployeeForm(false);
    setEditingEmployee(null);
  };

  const handleEmployeeFormSubmit = async (employeeData) => {
    try {
      if (editingEmployee) {
        await api.put('/employees/' + editingEmployee.id, employeeData);
        toast.success('Employee updated successfully');
      } else {
        await api.post('/employees', employeeData);
        toast.success('Employee created successfully');
      }
      handleEmployeeFormClose();
      setTimeout(async () => {
        await fetchEmployees();
      }, 500);
    } catch (error) {
      console.error('Error saving employee:', error);
      toast.error(error.response?.data?.error || 'Failed to save employee');
    }
  };

  const handleDeleteEmployee = async (employeeId) => {
    if (window.confirm('Are you sure you want to delete this employee?')) {
      try {
        await api.delete('/employees/' + employeeId);
        toast.success('Employee deleted successfully');
        await fetchEmployees();
      } catch (error) {
        console.error('Error deleting employee:', error);
        toast.error('Failed to delete employee');
      }
    }
  };

  const handleAddTask = () => {
    setEditingTask(null);
    setShowTaskForm(true);
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    setShowTaskForm(true);
  };

  const handleTaskFormClose = () => {
    setShowTaskForm(false);
    setEditingTask(null);
  };

  const handleTaskFormSubmit = async (taskData) => {
    try {
      if (editingTask) {
        await api.put('/tasks/' + editingTask.id, taskData);
        toast.success('Task updated successfully');
      } else {
        await api.post('/tasks', taskData);
        toast.success('Task created successfully');
      }
      handleTaskFormClose();
      await fetchTasks();
    } catch (error) {
      console.error('Error saving task:', error);
      toast.error(error.response?.data?.error || 'Failed to save task');
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        await api.delete('/tasks/' + taskId);
        toast.success('Task deleted successfully');
        await fetchTasks();
      } catch (error) {
        console.error('Error deleting task:', error);
        toast.error('Failed to delete task');
      }
    }
  };

  const tabs = [
    { id: 'employees', label: 'Employees', icon: FaUsers, count: employees.length },
    { id: 'tasks', label: 'Tasks', icon: FaTasks, count: tasks.length },
    { id: 'chat', label: 'Chat', icon: FaComments },
  ];

  if (loading) {
    return (
      <div className="dashboard loading-dashboard">
        <div className="loading-spinner">
          <FaSpinner className="spinner" />
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <nav className="dashboard-nav">
        <div className="nav-brand">
          <h2>Admin Dashboard</h2>
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
              {tab.count !== undefined && (
                <span className="tab-badge">{tab.count}</span>
              )}
            </button>
          ))}
        </div>
        <div className="nav-actions">
          <span className="user-info">Welcome, {user?.phoneNumber || 'Admin'}</span>
          <button onClick={logout} className="logout-btn" title="Logout">
            <FaSignOutAlt />
          </button>
        </div>
      </nav>

      <div className="dashboard-content">
        {activeTab === 'employees' && (
          <div className="tab-content">
            <div className="tab-header">
              <h3>Employee Management</h3>
              <div className="tab-actions">
                <span className="item-count">{employees.length} employees</span>
                <button onClick={handleAddEmployee} className="btn-primary">
                  <FaPlus /> Add Employee
                </button>
              </div>
            </div>
            <EmployeeList
              employees={employees}
              onEdit={handleEditEmployee}
              onDelete={handleDeleteEmployee}
            />
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="tab-content">
            <div className="tab-header">
              <h3>Task Management</h3>
              <div className="tab-actions">
                <span className="item-count">{tasks.length} tasks</span>
                <button onClick={handleAddTask} className="btn-primary">
                  <FaPlus /> Create Task
                </button>
              </div>
            </div>
            <TaskList 
              tasks={tasks}
              employees={employees}
              onEdit={handleEditTask}
              onDelete={handleDeleteTask}
              onTaskUpdate={fetchTasks}
              loading={taskLoading}
            />
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="tab-content">
            <div className="tab-header">
              <h3>Real-time Chat</h3>
              <span className="item-count">{employees.filter(e => e.isActive !== false).length} online</span>
            </div>
            <Chat 
              key={chatKey}
              employees={employees}
            />
          </div>
        )}
      </div>

      {showEmployeeForm && (
        <EmployeeForm
          employee={editingEmployee}
          onSubmit={handleEmployeeFormSubmit}
          onClose={handleEmployeeFormClose}
        />
      )}

      {showTaskForm && (
        <TaskForm
          task={editingTask}
          employees={employees}
          onSubmit={handleTaskFormSubmit}
          onClose={handleTaskFormClose}
        />
      )}
    </div>
  );
};

export default AdminDashboard;