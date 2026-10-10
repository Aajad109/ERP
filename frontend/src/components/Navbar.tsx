import React from 'react';
import { Shield, UserCircle, LogOut, Compass, GraduationCap } from 'lucide-react';

interface NavbarProps {
  currentUser: any;
  currentView: 'ERP' | 'CAMPUS_HUB';
  onViewChange: (view: 'ERP' | 'CAMPUS_HUB') => void;
  onLogout: () => void;
  onSelectRole?: (email: string, pass: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  currentView,
  onViewChange,
  onLogout,
}) => {
  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ACADEMIC_ADMIN':
        return (
          <span className="bg-purple-100 text-purple-800 text-xs font-semibold px-2.5 py-0.5 rounded border border-purple-300">
            Academic Admin
          </span>
        );
      case 'EXAM_ADMIN':
        return (
          <span className="bg-rose-100 text-rose-800 text-xs font-semibold px-2.5 py-0.5 rounded border border-rose-300">
            Exam Admin ({currentUser?.examAdminDesignation?.department?.code || 'Designated'})
          </span>
        );
      case 'FACULTY':
        return (
          <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded border border-blue-300">
            Faculty
          </span>
        );
      case 'STUDENT':
        return (
          <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-0.5 rounded border border-emerald-300">
            Student
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo & Navigation Tabs */}
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onViewChange('ERP')}>
              <div className="bg-indigo-600 text-white p-2 rounded-lg">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <span className="text-lg font-bold text-slate-900 tracking-tight">Apex Engineering College</span>
                <span className="block text-xs text-slate-500 font-medium">Enterprise ERP & Campus Hub</span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="hidden md:flex items-center space-x-1.5 ml-4 pl-4 border-l border-slate-200">
              <button
                onClick={() => onViewChange('ERP')}
                className={`inline-flex items-center text-xs font-bold px-3 py-2 rounded-lg transition ${
                  currentView === 'ERP'
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <GraduationCap className="h-4 w-4 mr-1.5" />
                Academic ERP
              </button>

              <button
                onClick={() => onViewChange('CAMPUS_HUB')}
                className={`inline-flex items-center text-xs font-bold px-3 py-2 rounded-lg transition ${
                  currentView === 'CAMPUS_HUB'
                    ? 'bg-amber-50 text-amber-800 border border-amber-300'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Compass className="h-4 w-4 mr-1.5 text-amber-600" />
                <span>Campus Hub</span>
                <span className="ml-1.5 bg-amber-200 text-amber-900 text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
                  Phase 2
                </span>
              </button>
            </nav>
          </div>

          {/* User Profile & Actions */}
          <div className="flex items-center space-x-4">
            {currentUser && (
              <div className="flex items-center space-x-3 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                <UserCircle className="h-6 w-6 text-slate-400" />
                <div className="text-left">
                  <div className="text-sm font-semibold text-slate-800">{currentUser.name}</div>
                  <div className="flex items-center space-x-1.5 mt-0.5">
                    {getRoleBadge(currentUser.role)}
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={onLogout}
              className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-rose-600 bg-white border border-slate-200 hover:border-rose-200 px-3 py-1.5 rounded-lg transition"
            >
              <LogOut className="h-4 w-4 mr-1.5" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
