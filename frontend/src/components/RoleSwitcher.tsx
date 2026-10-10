import React from 'react';
import { UserCheck } from 'lucide-react';

interface RoleSwitcherProps {
  currentEmail?: string;
  onSelectUser: (email: string, password: string) => void;
  isLoading: boolean;
}

export const RoleSwitcher: React.FC<RoleSwitcherProps> = ({ currentEmail, onSelectUser, isLoading }) => {
  const demoAccounts = [
    {
      label: 'Student (Rahul)',
      role: 'STUDENT',
      email: 'rahul.cse@college.edu',
      pass: 'Student@123',
      sub: 'Roll: 24CS001 • Batch 24-28 A',
      color: 'border-emerald-200 hover:bg-emerald-50 text-emerald-800',
      activeColor: 'bg-emerald-100 border-emerald-400 font-bold',
    },
    {
      label: 'Student (Priya)',
      role: 'STUDENT',
      email: 'priya.cse@college.edu',
      pass: 'Student@123',
      sub: 'Roll: 24CS002 • IDOR Target',
      color: 'border-emerald-200 hover:bg-emerald-50 text-emerald-800',
      activeColor: 'bg-emerald-100 border-emerald-400 font-bold',
    },
    {
      label: 'Faculty 1 (Dr. Turing)',
      role: 'FACULTY',
      email: 'alan.turing@college.edu',
      pass: 'Faculty@123',
      sub: 'CSE Chair • Initial Instructor',
      color: 'border-blue-200 hover:bg-blue-50 text-blue-800',
      activeColor: 'bg-blue-100 border-blue-400 font-bold',
    },
    {
      label: 'Faculty 2 (Dr. Hopper)',
      role: 'FACULTY',
      email: 'grace.hopper@college.edu',
      pass: 'Faculty@123',
      sub: 'CSE • Reassignment Successor',
      color: 'border-blue-200 hover:bg-blue-50 text-blue-800',
      activeColor: 'bg-blue-100 border-blue-400 font-bold',
    },
    {
      label: 'Academic Admin',
      role: 'ACAD ADMIN',
      email: 'academic.admin@college.edu',
      pass: 'Admin@123',
      sub: 'Structure & Reassignment',
      color: 'border-purple-200 hover:bg-purple-50 text-purple-800',
      activeColor: 'bg-purple-100 border-purple-400 font-bold',
    },
    {
      label: 'Exam Admin (CSE)',
      role: 'EXAM ADMIN',
      email: 'exam.admin.cse@college.edu',
      pass: 'Exam@123',
      sub: 'Designated for CSE Branch',
      color: 'border-rose-200 hover:bg-rose-50 text-rose-800',
      activeColor: 'bg-rose-100 border-rose-400 font-bold',
    },
    {
      label: 'Exam Admin (EEE)',
      role: 'EXAM ADMIN',
      email: 'exam.admin.eee@college.edu',
      pass: 'Exam@123',
      sub: 'Wrong-Branch Isolation Test',
      color: 'border-amber-200 hover:bg-amber-50 text-amber-800',
      activeColor: 'bg-amber-100 border-amber-400 font-bold',
    },
  ];

  return (
    <div className="bg-white border-b border-slate-200 px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <UserCheck className="h-4 w-4 text-indigo-600" />
          <span>Quick Role Switcher (Round 2 Demo):</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {demoAccounts.map((acc) => {
            const isActive = currentEmail === acc.email;
            return (
              <button
                key={acc.email}
                disabled={isLoading}
                onClick={() => onSelectUser(acc.email, acc.pass)}
                className={`text-xs px-2.5 py-1 rounded-md border transition flex flex-col items-start ${
                  isActive ? acc.activeColor : acc.color
                } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span className="font-semibold">{acc.label}</span>
                <span className="text-[10px] opacity-75">{acc.sub}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
