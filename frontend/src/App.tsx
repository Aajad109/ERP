import React, { useState, useEffect } from 'react';
import { api, getStoredToken, setStoredToken, clearStoredToken } from './services/api';
import { Navbar } from './components/Navbar';
import { RoleSwitcher } from './components/RoleSwitcher';
import { Login } from './pages/Login';
import { StudentDashboard } from './pages/StudentDashboard';
import { FacultyDashboard } from './pages/FacultyDashboard';
import { AcademicAdminDashboard } from './pages/AcademicAdminDashboard';
import { ExamAdminDashboard } from './pages/ExamAdminDashboard';
import { CampusHub } from './pages/CampusHub';

export function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentView, setCurrentView] = useState<'ERP' | 'CAMPUS_HUB'>('ERP');
  const [loading, setLoading] = useState<boolean>(true);
  const [switchingRole, setSwitchingRole] = useState<boolean>(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await api.getMe();
      setCurrentUser(res.user);
    } catch (err) {
      console.error('Session expired or invalid token:', err);
      clearStoredToken();
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = (user: any, token: string) => {
    setStoredToken(token);
    setCurrentUser(user);
    setCurrentView('ERP');
  };

  const handleLogout = () => {
    clearStoredToken();
    setCurrentUser(null);
  };

  const handleQuickSwitchUser = async (email: string, pass: string) => {
    try {
      setSwitchingRole(true);
      const res = await api.login(email, pass);
      setStoredToken(res.token);
      setCurrentUser(res.user);
    } catch (err: any) {
      console.error('Failed to switch user:', err);
      alert('Failed to switch demo account: ' + (err.message || 'Error'));
    } finally {
      setSwitchingRole(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-400"></div>
        <span className="mt-4 font-bold text-sm text-slate-300 tracking-wider">
          Connecting to PostgreSQL 18 &amp; Initializing Apex Institutional ERP...
        </span>
      </div>
    );
  }

  if (!currentUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  if (currentView === 'CAMPUS_HUB') {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">
        <Navbar
          currentUser={currentUser}
          currentView={currentView}
          onViewChange={setCurrentView}
          onLogout={handleLogout}
          onSelectRole={handleQuickSwitchUser}
        />
        <RoleSwitcher
          currentEmail={currentUser.email}
          onSelectUser={handleQuickSwitchUser}
          isLoading={switchingRole}
        />
        <main className="flex-1 py-6">
          <CampusHub currentUser={currentUser} />
        </main>
        <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-2">
            <span>Apex Engineering College • Shared Campus Hub</span>
            <span className="font-mono text-slate-400">Trending Events &amp; Multi-Image Lost &amp; Found</span>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <>
      {currentUser.role === 'STUDENT' && (
        <StudentDashboard
          currentUser={currentUser}
          onViewChange={setCurrentView}
          onLogout={handleLogout}
          onQuickSwitchUser={handleQuickSwitchUser}
          switchingRole={switchingRole}
        />
      )}
      {currentUser.role === 'FACULTY' && (
        <FacultyDashboard
          currentUser={currentUser}
          onViewChange={setCurrentView}
          onLogout={handleLogout}
          onQuickSwitchUser={handleQuickSwitchUser}
          switchingRole={switchingRole}
        />
      )}
      {currentUser.role === 'ACADEMIC_ADMIN' && (
        <AcademicAdminDashboard
          currentUser={currentUser}
          onViewChange={setCurrentView}
          onLogout={handleLogout}
          onQuickSwitchUser={handleQuickSwitchUser}
          switchingRole={switchingRole}
        />
      )}
      {currentUser.role === 'EXAM_ADMIN' && (
        <ExamAdminDashboard
          currentUser={currentUser}
          onViewChange={setCurrentView}
          onLogout={handleLogout}
          onQuickSwitchUser={handleQuickSwitchUser}
          switchingRole={switchingRole}
        />
      )}
    </>
  );
}

export default App;
