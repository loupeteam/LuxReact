import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useVariable } from 'lux-react';
import { ConnectionBadge } from './ConnectionBadge';
import { LoginModal } from './LoginModal';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/operator', label: 'Operator' },
  { to: '/settings', label: 'Settings' },
  { to: '/recipes', label: 'Recipes' },
  { to: '/alarms', label: 'Alarms' },
];

export function Sidebar() {
  const [showLogin, setShowLogin] = useState(false);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand">LuxReact</div>
        <div className="sidebar-sub">Demo HMI</div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `sidebar-link${isActive ? ' sidebar-link--active' : ''}`
            }
          >
            {item.label}
            {item.to === '/alarms' && <AlarmBadge />}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <ConnectionBadge />
        <UserWidget onRequestLogin={() => setShowLogin(true)} />
      </div>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </aside>
  );
}

function AlarmBadge() {
  const [anyActive] = useVariable<boolean>('HMIDemo.Alarms.AnyActive', {
    defaultValue: false,
  });
  if (!anyActive) return null;
  return <span className="nav-alarm-badge" />;
}

interface UserWidgetProps {
  onRequestLogin: () => void;
}

function UserWidget({ onRequestLogin }: UserWidgetProps) {
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <button className="btn btn--ghost btn--full sidebar-login-btn" onClick={onRequestLogin}>
        &#128100; Sign In
      </button>
    );
  }

  const initials = user
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');

  return (
    <div className="sidebar-user">
      <div className="user-avatar" aria-hidden="true">{initials}</div>
      <div className="user-info">
        <div className="user-name">{user}</div>
        <button className="user-logout" onClick={() => void logout()}>Sign out</button>
      </div>
    </div>
  );
}
