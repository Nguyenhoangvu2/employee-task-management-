import React, { useState, useMemo, useCallback } from 'react';
import { FaEdit, FaTrash, FaEnvelope, FaPhone, FaBriefcase, FaSearch, FaUser } from 'react-icons/fa';
import './Dashboard.css';

const EmployeeList = ({ employees = [], onEdit, onDelete, loading = false }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('');

  const employeeArray = Array.isArray(employees) ? employees : [];

  const filteredEmployees = useMemo(() => {
    return employeeArray.filter(emp => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        emp?.name?.toLowerCase().includes(searchLower) ||
        emp?.email?.toLowerCase().includes(searchLower) ||
        emp?.department?.toLowerCase().includes(searchLower) ||
        emp?.phone?.includes(searchTerm);
      
      const matchesRole = !filterRole || emp?.role === filterRole;
      
      return matchesSearch && matchesRole;
    });
  }, [employeeArray, searchTerm, filterRole]);

  const getRoleBadge = useCallback((role) => {
    const colors = {
      admin: 'badge-danger',
      manager: 'badge-warning',
      developer: 'badge-info',
      designer: 'badge-success',
      tester: 'badge-primary',
      employee: 'badge-secondary',
      other: 'badge-secondary'
    };
    return colors[role] || 'badge-secondary';
  }, []);

  const getRoleIcon = useCallback((role) => {
    const icons = {
      admin: '',
      manager: '',
      developer: '',
      designer: '',
      tester: '',
      employee: '',
      other: ''
    };
    return icons[role] || '';
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearchTerm('');
    setFilterRole('');
  }, []);

  if (loading) {
    return (
      <div className="employee-list">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading employees...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="employee-list">
      <div className="list-filters">
        <div className="search-box">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search by name, email, department..."
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
              x
            </button>
          )}
        </div>
        <div className="filter-box">
          <select 
            value={filterRole} 
            onChange={(e) => setFilterRole(e.target.value)}
            className="filter-select"
          >
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="developer">Developer</option>
            <option value="designer">Designer</option>
            <option value="tester">Tester</option>
            <option value="employee">Employee</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="result-count">
          {filteredEmployees.length} {filteredEmployees.length === 1 ? 'employee' : 'employees'}
        </div>
      </div>

      {filteredEmployees.length === 0 ? (
        <div className="empty-state">
          <FaUser className="empty-icon" />
          <p>{searchTerm || filterRole ? 'No employees match your filters' : 'No employees found'}</p>
          {(searchTerm || filterRole) && (
            <button 
              className="clear-filters-btn"
              onClick={handleClearFilters}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="employee-grid">
          {filteredEmployees.map((employee) => (
            <div key={employee.id || employee._id} className="employee-card">
              <div className="employee-avatar">
                {employee?.name?.charAt(0)?.toUpperCase() || 'U'}
                <span className="role-icon">{getRoleIcon(employee?.role)}</span>
              </div>
              <div className="employee-info">
                <h4>{employee?.name || 'Unknown'}</h4>
                <div className="employee-details">
                  <span className="detail-item" title={employee?.email || 'No email'}>
                    <FaEnvelope /> {employee?.email || 'No email'}
                  </span>
                  {employee?.phone && (
                    <span className="detail-item" title={employee.phone}>
                      <FaPhone /> {employee.phone}
                    </span>
                  )}
                  <span className="detail-item">
                    <FaBriefcase /> {employee?.department || 'General'}
                  </span>
                </div>
                <div className="employee-meta">
                  <span className={'badge ' + getRoleBadge(employee?.role)}>
                    {getRoleIcon(employee?.role)} {employee?.role || 'Unknown'}
                  </span>
                  <div className="employee-status">
                    <span className={'status-dot ' + (employee?.isActive !== false ? 'active' : 'inactive')} />
                    {employee?.isActive !== false ? 'Active' : 'Inactive'}
                  </div>
                </div>
              </div>
              <div className="employee-actions">
                <button 
                  onClick={() => onEdit && onEdit(employee)}
                  className="action-btn edit-btn"
                  title="Edit employee"
                >
                  <FaEdit />
                </button>
                <button 
                  onClick={() => onDelete && onDelete(employee.id || employee._id)}
                  className="action-btn delete-btn"
                  title="Delete employee"
                >
                  <FaTrash />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmployeeList;