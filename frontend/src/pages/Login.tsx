import React, { useState } from 'react';
import { api, setStoredToken } from '../services/api';
import { Shield, Lock, Mail, ArrowRight, UserCheck, Eye, EyeOff, User } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (user: any, token: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.login(identifier, password);
      setStoredToken(res.token);
      onLoginSuccess(res.user, res.token);
    } catch (err: any) {
      setError(err.data?.message || err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (demoEmail: string, demoPass: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.login(demoEmail, demoPass);
      setStoredToken(res.token);
      onLoginSuccess(res.user, res.token);
    } catch (err: any) {
      setError(err.data?.message || err.message || 'Quick login failed');
    } finally {
      setLoading(false);
    }
  };

  const demoAccounts = [
    { label: 'Student (Rahul)', email: 'rahul.cse@college.edu', pass: 'Student@123', role: 'Roll: 24CS001 • CSE' },
    { label: 'Student (Priya)', email: 'priya.cse@college.edu', pass: 'Student@123', role: 'Roll: 24CS002 • CSE' },
    { label: 'Faculty 1 (Dr. Turing)', email: 'alan.turing@college.edu', pass: 'Faculty@123', role: 'CSE Chair & Instructor' },
    { label: 'Faculty 2 (Dr. Hopper)', email: 'grace.hopper@college.edu', pass: 'Faculty@123', role: 'Reassignment Successor' },
    { label: 'Academic Admin', email: 'academic.admin@college.edu', pass: 'Admin@123', role: 'Prof. John von Neumann' },
    { label: 'Exam Admin (CSE)', email: 'exam.admin.cse@college.edu', pass: 'Exam@123', role: 'Dr. Ada Lovelace (CSE)' },
    { label: 'Exam Admin (EEE)', email: 'exam.admin.eee@college.edu', pass: 'Exam@123', role: 'Dr. Nikola Tesla (EEE)' },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex bg-indigo-600 text-white p-3 rounded-2xl shadow-md mb-3">
          <Shield className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Apex Engineering College</h2>
        <p className="text-xs text-slate-500 mt-1">Enterprise Academic ERP Core • Institutional Gateway</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl border border-slate-200 sm:px-10">
          {error && (
            <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg p-3 font-semibold">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Roll Number / Institutional Credentials
              </label>
              <div className="relative">
                <User className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Roll Number (e.g. 24CS001) or Email"
                  className="w-full text-xs rounded-lg border border-slate-300 pl-9 pr-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Students enter roll number (e.g. 24CS001). Faculty/Admins enter institutional email.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-xs rounded-lg border border-slate-300 pl-9 pr-10 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg shadow-sm transition flex items-center justify-center disabled:opacity-50"
            >
              <span>{loading ? 'Authenticating with PostgreSQL Core...' : 'Sign In to Portal'}</span>
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </button>
          </form>

          {/* Quick Demo Logins */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              <UserCheck className="h-4 w-4 text-indigo-600" />
              <span>One-Click Role Authentication (Demo)</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => handleQuickLogin(acc.email, acc.pass)}
                  className="text-left border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 p-2 rounded-lg transition"
                >
                  <div className="text-[11px] font-bold text-slate-800">{acc.label}</div>
                  <div className="text-[9px] text-slate-400 truncate">{acc.role}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
