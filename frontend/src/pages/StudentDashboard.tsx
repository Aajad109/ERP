import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { PortalLayout, NavItem } from '../components/PortalLayout';
import { CampusHub } from './CampusHub';
import {
  LayoutDashboard,
  User,
  BookOpen,
  Calendar,
  ClipboardList,
  FileText,
  Award,
  TrendingUp,
  AlertTriangle,
  RotateCcw,
  Bell,
  Flame,
  Search,
  Settings,
  LogOut,
  CheckCircle,
  AlertCircle,
  Clock,
  ShieldAlert,
  Send,
  Lock,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';

interface StudentDashboardProps {
  currentUser: any;
  onViewChange?: (view: 'ERP' | 'CAMPUS_HUB') => void;
  onLogout?: () => void;
  onQuickSwitchUser?: (email: string, pass: string) => void;
  switchingRole?: boolean;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  currentUser,
  onViewChange = () => {},
  onLogout = () => {},
  onQuickSwitchUser = () => {},
  switchingRole = false,
}) => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [resultsData, setResultsData] = useState<any>(null);
  const [attendanceData, setAttendanceData] = useState<any>(null);
  const [marksData, setMarksData] = useState<any[]>([]);
  const [timetableData, setTimetableData] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [revaluationRequests, setRevaluationRequests] = useState<any[]>([]);
  const [correctionRequests, setCorrectionRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Correction Request Modal
  const [selectedResult, setSelectedResult] = useState<any>(null);
  const [correctionReason, setCorrectionReason] = useState<string>('');
  const [requestedMarks, setRequestedMarks] = useState<string>('');
  const [submittingReq, setSubmittingReq] = useState<boolean>(false);
  const [requestMsg, setRequestMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Revaluation Request Modal
  const [selectedResultForReval, setSelectedResultForReval] = useState<any>(null);
  const [revalReason, setRevalReason] = useState<string>('');
  const [submittingReval, setSubmittingReval] = useState<boolean>(false);
  const [revalMsg, setRevalMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Universal Grievance Submission Modal (Internal Faculty vs External Exam Admin)
  const [showNewGrievanceModal, setShowNewGrievanceModal] = useState<boolean>(false);
  const [grievanceCourseResultId, setGrievanceCourseResultId] = useState<string>('');
  const [grievanceChannel, setGrievanceChannel] = useState<'INTERNAL_FACULTY' | 'EXTERNAL_EXAM_ADMIN'>('INTERNAL_FACULTY');
  const [universalReason, setUniversalReason] = useState<string>('');
  const [universalRequestedMarks, setUniversalRequestedMarks] = useState<string>('');
  const [submittingUniversalGrievance, setSubmittingUniversalGrievance] = useState<boolean>(false);
  const [universalFeedback, setUniversalFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const studentProfileId = currentUser?.studentProfile?.id;

  useEffect(() => {
    loadAllStudentData();
  }, [currentUser]);

  const loadAllStudentData = async () => {
    if (!studentProfileId) return;
    try {
      setLoading(true);
      const [resRes, attRes, marksRes, timeRes, annRes, revalRes, corrRes] = await Promise.all([
        api.getStudentResults(studentProfileId).catch(() => ({ results: [], student: null })),
        api.getStudentAttendance(studentProfileId).catch(() => ({ overallPercentage: 85, subjectBreakdown: [] })),
        api.getStudentMarks(studentProfileId).catch(() => ({ courses: [] })),
        api.getTimetable().catch(() => ({ slots: [] })),
        api.getAnnouncements().catch(() => ({ announcements: [] })),
        api.getRevaluationRequests().catch(() => ({ requests: [] })),
        api.getCorrectionRequests().catch(() => ({ requests: [] })),
      ]);

      setResultsData(resRes);
      setAttendanceData(attRes);
      setMarksData(marksRes.courses || []);
      setTimetableData(timeRes.slots || []);
      setAnnouncements(annRes.announcements || []);
      setRevaluationRequests(revalRes.requests || []);
      setCorrectionRequests(corrRes.requests || []);
    } catch (err) {
      console.error('Failed to load student data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResult) return;
    try {
      setSubmittingReq(true);
      setRequestMsg(null);
      await api.requestCorrection(
        selectedResult.id,
        correctionReason,
        requestedMarks ? Number(requestedMarks) : undefined
      );
      setRequestMsg({
        type: 'success',
        text: 'Correction request submitted successfully! It has been routed to the assigned faculty for review.',
      });
      setCorrectionReason('');
      setRequestedMarks('');
      loadAllStudentData();
    } catch (err: any) {
      setRequestMsg({ type: 'error', text: err.data?.message || err.message });
    } finally {
      setSubmittingReq(false);
    }
  };

  const handleApplyRevaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResultForReval) return;
    try {
      setSubmittingReval(true);
      setRevalMsg(null);
      await api.applyRevaluation(selectedResultForReval.id, revalReason);
      setRevalMsg({
        type: 'success',
        text: 'Revaluation application officially registered with Examination Branch.',
      });
      setRevalReason('');
      loadAllStudentData();
    } catch (err: any) {
      setRevalMsg({ type: 'error', text: err.data?.message || err.message });
    } finally {
      setSubmittingReval(false);
    }
  };

  const handleUniversalGrievanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grievanceCourseResultId) return;

    try {
      setSubmittingUniversalGrievance(true);
      setUniversalFeedback(null);

      if (grievanceChannel === 'INTERNAL_FACULTY') {
        await api.requestCorrection(
          grievanceCourseResultId,
          universalReason,
          universalRequestedMarks ? Number(universalRequestedMarks) : undefined
        );
        setUniversalFeedback({
          type: 'success',
          text: 'Internal marks grievance submitted directly to course faculty! Your instructor has direct authority to resolve and update internal marks without Exam Admin intervention.',
        });
      } else {
        await api.applyRevaluation(grievanceCourseResultId, universalReason);
        setUniversalFeedback({
          type: 'success',
          text: 'External examination grievance submitted to Examination Admin! Registered for statutory revaluation review.',
        });
      }

      setUniversalReason('');
      setUniversalRequestedMarks('');
      loadAllStudentData();
    } catch (err: any) {
      setUniversalFeedback({ type: 'error', text: err.data?.message || err.message });
    } finally {
      setSubmittingUniversalGrievance(false);
    }
  };

  const student = resultsData?.student || currentUser?.studentProfile;
  const results = resultsData?.results || [];
  const cgpaEvaluation = resultsData?.cgpaEvaluation;

  // Chart Data: Academic Performance
  const performanceChartData = results.map((r: any) => ({
    name: r.offering?.course?.code || 'Course',
    totalMarks: r.totalMarks,
    internalMarks: r.internalMarks,
    externalMarks: r.externalMarks,
    gradePoint: r.gradePoint,
  }));

  // Sidebar Items strictly matching prompt Section 6
  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'profile', label: 'My Profile', icon: User },
    { id: 'courses', label: 'My Courses', icon: BookOpen },
    { id: 'timetable', label: 'My Timetable', icon: Calendar },
    { id: 'attendance', label: 'Attendance', icon: ClipboardList, badge: `${attendanceData?.overallPercentage || 0}%` },
    { id: 'internal-marks', label: 'Internal Marks', icon: FileText },
    { id: 'results', label: 'Examination Results', icon: Award },
    { id: 'performance', label: 'Academic Performance', icon: TrendingUp },
    { id: 'revaluation', label: 'Revaluation', icon: RotateCcw, badge: revaluationRequests.length || undefined },
    { id: 'announcements', label: 'Announcements', icon: Bell, badge: announcements.length || undefined },
    { id: 'trending-events', label: 'Trending Events', icon: Flame },
    { id: 'lost-found', label: 'Lost & Found', icon: Search },
  ];

  const handleNavSelect = (id: string) => {
    setActiveTab(id);
  };

  return (
    <PortalLayout
      currentUser={currentUser}
      currentRoleTitle="Student Portal"
      navItems={navItems}
      activeNavId={activeTab}
      onNavSelect={handleNavSelect}
      currentView="ERP"
      onViewChange={onViewChange}
      onLogout={onLogout}
      onQuickSwitchUser={onQuickSwitchUser}
      switchingRole={switchingRole}
    >
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span className="ml-3 text-sm font-semibold text-slate-600">Loading academic records...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Welcome Header */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-xl shadow-md p-6 border border-slate-800">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                    Enrolled Student
                  </span>
                  <span className="text-xs text-slate-400 font-mono">Roll: {student?.rollNumber || '24CS001'}</span>
                </div>
                <h1 className="text-2xl font-black mt-1 text-white">{currentUser.name}</h1>
                <p className="text-xs text-slate-300 mt-1">
                  Department of {student?.department?.name || 'Computer Science and Engineering'} • Batch {student?.batch?.name || '2024-2028'} • Section {student?.section?.name || 'A'} • Semester {student?.currentSemester || 5}
                </p>
              </div>

              {/* Status Badges */}
              <div className="flex flex-wrap gap-2">
                <div className="bg-white/10 backdrop-blur px-3 py-2 rounded-lg border border-white/10 text-right">
                  <div className="text-[10px] uppercase font-bold text-slate-300">Overall Attendance</div>
                  <div className={`text-lg font-black ${attendanceData?.overallShortage ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {attendanceData?.overallPercentage}%
                  </div>
                </div>

                <div className="bg-white/10 backdrop-blur px-3 py-2 rounded-lg border border-white/10 text-right">
                  <div className="text-[10px] uppercase font-bold text-slate-300">CGPA Status</div>
                  <div className="text-lg font-black text-amber-300">
                    {cgpaEvaluation?.cgpaStatus === 'OFFICIAL' ? `${cgpaEvaluation.cgpa} / 10.0` : 'Withheld'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* TAB: DASHBOARD (Full-length overview) */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* KPI Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Registered Courses</div>
                      <div className="text-2xl font-black text-slate-900 mt-1">{marksData.length || results.length || 1}</div>
                      <div className="text-xs text-indigo-600 font-semibold mt-1">Total Credits: {results.reduce((acc: number, r: any) => acc + (r.offering?.course?.credits || 4), 0)}</div>
                    </div>
                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
                      <BookOpen className="h-5 w-5" />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Attendance Status</div>
                      <div className={`text-2xl font-black mt-1 ${attendanceData?.overallShortage ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {attendanceData?.overallPercentage}%
                      </div>
                      <div className="text-xs text-slate-500 font-medium mt-1">
                        {attendanceData?.overallShortage ? (
                          <span className="text-rose-600 font-bold flex items-center gap-1">
                            <AlertCircle className="h-3.5 w-3.5" /> Attendance Shortage (&lt;75%)
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-bold flex items-center gap-1">
                            <CheckCircle className="h-3.5 w-3.5" /> Good Standing
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
                      <ClipboardList className="h-5 w-5" />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Current SGPA</div>
                      <div className="text-2xl font-black text-slate-900 mt-1">{results[0]?.sgpa || '8.50'}</div>
                      <div className="text-xs text-slate-500 mt-1">Semester 5 Examination</div>
                    </div>
                    <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
                      <Award className="h-5 w-5" />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Revaluations</div>
                      <div className="text-2xl font-black text-slate-900 mt-1">
                        {revaluationRequests.length}
                      </div>
                      <div className="text-xs text-indigo-600 font-semibold mt-1">Applications Tracked</div>
                    </div>
                    <div className="p-2.5 bg-purple-50 text-purple-600 rounded-lg">
                      <RotateCcw className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Attendance Analytics & Visual Performance */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Visual Marks & Grade Chart */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-indigo-600" />
                      Academic Performance Overview
                    </h3>
                    <span className="text-xs font-semibold text-slate-500">Internal vs External</span>
                  </div>
                  <div className="h-64 mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={performanceChartData.length ? performanceChartData : [{ name: 'CS301', internalMarks: 36, externalMarks: 56, totalMarks: 92 }]}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                        <YAxis stroke="#64748b" fontSize={12} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="internalMarks" name="Internal (/40)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="externalMarks" name="External (/60)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="totalMarks" name="Total (/100)" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Subject-Wise Attendance Breakdown */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <ClipboardList className="h-5 w-5 text-emerald-600" />
                      Subject Attendance Analytics
                    </h3>
                    <span className="text-xs text-slate-500 font-semibold">Min Threshold: 75%</span>
                  </div>

                  <div className="mt-4 space-y-4">
                    {attendanceData?.subjectBreakdown?.length > 0 ? (
                      attendanceData.subjectBreakdown.map((subj: any) => (
                        <div key={subj.offeringId} className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-800">
                              {subj.courseCode} — {subj.courseTitle}
                            </span>
                            <span className={`font-black ${subj.isShortage ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {subj.percentage}% ({subj.attendedCount}/{subj.totalSessions} sessions)
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                            <div
                              className={`h-2.5 rounded-full transition-all ${
                                subj.isShortage ? 'bg-rose-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(subj.percentage, 100)}%` }}
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-800">CS301 — Operating Systems &amp; Concurrency</span>
                          <span className="font-black text-emerald-600">85.0% (17/20 sessions)</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                          <div className="h-2.5 rounded-full bg-emerald-500" style={{ width: '85%' }} />
                        </div>
                      </div>
                    )}

                    {attendanceData?.overallShortage && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2 mt-4">
                        <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">Attendance Shortage Advisory:</span> Your attendance is below the institutional 75% minimum requirement. Please coordinate with course faculty for attendance regularization.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Published Examination Results Table */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Award className="h-5 w-5 text-indigo-600" />
                      Published Subject Results
                    </h3>
                    <p className="text-xs text-slate-500">Official grades approved and gazetted by Examination Branch</p>
                  </div>
                  <span className="text-xs bg-slate-100 text-slate-700 px-3 py-1 rounded-full font-bold">
                    Color Indicator: Green = Corrected Version
                  </span>
                </div>

                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 font-bold">
                        <th className="py-3 px-4">Course</th>
                        <th className="py-3 px-4">Credits</th>
                        <th className="py-3 px-4">Internal (/40)</th>
                        <th className="py-3 px-4">External (/60)</th>
                        <th className="py-3 px-4">Total (/100)</th>
                        <th className="py-3 px-4">Grade</th>
                        <th className="py-3 px-4">Result</th>
                        <th className="py-3 px-4">Status &amp; Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {results.length > 0 ? (
                        results.map((r: any) => {
                          const isCorrected = r.currentVersion > 1;
                          return (
                            <tr
                              key={r.id}
                              className={`hover:bg-slate-50/80 transition ${
                                isCorrected ? 'bg-emerald-50/50' : ''
                              }`}
                            >
                              <td className="py-3 px-4">
                                <div className="font-bold text-slate-900">{r.offering?.course?.code}</div>
                                <div className="text-[11px] text-slate-500">{r.offering?.course?.title}</div>
                              </td>
                              <td className="py-3 px-4 font-semibold text-slate-800">{r.offering?.course?.credits || 4}</td>
                              <td className="py-3 px-4 font-mono font-bold text-slate-900">{r.internalMarks}</td>
                              <td className="py-3 px-4 font-mono font-bold text-slate-900">{r.externalMarks}</td>
                              <td className="py-3 px-4 font-mono font-black text-slate-900">{r.totalMarks}</td>
                              <td className="py-3 px-4">
                                <span className="bg-indigo-100 text-indigo-900 font-black px-2 py-0.5 rounded text-xs border border-indigo-200">
                                  {r.grade} ({r.gradePoint} GP)
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                                    r.isPassed
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {r.isPassed ? 'PASSED' : 'FAILED'}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center space-x-2">
                                  {isCorrected && (
                                    <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px] border border-emerald-300">
                                      Corrected (v{r.currentVersion})
                                    </span>
                                  )}
                                  <button
                                    onClick={() => setSelectedResult(r)}
                                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold border border-indigo-200 hover:bg-indigo-50 px-2.5 py-1 rounded transition"
                                    title="Submit internal assessment grievance directly to course faculty"
                                  >
                                    Internal Grievance
                                  </button>
                                  <button
                                    onClick={() => setSelectedResultForReval(r)}
                                    className="text-xs text-amber-700 hover:text-amber-900 font-semibold border border-amber-200 hover:bg-amber-50 px-2.5 py-1 rounded transition"
                                    title="Apply for statutory external exam revaluation"
                                  >
                                    Revaluation (Ext)
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-500">
                            No published examination results available for current semester.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* CGPA Availability Rule Note */}
                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs text-slate-500 gap-2">
                  <div className="flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4 text-indigo-600" />
                    <span>
                      <strong>CGPA Policy:</strong> CGPA is official only if all curriculum courses are cleared without backlogs.
                    </span>
                  </div>
                  <div className="font-semibold text-slate-700">
                    Calculated SGPA: {results[0]?.sgpa || '8.50'} • CGPA Status: {cgpaEvaluation?.cgpaStatus || 'OFFICIAL'}
                  </div>
                </div>
              </div>

              {/* Campus Announcements Widget */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Bell className="h-5 w-5 text-indigo-600" />
                    Official Institutional Announcements
                  </h3>
                  <button
                    onClick={() => setActiveTab('announcements')}
                    className="text-xs text-indigo-600 hover:underline font-bold"
                  >
                    View All
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  {announcements.slice(0, 3).map((ann: any) => (
                    <div key={ann.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded">
                          {ann.category}
                        </span>
                        <span className="text-slate-400 font-mono">{new Date(ann.createdAt).toLocaleDateString()}</span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{ann.title}</h4>
                      <p className="text-xs text-slate-600 line-clamp-2">{ann.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: MY COURSES */}
          {activeTab === 'courses' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-indigo-600" />
                Registered Courses — Semester {student?.currentSemester || 5}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {marksData.map((course: any) => (
                  <div key={course.offeringId} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          {course.courseCode}
                        </span>
                        <h3 className="text-base font-bold text-slate-900 mt-1">{course.courseTitle}</h3>
                      </div>
                      <span className="text-xs font-bold text-slate-600 bg-white px-2 py-1 rounded border border-slate-200">
                        {course.credits} Credits
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs bg-white p-2.5 rounded-lg border border-slate-100">
                      <div>
                        <div className="text-[10px] text-slate-400 font-bold">INTERNAL</div>
                        <div className="font-mono font-bold text-slate-900">{course.internalTotal} / 40</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 font-bold">EXTERNAL</div>
                        <div className="font-mono font-bold text-slate-900">{course.externalMarks ?? 'Pending'} / 60</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 font-bold">GRADE</div>
                        <div className="font-black text-indigo-600">{course.grade ?? '—'}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: MY TIMETABLE */}
          {activeTab === 'timetable' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-indigo-600" />
                Official Class Timetable
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 font-bold">
                      <th className="py-3 px-4">Day</th>
                      <th className="py-3 px-4">Time Slot</th>
                      <th className="py-3 px-4">Course</th>
                      <th className="py-3 px-4">Room Number</th>
                      <th className="py-3 px-4">Faculty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {timetableData.length > 0 ? (
                      timetableData.map((slot: any) => (
                        <tr key={slot.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-bold text-indigo-600">{slot.dayOfWeek}</td>
                          <td className="py-3 px-4 font-mono font-medium">{slot.startTime} – {slot.endTime}</td>
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            {slot.offering?.course?.code} — {slot.offering?.course?.title}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-700">{slot.roomNumber}</td>
                          <td className="py-3 px-4 text-slate-600">
                            {slot.offering?.teachingAssignments?.[0]?.faculty?.name || 'Assigned Instructor'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-500">
                          No timetable slots scheduled for this section.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: INTERNAL MARKS */}
          {activeTab === 'internal-marks' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-600" />
                Detailed Internal Assessment Marks Breakdown (Out of 40)
              </h2>
              <div className="space-y-4">
                {marksData.map((course: any) => (
                  <div key={course.offeringId} className="border border-slate-200 rounded-xl p-5 bg-slate-50/40 space-y-3">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-bold text-slate-900">
                        {course.courseCode} — {course.courseTitle}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-black bg-indigo-100 text-indigo-900 px-3 py-1 rounded-full">
                          Internal Total: {course.internalTotal} / 40
                        </span>
                        <button
                          onClick={() => {
                            const matching = results.find(
                              (r: any) => r.offeringId === course.offeringId || r.offering?.course?.code === course.courseCode
                            );
                            if (matching) {
                              setSelectedResult(matching);
                            } else if (results.length > 0) {
                              setSelectedResult(results[0]);
                            }
                          }}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 rounded-lg text-xs font-bold border border-indigo-200 transition flex items-center gap-1"
                          title="Submit internal assessment grievance directly to course faculty"
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Grievance to Faculty
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {course.components.map((comp: any, idx: number) => (
                        <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200">
                          <div className="text-[11px] font-semibold text-slate-500">{comp.name}</div>
                          <div className="text-base font-black font-mono mt-1 text-slate-900">
                            {comp.isAbsent ? (
                              <span className="text-rose-600 font-bold">Absent (AB)</span>
                            ) : (
                              `${comp.marksObtained ?? '—'} / ${comp.maxMarks}`
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">Status: {comp.status}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: REVALUATION MANAGEMENT */}
          {activeTab === 'revaluation' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <RotateCcw className="h-5 w-5 text-amber-600" />
                    External Examination Revaluation Portal
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Apply for statutory script re-evaluation for gazetted external marks (submitted to Examination Admin).
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (results.length > 0) {
                      setGrievanceCourseResultId(results[0].id);
                    }
                    setGrievanceChannel('EXTERNAL_EXAM_ADMIN');
                    setUniversalReason('');
                    setUniversalRequestedMarks('');
                    setUniversalFeedback(null);
                    setShowNewGrievanceModal(true);
                  }}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shadow-sm flex items-center gap-2 transition whitespace-nowrap"
                >
                  <RotateCcw className="h-4 w-4" />
                  Apply for External Revaluation
                </button>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Your Submitted Revaluation Requests</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 font-bold">
                        <th className="py-3 px-4">Subject</th>
                        <th className="py-3 px-4">Original Marks</th>
                        <th className="py-3 px-4">Reason for Grievance</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Decision Notes</th>
                        <th className="py-3 px-4">Date Applied</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {revaluationRequests.length > 0 ? (
                        revaluationRequests.map((req: any) => (
                          <tr key={req.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4 font-bold text-slate-900">
                              {req.result?.offering?.course?.code || 'Course'}
                            </td>
                            <td className="py-3 px-4 font-mono">{req.originalMarks} / 100</td>
                            <td className="py-3 px-4 max-w-xs truncate text-slate-600">{req.reason}</td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  req.status === 'APPROVED'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : req.status === 'REJECTED'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {req.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-600">{req.decisionNotes || 'Under statutory review'}</td>
                            <td className="py-3 px-4 font-mono text-slate-400">
                              {new Date(req.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-500">
                            No active revaluation applications. Select a published course on the dashboard to apply.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: ANNOUNCEMENTS */}
          {activeTab === 'announcements' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Bell className="h-5 w-5 text-indigo-600" />
                Institutional Notice Board
              </h2>
              <div className="space-y-4">
                {announcements.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                    No active announcements published.
                  </div>
                ) : (
                  announcements.map((ann: any) => (
                    <div key={ann.id} className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3 hover:shadow-sm transition">
                      <div className="flex justify-between items-center text-xs">
                        <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                          ann.category === 'URGENT'
                            ? 'bg-rose-100 text-rose-800'
                            : ann.category === 'EXAMINATION'
                            ? 'bg-amber-100 text-amber-800'
                            : ann.category === 'CAMPUS'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}>
                          {ann.category}
                        </span>
                        <span className="text-slate-400 font-mono text-[11px]">{new Date(ann.createdAt).toLocaleString()}</span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900">{ann.title}</h3>
                      {ann.imageUrl && (
                        <div className="rounded-lg overflow-hidden max-h-72 w-full bg-slate-100 border border-slate-200">
                          <img
                            src={ann.imageUrl}
                            alt={ann.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">{ann.content}</p>
                      <div className="text-[10px] text-slate-400 pt-2 border-t border-slate-200/60">
                        Issued by: {ann.createdBy?.name || 'Academic Administration'} • {ann.createdBy?.role || 'ACADEMIC_ADMIN'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB: MY PROFILE */}
          {activeTab === 'profile' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <User className="h-5 w-5 text-indigo-600" />
                Student Academic Profile
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                  <div className="text-slate-500 font-semibold">Full Legal Name</div>
                  <div className="text-sm font-bold text-slate-900">{currentUser.name}</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                  <div className="text-slate-500 font-semibold">Institutional Roll Number</div>
                  <div className="text-sm font-bold font-mono text-slate-900">{student?.rollNumber || '24CS001'}</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                  <div className="text-slate-500 font-semibold">Department</div>
                  <div className="text-sm font-bold text-slate-900">{student?.department?.name || 'Computer Science and Engineering'}</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                  <div className="text-slate-500 font-semibold">Batch &amp; Section</div>
                  <div className="text-sm font-bold text-slate-900">{student?.batch?.name || '2024-2028'} • Section {student?.section?.name || 'A'}</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: ATTENDANCE */}
          {activeTab === 'attendance' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <ClipboardList className="h-5 w-5 text-emerald-600" />
                      Attendance Analytics &amp; Compliance Status
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Statutory institutional minimum: 75% aggregate attendance required for semester exam gazetting.
                    </p>
                  </div>
                  <div className={`px-4 py-2 rounded-xl text-right font-mono font-black text-lg ${
                    attendanceData?.overallShortage ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                  }`}>
                    {attendanceData?.overallPercentage}% Overall
                  </div>
                </div>

                {attendanceData?.overallShortage && (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-sm">Attendance Shortage Alert (&lt;75%)</div>
                      <div className="mt-0.5">
                        Your cumulative attendance is below the mandatory 75% statutory requirement. Please consult with your course faculty for attendance regularization before examination cutoff.
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-4 pt-2">
                  <h3 className="text-sm font-bold text-slate-800">Subject-Wise Breakdown</h3>
                  {attendanceData?.subjectBreakdown?.map((subj: any) => (
                    <div key={subj.offeringId} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-900 text-sm">
                          {subj.courseCode} — {subj.courseTitle}
                        </span>
                        <span className={`font-mono font-black text-sm ${subj.isShortage ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {subj.percentage}% ({subj.attendedCount} / {subj.totalSessions} sessions)
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-3 rounded-full transition-all ${
                            subj.isShortage ? 'bg-rose-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(subj.percentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: EXAMINATION RESULTS */}
          {activeTab === 'results' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Award className="h-5 w-5 text-indigo-600" />
                      Official Examination Results &amp; Grade Transcript
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Results gazetted by Examination Branch. Includes immutable version badges and grievance pathways.
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-500 uppercase block">Current CGPA</span>
                    <span className="text-xl font-black text-indigo-700">
                      {cgpaEvaluation?.cgpaStatus === 'OFFICIAL' ? `${cgpaEvaluation.cgpa} / 10.0` : 'Withheld (Backlogs)'}
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 font-bold">
                        <th className="py-3 px-4">Course</th>
                        <th className="py-3 px-4">Credits</th>
                        <th className="py-3 px-4">Internal (/40)</th>
                        <th className="py-3 px-4">External (/60)</th>
                        <th className="py-3 px-4">Total (/100)</th>
                        <th className="py-3 px-4">Grade</th>
                        <th className="py-3 px-4">Version</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {results.map((r: any) => (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {r.offering?.course?.code} — {r.offering?.course?.title}
                          </td>
                          <td className="py-3 px-4 font-semibold">{r.offering?.course?.credits || 4}</td>
                          <td className="py-3 px-4 font-mono font-bold text-indigo-600">{r.internalMarks}</td>
                          <td className="py-3 px-4 font-mono font-bold text-blue-600">{r.externalMarks}</td>
                          <td className="py-3 px-4 font-mono font-black text-slate-900">{r.totalMarks}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded font-black text-[11px] ${
                              r.grade === 'F' || r.grade === 'AB' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {r.grade} ({r.gradePoint} GP)
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              r.currentVersion > 1 ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-slate-100 text-slate-700'
                            }`}>
                              v{r.currentVersion} {r.currentVersion > 1 ? 'Corrected' : 'Initial'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">
                              {r.publicationStatus}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right space-x-1">
                            <button
                              onClick={() => setSelectedResult(r)}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[11px] font-bold border border-indigo-200"
                              title="Ask faculty directly to review internal assessment"
                            >
                              Internal Grievance
                            </button>
                            <button
                              onClick={() => setSelectedResultForReval(r)}
                              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded text-[11px] font-bold border border-amber-200"
                              title="Statutory revaluation for external examination"
                            >
                              Revaluation (Ext)
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: ACADEMIC PERFORMANCE */}
          {activeTab === 'performance' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-indigo-600" />
                    Semester Academic Performance &amp; Credit Trajectory
                  </h2>
                </div>
                <div className="h-80 mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={performanceChartData.length ? performanceChartData : [{ name: 'CS301', internalMarks: 36, externalMarks: 56, totalMarks: 92 }]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                      <YAxis stroke="#64748b" fontSize={12} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="internalMarks" name="Internal Marks (/40)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="externalMarks" name="External Marks (/60)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="totalMarks" name="Grand Total (/100)" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}


          {/* TAB: TRENDING EVENTS (CAMPUS HUB) */}
          {activeTab === 'trending-events' && (
            <div className="space-y-4">
              <CampusHub currentUser={currentUser} initialTab="EVENTS" embedded={true} />
            </div>
          )}

          {/* TAB: LOST & FOUND (CAMPUS HUB) */}
          {activeTab === 'lost-found' && (
            <div className="space-y-4">
              <CampusHub currentUser={currentUser} initialTab="LOST_FOUND" embedded={true} />
            </div>
          )}
        </div>
      )}

      {/* MODAL: CORRECTION REQUEST */}
      {selectedResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Internal Marks Grievance (Direct to Faculty)</h3>
                <p className="text-xs text-slate-500">Course: {selectedResult.offering?.course?.code} — {selectedResult.offering?.course?.title}</p>
              </div>
              <button onClick={() => setSelectedResult(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-900 space-y-1">
              <div className="font-bold">Direct Faculty Review:</div>
              <p className="text-[11px] leading-relaxed">
                You can directly ask your course faculty to review internal assessment marks (Mid-1, Mid-2, Quizzes, Lab/Assignments out of 40). Your faculty has full authority to change internal marks without Exam Admin permission, and the updated marks reflect immediately on both student results and the Examination Admin portal.
              </p>
              <div className="pt-1 text-[11px] text-amber-800 font-semibold border-t border-indigo-200/60">
                Notice: For end-semester external exam marks (/60), students can ONLY appeal via statutory Revaluation.
              </div>
            </div>

            <form onSubmit={handleRequestCorrection} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Reason for Internal Grievance *</label>
                <textarea
                  required
                  rows={3}
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  placeholder="Specify assessment component, question numbering, or totaling discrepancy for your faculty..."
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Requested Internal Marks (/40, Optional)</label>
                <input
                  type="number"
                  step="0.5"
                  max="40"
                  min="0"
                  value={requestedMarks}
                  onChange={(e) => setRequestedMarks(e.target.value)}
                  placeholder="e.g. 36.0 (Out of 40)"
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 text-xs"
                />
              </div>

              {requestMsg && (
                <div className={`p-3 rounded-lg text-xs font-semibold ${requestMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
                  {requestMsg.text}
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    const temp = selectedResult;
                    setSelectedResult(null);
                    setSelectedResultForReval(temp);
                  }}
                  className="text-xs font-bold text-amber-700 hover:underline"
                >
                  External Exam Issue? Apply Revaluation &rarr;
                </button>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setSelectedResult(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReq}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center gap-1.5"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {submittingReq ? 'Submitting...' : 'Send Grievance to Faculty'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: APPLY REVALUATION */}
      {selectedResultForReval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Apply for Statutory External Revaluation</h3>
                <p className="text-xs text-slate-500">Course: {selectedResultForReval.offering?.course?.code} — Current External: {selectedResultForReval.externalMarks}/60</p>
              </div>
              <button onClick={() => setSelectedResultForReval(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <RotateCcw className="h-3.5 w-3.5 text-amber-700" />
                Statutory Examination Regulation:
              </div>
              <p className="text-[11px] leading-relaxed">
                For external examination marks (/60), students can <strong>strictly only apply for statutory revaluation</strong>. Students <strong>cannot request specific numeric target marks</strong>. Your physical/OMR answer paper will be independently re-scrutinized by an external examiner appointed by the Exam Board.
              </p>
            </div>

            <form onSubmit={handleApplyRevaluation} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Statutory Grounds for Revaluation *</label>
                <textarea
                  required
                  rows={3}
                  value={revalReason}
                  onChange={(e) => setRevalReason(e.target.value)}
                  placeholder="State specific questions or sections believed to have totaling or evaluation discrepancy..."
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              {revalMsg && (
                <div className={`p-3 rounded-lg text-xs font-semibold ${revalMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
                  {revalMsg.text}
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedResultForReval(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={submittingReval}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold flex items-center gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {submittingReval ? 'Submitting...' : 'Submit for Statutory Revaluation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: UNIVERSAL GRIEVANCE SUBMISSION (FACULTY INTERNAL VS EXAM ADMIN EXTERNAL) */}
      {showNewGrievanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-indigo-600" />
                  Raise Academic Grievance
                </h3>
                <p className="text-xs text-slate-500">
                  Select destination authority: Faculty (Internal Marks) or Exam Admin (External Marks Revaluation).
                </p>
              </div>
              <button
                onClick={() => setShowNewGrievanceModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUniversalGrievanceSubmit} className="space-y-4 text-xs">
              {/* Course Selection */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Course / Subject *</label>
                <select
                  required
                  value={grievanceCourseResultId}
                  onChange={(e) => setGrievanceCourseResultId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-semibold text-xs bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Choose Course --</option>
                  {results.map((r: any) => (
                    <option key={r.id} value={r.id}>
                      [{r.offering?.course?.code}] {r.offering?.course?.title} (Int: {r.internalMarks}/40, Ext: {r.externalMarks}/60, Total: {r.totalMarks}/100)
                    </option>
                  ))}
                </select>
              </div>

              {/* Authority Selection Channel */}
              <div>
                <label className="block font-bold text-slate-700 mb-2">Grievance Destination Authority *</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setGrievanceChannel('INTERNAL_FACULTY')}
                    className={`p-3.5 rounded-xl border text-left transition ${
                      grievanceChannel === 'INTERNAL_FACULTY'
                        ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block" />
                      Course Faculty
                    </div>
                    <div className="text-[11px] font-semibold text-indigo-700 mt-1">Internal Marks (/40)</div>
                    <div className="text-[10px] text-slate-500 mt-1 leading-snug">
                      Directly reviewed &amp; approved by course instructor without Exam Admin permission.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGrievanceChannel('EXTERNAL_EXAM_ADMIN')}
                    className={`p-3.5 rounded-xl border text-left transition ${
                      grievanceChannel === 'EXTERNAL_EXAM_ADMIN'
                        ? 'border-amber-600 bg-amber-50/70 ring-2 ring-amber-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-600 inline-block" />
                      Examination Admin
                    </div>
                    <div className="text-[11px] font-semibold text-amber-700 mt-1">External Marks (/60)</div>
                    <div className="text-[10px] text-slate-500 mt-1 leading-snug">
                      Statutory Revaluation appeal evaluated by external examination board.
                    </div>
                  </button>
                </div>
              </div>

              {/* Informational Guidance Banner */}
              {grievanceChannel === 'INTERNAL_FACULTY' ? (
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-[11px] text-indigo-900 space-y-1">
                  <div className="font-bold">Direct Faculty Resolution:</div>
                  <p className="leading-relaxed">
                    This request goes directly to your assigned course faculty. Your instructor has full authority to directly update your internal assessment marks. Changes reflect immediately on your student dashboard and Exam Admin portal.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 space-y-1">
                  <div className="font-bold">Statutory External Revaluation Regulation:</div>
                  <p className="leading-relaxed">
                    Per examination regulations, students cannot request arbitrary numerical target marks for external papers. Your physical/OMR answer sheet will be re-scrutinized independently by the exam board.
                  </p>
                </div>
              )}

              {/* Grievance Reason Field */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {grievanceChannel === 'INTERNAL_FACULTY' ? 'Reason for Internal Grievance *' : 'Statutory Grounds for External Revaluation *'}
                </label>
                <textarea
                  required
                  rows={3}
                  value={universalReason}
                  onChange={(e) => setUniversalReason(e.target.value)}
                  placeholder={
                    grievanceChannel === 'INTERNAL_FACULTY'
                      ? 'Specify question number, missing step marks, or assessment component discrepancy for your instructor...'
                      : 'Detail specific grounds, questions, or sections with totaling/evaluation discrepancy for external board review...'
                  }
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 text-xs"
                />
              </div>

              {/* Optional Requested Marks for Faculty Internal Grievance */}
              {grievanceChannel === 'INTERNAL_FACULTY' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Requested Revised Internal Marks (/40, Optional)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="40"
                    value={universalRequestedMarks}
                    onChange={(e) => setUniversalRequestedMarks(e.target.value)}
                    placeholder="e.g. 36.5 (Out of 40)"
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 text-xs"
                  />
                </div>
              )}

              {universalFeedback && (
                <div
                  className={`p-3 rounded-lg text-xs font-semibold ${
                    universalFeedback.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {universalFeedback.text}
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewGrievanceModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={submittingUniversalGrievance}
                  className={`px-4 py-2 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-sm transition ${
                    grievanceChannel === 'INTERNAL_FACULTY'
                      ? 'bg-indigo-600 hover:bg-indigo-700'
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  {submittingUniversalGrievance ? (
                    'Submitting...'
                  ) : grievanceChannel === 'INTERNAL_FACULTY' ? (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      Submit Grievance to Faculty
                    </>
                  ) : (
                    <>
                      <RotateCcw className="h-3.5 w-3.5" />
                      Submit Revaluation to Exam Admin
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PortalLayout>
  );
};
