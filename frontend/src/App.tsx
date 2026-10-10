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
import { PortalLayout, NavItem } from './components/PortalLayout';
import { LayoutDashboard, Flame, Tag } from 'lucide-react';

export function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentView, setCurrentView] = useState<'ERP' | 'CAMPUS_HUB'>('ERP');
  const [loading, setLoading] = useState<boolean>(true);
  const [switchingRole, setSwitchingRole] = useState<boolean>(false);
  const [hubTab, setHubTab] = useState<'EVENTS' | 'LOST_FOUND'>('LOST_FOUND');

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
    const hubNavItems: NavItem[] = [
      { id: 'lost-found', label: 'Lost & Found Central', icon: Tag },
      { id: 'trending-events', label: 'Trending Events & Fests', icon: Flame },
      { id: 'return-erp', label: 'Return to Institutional ERP', icon: LayoutDashboard },
    ];

    const handleHubNavSelect = (id: string) => {
      if (id === 'return-erp') {
        setCurrentView('ERP');
      } else if (id === 'lost-found') {
        setHubTab('LOST_FOUND');
      } else if (id === 'trending-events') {
        setHubTab('EVENTS');
      }
    };

    return (
      <PortalLayout
        currentUser={currentUser}
        currentRoleTitle="Campus Hub Central"
        navItems={hubNavItems}
        activeNavId={hubTab === 'LOST_FOUND' ? 'lost-found' : 'trending-events'}
        onNavSelect={handleHubNavSelect}
        currentView="CAMPUS_HUB"
        onViewChange={setCurrentView}
        onLogout={handleLogout}
        onQuickSwitchUser={handleQuickSwitchUser}
        switchingRole={switchingRole}
      >
        <CampusHub currentUser={currentUser} initialTab={hubTab} embedded={true} />
      </PortalLayout>
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
