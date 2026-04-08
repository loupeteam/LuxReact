import { Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { OperatorPage } from './pages/OperatorPage';
import { SettingsPage } from './pages/SettingsPage';
import { RecipePage } from './pages/RecipePage';
import { AlarmPage } from './pages/AlarmPage';
import { AuthProvider } from './context/AuthContext';
import './App.css';

export function App() {
  return (
    <AuthProvider>
      <div className="app">
        <Sidebar />
        <main className="app-content">
          <Routes>
            <Route path="/" element={<Navigate to="/operator" replace />} />
            <Route path="/operator" element={<OperatorPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/recipes" element={<RecipePage />} />
            <Route path="/alarms" element={<AlarmPage />} />
          </Routes>
        </main>
      </div>
    </AuthProvider>
  );
}
