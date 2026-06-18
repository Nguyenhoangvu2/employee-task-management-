import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FaHome, FaTasks, FaUsers, FaComments, FaSignOutAlt, FaUser } from 'react-icons/fa';
import './Common.css';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = user?.role === 'manager' ? [
    { to: '/admin', label: 'Dashboard', icon: FaHome },
    { to: '/admin/employees', label: 'Employees', icon: FaUsers },
    { to: '/admin/tasks', label: 'Tasks', icon: FaTasks },
    { to: '/admin/chat', label: 'Chat', icon: FaComments },
  ] : [
    { to: '/employee', label: 'Dashboard', icon: FaHome },
    { to: '/employee/tasks', label: 'My Tasks', icon: FaTasks },
    { to: '/employee/chat', label: 'Chat', icon: FaComments },
  ];

  return (
    <nav className="navbar">
      <div className="nav-container">
        <div className="nav-brand">
          <Link to={user?.role === 'manager' ? '/admin' : '/employee'}>
            <h2>TaskManager</h2>
          </Link>
        </div>

        <div className="nav-menu">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="nav-link"
              activeClassName="active"
            >
              <item.icon />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>

        <div className="nav-right">
          <div className="user-profile">
            <FaUser className="user-icon" />
            <span className="user-name">{user?.name || user?.phoneNumber || 'User'}</span>
          </div>
          <button onClick={handleLogout} className="nav-logout-btn" title="Logout">
            <FaSignOutAlt />
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
