import React, { useState } from 'react';
import {
  Shield,
  UserCircle,
  LogOut,
  Compass,
  GraduationCap,
  Menu,
  X,
  ChevronRight,
  Bell,
  Building2,
  Users,
  BookOpen,
  Calendar,
  ClipboardList,
  FileText,
  Award,
  AlertTriangle,
  History,
  Settings,
  Flame,
  Search,
  CheckCircle,
  HelpCircle,
  Layers,
  FileCheck,
  Lock,
  ArrowRightLeft,
  Briefcase
} from 'lucide-react';
import { RoleSwitcher } from './RoleSwitcher';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: string | number;
}

interface PortalLayoutProps {
  currentUser: any;
  currentRoleTitle: string;
  navItems: NavItem[];
  activeNavId: string;
  onNavSelect: (id: string) => void;
  currentView: 'ERP' | 'CAMPUS_HUB';
  onViewChange: (view: 'ERP' | 'CAMPUS_HUB') => void;
  onLogout: () => void;
  onQuickSwitchUser: (email: string, pass: string) => void;
  switchingRole: boolean;
  breadcrumbs?: string[];
  children: React.ReactNode;
}

export const PortalLayout: React.FC<PortalLayoutProps> = ({
  currentUser,
  currentRoleTitle,
  navItems,
  activeNavId,
  onNavSelect,
  currentView,
  onViewChange,
  onLogout,
  onQuickSwitchUser,
  switchingRole,
  breadcrumbs = [],
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeItem = navItems.find((item) => item.id === activeNavId);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ACADEMIC_ADMIN':
        return <span className="bg-purple-100 text-purple-800 text-[11px] font-semibold px-2 py-0.5 rounded border border-purple-200">Academic Admin</span>;
      case 'EXAM_ADMIN':
        return <span className="bg-rose-100 text-rose-800 text-[11px] font-semibold px-2 py-0.5 rounded border border-rose-200">Exam Admin ({currentUser?.examAdminDesignation?.department?.code || 'CSE'})</span>;
      case 'FACULTY':
        return <span className="bg-blue-100 text-blue-800 text-[11px] font-semibold px-2 py-0.5 rounded border border-blue-200">Faculty</span>;
      case 'STUDENT':
        return <span className="bg-emerald-100 text-emerald-800 text-[11px] font-semibold px-2 py-0.5 rounded border border-emerald-200">Student ({currentUser?.studentProfile?.rollNumber || '24CS001'})</span>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">
      {/* Top Application Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Left: Mobile Toggle + Logo */}
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>

              <div
                className="flex items-center space-x-3 cursor-pointer"
                onClick={() => {
                  onViewChange('ERP');
                  onNavSelect(navItems[0]?.id || 'dashboard');
                }}
              >
                <div className="bg-indigo-600 text-white p-2 rounded-lg shadow-sm">
                  <Shield className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                    Apex Engineering College
                  </span>
                  <span className="block text-[11px] text-slate-500 font-medium">
                    Institutional ERP System • {currentRoleTitle}
                  </span>
                </div>
              </div>

              {/* View Switcher: Academic ERP vs Campus Hub */}
              <div className="hidden md:flex items-center space-x-2 ml-6 pl-6 border-l border-slate-200">
                <button
                  onClick={() => onViewChange('ERP')}
                  className={`inline-flex items-center text-xs font-bold px-3 py-1.5 rounded-lg transition ${
                    currentView === 'ERP'
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <GraduationCap className="h-4 w-4 mr-1.5" />
                  Academic ERP
                </button>

                <button
                  onClick={() => onViewChange('CAMPUS_HUB')}
                  className={`inline-flex items-center text-xs font-bold px-3 py-1.5 rounded-lg transition ${
                    currentView === 'CAMPUS_HUB'
                      ? 'bg-amber-50 text-amber-900 border border-amber-300 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Compass className="h-4 w-4 mr-1.5 text-amber-600" />
                  <span>Campus Hub</span>
                  <span className="ml-1.5 bg-amber-200 text-amber-950 text-[10px] font-black px-1.5 py-0.5 rounded-full">
                    Live
                  </span>
                </button>
              </div>
            </div>

            {/* Right: User Profile & Actions */}
            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex items-center space-x-3 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                <UserCircle className="h-6 w-6 text-slate-400" />
                <div className="text-left">
                  <div className="text-xs font-bold text-slate-800">{currentUser.name}</div>
                  <div className="flex items-center space-x-1.5 mt-0.5">{getRoleBadge(currentUser.role)}</div>
                </div>
              </div>

              <button
                onClick={onLogout}
                className="inline-flex items-center text-xs font-semibold text-slate-600 hover:text-rose-600 bg-white border border-slate-200 hover:border-rose-300 px-3 py-1.5 rounded-lg transition shadow-sm"
              >
                <LogOut className="h-4 w-4 mr-1.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Role Switcher Bar */}
        <RoleSwitcher
          currentEmail={currentUser.email}
          onSelectUser={onQuickSwitchUser}
          isLoading={switchingRole}
        />

        {/* Breadcrumb Bar */}
        <div className="bg-slate-50/80 border-t border-slate-200 px-4 sm:px-6 lg:px-8 py-2 flex items-center text-xs text-slate-500 font-medium overflow-x-auto">
          <span>Apex ERP</span>
          <ChevronRight className="h-3.5 w-3.5 mx-1.5 text-slate-400 shrink-0" />
          <span className="text-slate-700 font-semibold">{currentRoleTitle}</span>
          {breadcrumbs.map((b, i) => (
            <React.Fragment key={i}>
              <ChevronRight className="h-3.5 w-3.5 mx-1.5 text-slate-400 shrink-0" />
              <span className={i === breadcrumbs.length - 1 ? 'text-indigo-600 font-bold' : 'text-slate-700'}>{b}</span>
            </React.Fragment>
          ))}
          {activeItem && !breadcrumbs.length && (
            <>
              <ChevronRight className="h-3.5 w-3.5 mx-1.5 text-slate-400 shrink-0" />
              <span className="text-indigo-600 font-bold">{activeItem.label}</span>
            </>
          )}
        </div>
      </header>

      {/* Main Body Layout: Left Sidebar + Full-Length Content */}
      <div className="flex-1 flex w-full">
        {/* Persistent Left Navigation Sidebar (Desktop) */}
        <aside className="hidden lg:flex flex-col w-64 bg-slate-900 text-slate-200 border-r border-slate-800 shrink-0 select-none">
          <div className="p-4 border-b border-slate-800">
            <div className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">
              {currentRoleTitle} Navigation
            </div>
          </div>

          <nav className="flex-1 p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-140px)]">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeNavId === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavSelect(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md font-bold'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <div className="flex items-center space-x-3 truncate">
                    <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
                        isActive ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer info */}
          <div className="p-3 border-t border-slate-800 text-[10px] text-slate-400 bg-slate-950/60">
            <div className="font-semibold text-slate-300">Apex College ERP v2.4</div>
            <div>PostgreSQL 18 • OCC Guarded</div>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div className="fixed inset-0 bg-slate-900/60" onClick={() => setMobileMenuOpen(false)} />
            <div className="relative flex-1 flex flex-col max-w-xs w-full bg-slate-900 text-slate-200 z-10">
              <div className="p-4 flex items-center justify-between border-b border-slate-800">
                <span className="text-sm font-bold text-white">{currentRoleTitle} Menu</span>
                <button onClick={() => setMobileMenuOpen(false)} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeNavId === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onNavSelect(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold ${
                        isActive ? 'bg-indigo-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </div>
                      {item.badge !== undefined && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        )}

        {/* Main Content Area Occupying Remaining Width */}
        <main className="flex-1 w-full min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Global Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <div className="w-full px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>Apex Engineering College ERP • Academic Governance & Examination Platform</span>
          <span className="font-mono text-slate-400">PostgreSQL 18 • Express Service Monolith • React 18</span>
        </div>
      </footer>
    </div>
  );
};
