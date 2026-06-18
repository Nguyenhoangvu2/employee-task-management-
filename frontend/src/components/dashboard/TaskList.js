import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  FaCheck, 
  FaClock, 
  FaTrash, 
  FaEdit, 
  FaPlus, 
  FaSpinner, 
  FaSearch,
  FaTimes
} from 'react-icons/fa';
import api from '../../services/api';
import toast from 'react-hot-toast';
import './Dashboard.css';

const TaskList = ({ 
  employeeId, 
  tasks: propTasks = [], 
  employees = [],
  onTaskUpdate, 
  onEdit, 
  onDelete,
  isEmployee = false,
  loading: propLoading = false 
}) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assignedTo: employeeId || '',
    priority: 'medium',
    dueDate: ''
  });

  const employeeArray = Array.isArray(employees) ? employees : [];

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const url = employeeId ? '/tasks/employee/' + employeeId : '/tasks';
      const response = await api.get(url);
      
      let data = [];
      if (Array.isArray(response.data)) {
        data = response.data;
      } else if (response.data?.tasks && Array.isArray(response.data.tasks)) {
        data = response.data.tasks;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        data = response.data.data;
      }
      
      setTasks(data);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setTasks([]);
      if (error.response?.status !== 404) {
        toast.error('Failed to load tasks');
      }
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    if (propTasks && Array.isArray(propTasks) && propTasks.length > 0) {
      setTasks(propTasks);
      setLoading(false);
    } else if (propTasks && Array.isArray(propTasks)) {
      setTasks([]);
      setLoading(false);
    } else {
      fetchTasks();
    }
  }, [employeeId, propTasks, fetchTasks]);

  const filteredTasks = useMemo(() => {
    const taskArray = Array.isArray(tasks) ? tasks : [];
    
    let result = taskArray;
    
    if (filter !== 'all') {
      result = result.filter(task => task?.status === filter);
    }
    
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(task => 
        task?.title?.toLowerCase().includes(term) ||
        task?.description?.toLowerCase().includes(term) ||
        task?.assignedTo?.toLowerCase().includes(term) ||
        task?.id?.toLowerCase().includes(term)
      );
    }
    
    return result;
  }, [tasks, filter, searchTerm]);

  const handleStatusUpdate = useCallback(async (taskId, status) => {
    try {
      await api.patch('/tasks/' + taskId + '/status', { status });
      toast.success('Task marked as ' + status);
      await fetchTasks();
      if (onTaskUpdate) onTaskUpdate();
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error(error.response?.data?.error || 'Failed to update task');
    }
  }, [fetchTasks, onTaskUpdate]);

  const handleDelete = useCallback(async (taskId) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        await api.delete('/tasks/' + taskId);
        toast.success('Task deleted successfully');
        await fetchTasks();
        if (onTaskUpdate) onTaskUpdate();
        if (onDelete) onDelete(taskId);
      } catch (error) {
        console.error('Error deleting task:', error);
        toast.error(error.response?.data?.error || 'Failed to delete task');
      }
    }
  }, [fetchTasks, onTaskUpdate, onDelete]);

  const handleCreate = useCallback(async (e) => {
    e.preventDefault();
    if (!newTask.title || !newTask.assignedTo) {
      toast.error('Title and assignment are required');
      return;
    }

    try {
      await api.post('/tasks', newTask);
      toast.success('Task created successfully');
      setNewTask({ 
        title: '', 
        description: '', 
        assignedTo: employeeId || '', 
        priority: 'medium', 
        dueDate: '' 
      });
      setShowCreate(false);
      await fetchTasks();
      if (onTaskUpdate) onTaskUpdate();
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error(error.response?.data?.error || 'Failed to create task');
    }
  }, [newTask, employeeId, fetchTasks, onTaskUpdate]);

  const handleClearFilters = useCallback(() => {
    setSearchTerm('');
    setFilter('all');
  }, []);

  const getPriorityColor = useCallback((priority) => {
    const colors = {
      low: 'priority-low',
      medium: 'priority-medium',
      high: 'priority-high',
      urgent: 'priority-urgent'
    };
    return colors[priority] || 'priority-medium';
  }, []);

  const getPriorityLabel = useCallback((priority) => {
    const labels = {
      low: 'Low',
      medium: 'Medium',
      high: 'High',
      urgent: 'Urgent'
    };
    return labels[priority] || 'Medium';
  }, []);

  const getStatusBadge = useCallback((status) => {
    const badges = {
      pending: 'badge-warning',
      'in-progress': 'badge-info',
      completed: 'badge-success',
      cancelled: 'badge-danger'
    };
    return badges[status] || 'badge-secondary';
  }, []);

  const getStatusLabel = useCallback((status) => {
    const labels = {
      pending: 'Pending',
      'in-progress': 'In Progress',
      completed: 'Completed',
      cancelled: 'Cancelled'
    };
    return labels[status] || status || 'Unknown';
  }, []);

  const getStatusCount = useCallback((status) => {
    const taskArray = Array.isArray(tasks) ? tasks : [];
    if (status === 'all') return taskArray.length;
    return taskArray.filter(t => t?.status === status).length;
  }, [tasks]);

  if (loading || propLoading) {
    return (
      <div className="task-list loading-state">
        <FaSpinner className="spinner" />
        <p>Loading tasks...</p>
      </div>
    );
  }

  return (
    <div className="task-list">
      <div className="list-filters">
        <div className="search-box">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search tasks by title, description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          {searchTerm && (
            <button 
              className="clear-search"
              onClick={() => setSearchTerm('')}
              title="Clear search"
            >
              <FaTimes />
            </button>
          )}
        </div>
        
        <div className="filter-group">
          <button 
            className={'filter-btn ' + (filter === 'all' ? 'active' : '')}
            onClick={() => setFilter('all')}
          >
            All (' + getStatusCount('all') + ')
          </button>
          <button 
            className={'filter-btn ' + (filter === 'pending' ? 'active' : '')}
            onClick={() => setFilter('pending')}
          >
            Pending (' + getStatusCount('pending') + ')
          </button>
          <button 
            className={'filter-btn ' + (filter === 'in-progress' ? 'active' : '')}
            onClick={() => setFilter('in-progress')}
          >
            In Progress (' + getStatusCount('in-progress') + ')
          </button>
          <button 
            className={'filter-btn ' + (filter === 'completed' ? 'active' : '')}
            onClick={() => setFilter('completed')}
          >
            Completed (' + getStatusCount('completed') + ')
          </button>
        </div>
        
        {!isEmployee && (
          <button 
            onClick={() => setShowCreate(!showCreate)} 
            className="btn-primary"
            title="Create new task"
          >
            <FaPlus /> New Task
          </button>
        )}
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="create-task-form">
          <div className="form-row">
            <div className="form-group">
              <label>Task Title <span className="required">*</span></label>
              <input
                type="text"
                placeholder="Enter task title"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Assign To <span className="required">*</span></label>
              <select
                value={newTask.assignedTo}
                onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })}
                required
              >
                <option value="">Select employee...</option>
                {employeeArray.length > 0 ? (
                  employeeArray.map(emp => (
                    <option key={emp.id || emp._id} value={emp.id || emp._id}>
                      {emp.name} ({emp.email})
                    </option>
                  ))
                ) : (
                  <option value="" disabled>No employees available</option>
                )}
              </select>
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Description</label>
              <input
                type="text"
                placeholder="Task description"
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Priority</label>
              <select
                value={newTask.priority}
                onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Due Date</label>
              <input
                type="date"
                value={newTask.dueDate}
                onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="form-actions" style={{ justifyContent: 'flex-end', marginTop: 0 }}>
              <button 
                type="button" 
                onClick={() => setShowCreate(false)} 
                className="btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                <FaPlus /> Create Task
              </button>
            </div>
          </div>
        </form>
      )}

      {filteredTasks.length > 0 && (
        <div className="result-count">
          <span>Showing ' + filteredTasks.length + ' of ' + tasks.length + ' tasks</span>
          {(searchTerm || filter !== 'all') && (
            <button 
              className="clear-filters-btn small"
              onClick={handleClearFilters}
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {filteredTasks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"></div>
          <h3>{searchTerm ? 'No tasks match your search' : filter !== 'all' ? 'No ' + filter + ' tasks' : 'No tasks found'}</h3>
          <p>
            {searchTerm ? 'Try adjusting your search term' : 
             filter !== 'all' ? 'Try changing the filter' : 
             'Get started by creating your first task'}
          </p>
          {(searchTerm || filter !== 'all') && (
            <button 
              className="clear-filters-btn"
              onClick={handleClearFilters}
            >
              Clear all filters
            </button>
          )}
          {!isEmployee && !searchTerm && filter === 'all' && (
            <button 
              onClick={() => setShowCreate(true)} 
              className="btn-primary"
              style={{ marginTop: '16px' }}
            >
              <FaPlus /> Create your first task
            </button>
          )}
        </div>
      ) : (
        <div className="task-grid">
          {filteredTasks.map((task) => (
            <div 
              key={task?.id || task?._id} 
              className={'task-card ' + (task?.status === 'completed' ? 'completed-task' : '')}
            >
              <div className="task-header">
                <h4 title={task?.title}>{task?.title || 'Untitled'}</h4>
                <span className={'badge ' + getPriorityColor(task?.priority)}>
                  {getPriorityLabel(task?.priority)}
                </span>
              </div>
              
              <p className="task-description">
                {task?.description || 'No description'}
              </p>
              
              <div className="task-meta">
                <span className={'badge ' + getStatusBadge(task?.status)}>
                  {getStatusLabel(task?.status)}
                </span>
                {task?.dueDate && (
                  <span className={'task-due ' + (new Date(task.dueDate) < new Date() && task?.status !== 'completed' ? 'overdue' : '')}>
                    <FaClock /> {new Date(task.dueDate).toLocaleDateString()}
                    {new Date(task.dueDate) < new Date() && task?.status !== 'completed' && ' Overdue'}
                  </span>
                )}
                {task?.assignedTo && (
                  <span className="task-assigned">
                    {task?.assignedTo?.name || task?.assignedTo || 'Unassigned'}
                  </span>
                )}
              </div>

              <div className="task-actions">
                {task?.status !== 'completed' && task?.status !== 'cancelled' && (
                  <>
                    <button 
                      onClick={() => handleStatusUpdate(task.id || task._id, 'in-progress')}
                      className="action-btn start-btn"
                      title="Start task"
                    >
                      Start
                    </button>
                    <button 
                      onClick={() => handleStatusUpdate(task.id || task._id, 'completed')}
                      className="action-btn complete-btn"
                      title="Complete task"
                    >
                      <FaCheck /> Complete
                    </button>
                  </>
                )}
                {!isEmployee && (
                  <>
                    <button 
                      onClick={() => onEdit && onEdit(task)}
                      className="action-btn edit-btn"
                      title="Edit task"
                    >
                      <FaEdit />
                    </button>
                    <button 
                      onClick={() => handleDelete(task.id || task._id)}
                      className="action-btn delete-btn"
                      title="Delete task"
                    >
                      <FaTrash />
                    </button>
                  </>
                )}
                {isEmployee && task?.status === 'completed' && (
                  <span className="completed-badge">Done</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TaskList;