import { NavLink } from 'react-router-dom';
import { useVariable } from 'lux-react';
import { ConnectionBadge } from './ConnectionBadge';

const navItems = [
  { to: '/operator', label: 'Operator' },
  { to: '/settings', label: 'Settings' },
  { to: '/recipes', label: 'Recipes' },
  { to: '/alarms', label: 'Alarms' },
];

export function Sidebar() {
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
      </div>
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
