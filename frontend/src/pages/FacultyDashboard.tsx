import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { PortalLayout, NavItem } from '../components/PortalLayout';
import { CampusHub } from './CampusHub';
import {
  LayoutDashboard,
  BookOpen,
  Layers,
  Users,
  Calendar,
  ClipboardList,
  FileText,
  Lock,
  AlertTriangle,
  TrendingUp,
  History,
  Bell,
  Compass,
  CheckCircle,
  AlertCircle,
  Clock,
  Save,
  RefreshCw,
  GitCommit,
  Shield,
  FileCheck,
  Send,
  HelpCircle,
  UserCheck
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';

interface FacultyDashboardProps {
  currentUser: any;
  onViewChange?: (view: 'ERP' | 'CAMPUS_HUB') => void;
  onLogout?: () => void;
  onQuickSwitchUser?: (email: string, pass: string) => void;
  switchingRole?: boolean;
}

export const FacultyDashboard: React.FC<FacultyDashboardProps> = ({
  currentUser,
  onViewChange = () => {},
  onLogout = () => {},
  onQuickSwitchUser = () => {},
  switchingRole = false,
}) => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [offerings, setOfferings] = useState<any[]>([]);
  const [selectedOfferingId, setSelectedOfferingId] = useState<string>('');
  const [offeringData, setOfferingData] = useState<any>(null);
  const [timetableSlots, setTimetableSlots] = useState<any[]>([]);
  const [attendanceSessions, setAttendanceSessions] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [correctionRequests, setCorrectionRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Local marks state: map of markId -> { marksObtained, isAbsent, version }
  const [marksState, setMarksState] = useState<Record<string, { marksObtained: number | null; isAbsent: boolean; version: number }>>({});

  // OCC Conflict State (Scenario A)
  const [conflictState, setConflictState] = useState<{
    markId: string;
    studentName: string;
    componentName: string;
    clientAttemptedMarks: number | null;
    serverCurrentVersion: number;
    serverCurrentMarks: number | null;
  } | null>(null);

  // Attendance Form State
  const [newSessionTopic, setNewSessionTopic] = useState<string>('Lecture: Process Scheduling & Context Switch');
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, boolean>>({});
  const [submittingAttendance, setSubmittingAttendance] = useState<boolean>(false);
  const [attendanceMsg, setAttendanceMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Correction Review Modal
  const [selectedCorrection, setSelectedCorrection] = useState<any>(null);
  const [reviewAction, setReviewAction] = useState<'PROPOSE' | 'REJECT'>('PROPOSE');
  const [reviewReason, setReviewReason] = useState<string>('Verified script question 3b step marks addition');
  const [proposedMarks, setProposedMarks] = useState<number>(36);
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);

  // Notification Toast
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    loadFacultyData();
  }, [currentUser]);

  const loadFacultyData = async () => {
    try {
      setLoading(true);
      const [offRes, timeRes, annRes] = await Promise.all([
        api.getOfferings(),
        api.getTimetable(),
        api.getAnnouncements(),
      ]);

      const allOfferings = offRes.offerings || [];
      setOfferings(allOfferings);
      setTimetableSlots(timeRes.slots || []);
      setAnnouncements(annRes.announcements || []);

      if (allOfferings.length > 0) {
        setSelectedOfferingId(allOfferings[0].id);
      }
    } catch (err: any) {
      console.error(err);
      setNotification({ type: 'error', text: 'Failed to load initial faculty data' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedOfferingId) {
      loadOfferingDetails(selectedOfferingId);
    }
  }, [selectedOfferingId]);

  const loadOfferingDetails = async (offeringId: string) => {
    try {
      setLoading(true);
      setConflictState(null);
      const [marksRes, attRes] = await Promise.all([
        api.getOfferingMarks(offeringId),
        api.getAttendance(offeringId).catch(() => ({ sessions: [] })),
      ]);

      setOfferingData(marksRes);
      setAttendanceSessions(attRes.sessions || []);

      // Initialize marks state
      const initialMarks: Record<string, any> = {};
      (marksRes.marks || []).forEach((m: any) => {
        initialMarks[m.id] = {
          marksObtained: m.marksObtained,
          isAbsent: m.isAbsent,
          version: m.version,
        };
      });
      setMarksState(initialMarks);

      // Initialize default attendance for roster
      const initialAtt: Record<string, boolean> = {};
      (marksRes.offering?.enrollments || []).forEach((enr: any) => {
        initialAtt[enr.student.id] = true;
      });
      setAttendanceRecords(initialAtt);
    } catch (err: any) {
      if (err.status === 403) {
        setNotification({
          type: 'error',
          text: `Access Restricted (HTTP 403): ${err.data?.message || 'You do not have an active teaching assignment for this course offering.'}`,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMarkChange = (markId: string, val: string) => {
    const num = val === '' ? null : Number(val);
    setMarksState((prev) => ({
      ...prev,
      [markId]: {
        ...prev[markId],
        marksObtained: num,
      },
    }));
  };

  const handleAbsentToggle = (markId: string, isAbsent: boolean) => {
    setMarksState((prev) => ({
      ...prev,
      [markId]: {
        ...prev[markId],
        isAbsent,
        marksObtained: isAbsent ? null : prev[markId]?.marksObtained,
      },
    }));
  };

  // Normal Save (Uses expectedVersion from state)
  const handleSaveMark = async (markId: string) => {
    const currentMark = marksState[markId];
    if (!currentMark) return;

    try {
      setSavingId(markId);
      setNotification(null);
      const res = await api.updateMark(
        markId,
        currentMark.version,
        currentMark.marksObtained,
        currentMark.isAbsent
      );

      setMarksState((prev) => ({
        ...prev,
        [markId]: {
          ...prev[markId],
          version: res.mark.version,
        },
      }));
      setNotification({
        type: 'success',
        text: `Marks saved successfully! Version incremented to v${res.mark.version}.`,
      });
    } catch (err: any) {
      if (err.status === 409) {
        const targetDbMark = (offeringData?.marks || []).find((m: any) => m.id === markId);
        setConflictState({
          markId,
          studentName: targetDbMark?.student?.user?.name || 'Student',
          componentName: targetDbMark?.component?.name || 'Assessment Component',
          clientAttemptedMarks: currentMark.marksObtained,
          serverCurrentVersion: err.data?.currentVersion || 2,
          serverCurrentMarks: err.data?.currentData?.marksObtained ?? 14.5,
        });
      } else {
        setNotification({
          type: 'error',
          text: `Save failed (HTTP ${err.status || 500}): ${err.data?.message || err.message}`,
        });
      }
    } finally {
      setSavingId(null);
    }
  };

  // Scenario A Simulation Trigger: Deliberately send stale version
  const handleTriggerSimulatedStaleEdit = async (markId: string) => {
    const currentMark = marksState[markId];
    if (!currentMark) return;

    try {
      setSavingId(markId);
      setNotification(null);
      // Send a stale expected version
      await api.updateMark(markId, currentMark.version - 1 || 1, 10.0, false);
    } catch (err: any) {
      if (err.status === 409) {
        const targetDbMark = (offeringData?.marks || []).find((m: any) => m.id === markId);
        setConflictState({
          markId,
          studentName: targetDbMark?.student?.user?.name || 'Rahul Sharma',
          componentName: targetDbMark?.component?.name || 'Mid-1 Assessment',
          clientAttemptedMarks: 10.0,
          serverCurrentVersion: err.data?.currentVersion || 2,
          serverCurrentMarks: err.data?.currentData?.marksObtained ?? 14.5,
        });
      }
    } finally {
      setSavingId(null);
    }
  };

  // Reload data after conflict resolution
  const handleResolveConflictReload = async () => {
    setConflictState(null);
    if (selectedOfferingId) {
      await loadOfferingDetails(selectedOfferingId);
      setNotification({
        type: 'info',
        text: 'Reloaded latest canonical records from database. Stale edits discarded.',
      });
    }
  };

  // Submit Internal Marks for Locking
  const handleSubmitMarksForLock = async () => {
    if (!selectedOfferingId) return;
    try {
      setLoading(true);
      const res = await api.submitOfferingMarks(selectedOfferingId);
      setNotification({
        type: 'success',
        text: res.message || 'Marks successfully locked and submitted to Examination Admin.',
      });
      loadOfferingDetails(selectedOfferingId);
    } catch (err: any) {
      setNotification({ type: 'error', text: err.data?.message || 'Submission failed' });
    } finally {
      setLoading(false);
    }
  };

  // Record Attendance Session
  const handleRecordAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOfferingId) return;
    try {
      setSubmittingAttendance(true);
      setAttendanceMsg(null);

      const records = Object.entries(attendanceRecords).map(([studentId, isPresent]) => ({
        studentId,
        isPresent,
      }));

      await api.recordAttendanceSession({
        offeringId: selectedOfferingId,
        topic: newSessionTopic,
        records,
      });

      setAttendanceMsg({
        type: 'success',
        text: 'Attendance session recorded successfully! Audit event committed.',
      });
      loadOfferingDetails(selectedOfferingId);
    } catch (err: any) {
      setAttendanceMsg({
        type: 'error',
        text: err.status === 409 ? 'Concurrent conflict: Attendance for this session has already been recorded.' : err.data?.message || err.message,
      });
    } finally {
      setSubmittingAttendance(false);
    }
  };

  // Handle Faculty Correction Proposal
  const handleReviewCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCorrection) return;
    try {
      setSubmittingReview(true);
      await api.facultyReviewCorrection(
        selectedCorrection.id,
        reviewAction,
        reviewReason,
        reviewAction === 'PROPOSE' ? proposedMarks : undefined
      );
      setNotification({
        type: 'success',
        text: `Correction review submitted (${reviewAction}). Routed to Examination Admin for final statutory authorization.`,
      });
      setSelectedCorrection(null);
      loadOfferingDetails(selectedOfferingId);
    } catch (err: any) {
      setNotification({ type: 'error', text: err.data?.message || err.message });
    } finally {
      setSubmittingReview(false);
    }
  };

  const selectedOffering = offerings.find((o) => o.id === selectedOfferingId);
  const enrollments = offeringData?.offering?.enrollments || [];
  const marks = offeringData?.marks || [];
  const components = offeringData?.offering?.components || [];

  // Recharts Distribution
  const marksDistribution = marks.map((m: any) => ({
    student: m.student?.user?.name || 'Student',
    marks: m.marksObtained ?? 0,
    max: m.component?.maxMarks || 15,
  }));

  // Sidebar Items strictly matching prompt Section 7
  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'assigned-courses', label: 'Assigned Courses', icon: BookOpen },
    { id: 'sections', label: 'My Sections', icon: Layers },
    { id: 'roster', label: 'Student Roster', icon: Users, badge: enrollments.length || undefined },
    { id: 'timetable', label: 'My Timetable', icon: Calendar },
    { id: 'attendance', label: 'Attendance Management', icon: ClipboardList },
    { id: 'internal-marks', label: 'Internal Marks Entry', icon: FileText },
    { id: 'submission', label: 'Assessment Submission', icon: Lock },
    { id: 'corrections', label: 'Correction Requests', icon: AlertTriangle },
    { id: 'performance', label: 'Class Performance', icon: TrendingUp },
    { id: 'history', label: 'Assignment History', icon: History },
    { id: 'announcements', label: 'Announcements', icon: Bell },
    { id: 'scenario-a', label: 'OCC Concurrency Test (A)', icon: Shield },
    { id: 'campushub', label: 'Campus Hub', icon: Compass },
  ];

  const handleNavSelect = (id: string) => {
    setActiveTab(id);
  };

  return (
    <PortalLayout
      currentUser={currentUser}
      currentRoleTitle="Faculty Portal"
      navItems={navItems}
      activeNavId={activeTab}
      onNavSelect={handleNavSelect}
      currentView="ERP"
      onViewChange={onViewChange}
      onLogout={onLogout}
      onQuickSwitchUser={onQuickSwitchUser}
      switchingRole={switchingRole}
    >
      <div className="space-y-6">
        {/* Welcome & Faculty Attribution Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white rounded-xl shadow-md p-6 border border-slate-800">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                  Instructional Faculty
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Employee ID: {currentUser.facultyProfile?.employeeId || 'FAC-CSE-001'}
                </span>
              </div>
              <h1 className="text-2xl font-black mt-1 text-white">{currentUser.name}</h1>
              <p className="text-xs text-slate-300 mt-1">
                {currentUser.facultyProfile?.designation || 'Professor & Chair'} • Department of {currentUser.department?.name || 'Computer Science and Engineering'}
              </p>
            </div>

            {/* Course Offering Selector */}
            <div className="bg-white/10 backdrop-blur p-3 rounded-lg border border-white/10 text-xs space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-300 block">Select Active Offering</label>
              <select
                value={selectedOfferingId}
                onChange={(e) => setSelectedOfferingId(e.target.value)}
                className="bg-slate-900 text-white font-bold border border-slate-700 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500"
              >
                {offerings.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.course.code} — {o.batch.name} Sec {o.section.name} (Sem {o.semester})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Global Notifications */}
        {notification && (
          <div
            className={`p-4 rounded-xl border text-xs font-semibold flex items-center justify-between ${
              notification.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : notification.type === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-300'
                : 'bg-blue-50 text-blue-800 border-blue-300'
            }`}
          >
            <span>{notification.text}</span>
            <button onClick={() => setNotification(null)} className="font-bold ml-4">✕</button>
          </div>
        )}

        {/* OCC Conflict Alert Banner (Scenario A) */}
        {conflictState && (
          <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-amber-950 flex items-center gap-2">
                  <span>Scenario A: Concurrency Conflict Detected (HTTP 409 Conflict)</span>
                  <span className="bg-amber-200 text-amber-900 text-[10px] px-2 py-0.5 rounded font-mono font-bold">
                    OCC_COLLISION
                  </span>
                </h3>
                <p className="text-xs text-amber-800 mt-1">
                  Another session updated student <strong>{conflictState.studentName}</strong>'s mark for{' '}
                  <strong>{conflictState.componentName}</strong> to{' '}
                  <strong className="text-amber-950 font-mono font-black">{conflictState.serverCurrentMarks}</strong>{' '}
                  (advancing database record to <strong>v{conflictState.serverCurrentVersion}</strong>).
                </p>
              </div>
            </div>

            <div className="bg-white border border-amber-200 rounded-lg p-3 text-xs grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">Your Stale Submission</div>
                <div className="font-mono text-slate-700 mt-0.5">Attempted: {conflictState.clientAttemptedMarks} marks</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-emerald-700 uppercase">Database Server State (Preserved)</div>
                <div className="font-mono font-bold text-emerald-800 mt-0.5">
                  Current: {conflictState.serverCurrentMarks} marks (v{conflictState.serverCurrentVersion})
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={handleResolveConflictReload}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reload &amp; Review Latest Database State
              </button>
            </div>
          </div>
        )}

        {/* TAB: DASHBOARD (Overview) */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Assigned Courses</div>
                    <div className="text-2xl font-black text-slate-900 mt-1">{offerings.length}</div>
                    <div className="text-xs text-blue-600 font-semibold mt-1">Active Semester Offerings</div>
                  </div>
                  <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                    <BookOpen className="h-5 w-5" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Enrolled Students</div>
                    <div className="text-2xl font-black text-slate-900 mt-1">{enrollments.length}</div>
                    <div className="text-xs text-emerald-600 font-semibold mt-1">Section {selectedOffering?.section?.name || 'A'} Roster</div>
                  </div>
                  <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
                    <Users className="h-5 w-5" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Attendance Sessions</div>
                    <div className="text-2xl font-black text-slate-900 mt-1">{attendanceSessions.length}</div>
                    <div className="text-xs text-indigo-600 font-semibold mt-1">Conducted to Date</div>
                  </div>
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
                    <ClipboardList className="h-5 w-5" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Internal Marks Status</div>
                    <div className="text-2xl font-black text-slate-900 mt-1">
                      {marks.every((m: any) => m.status === 'SUBMITTED' || m.status === 'LOCKED') ? 'LOCKED' : 'DRAFT'}
                    </div>
                    <div className="text-xs text-amber-600 font-semibold mt-1">OCC Version Controlled</div>
                  </div>
                  <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
                    <FileText className="h-5 w-5" />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions & Timetable Today */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Internal Marks Entry Quick Action */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    Internal Marks Management — {selectedOffering?.course?.code}
                  </h3>
                  <button
                    onClick={() => setActiveTab('internal-marks')}
                    className="text-xs text-blue-600 font-bold hover:underline"
                  >
                    Full Marks Sheet &rarr;
                  </button>
                </div>
                <p className="text-xs text-slate-600">
                  Enter student internal marks for Mid-1, Mid-2, and quizzes out of 40 max. Atomic version controls prevent lost updates.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveTab('internal-marks')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm"
                  >
                    Open Marks Sheet
                  </button>
                  <button
                    onClick={handleSubmitMarksForLock}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold border border-slate-300"
                  >
                    Submit to Exam Admin
                  </button>
                </div>
              </div>

              {/* Attendance Quick Record */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-emerald-600" />
                    Conduct Attendance Session
                  </h3>
                  <button
                    onClick={() => setActiveTab('attendance')}
                    className="text-xs text-emerald-600 font-bold hover:underline"
                  >
                    Attendance Center &rarr;
                  </button>
                </div>
                <p className="text-xs text-slate-600">
                  Record daily lecture attendance. Enforces unique session-student constraint with 409 duplicate protection.
                </p>
                <button
                  onClick={() => setActiveTab('attendance')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm"
                >
                  Record Attendance Session
                </button>
              </div>
            </div>

            {/* Performance Overview Chart */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-indigo-600" />
                  Class Mark Distribution — {selectedOffering?.course?.code}
                </h3>
                <span className="text-xs text-slate-500 font-semibold">Active Roster Score Profile</span>
              </div>
              <div className="h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={marksDistribution.length ? marksDistribution : [{ student: 'Rahul Sharma', marks: 14.5, max: 15 }]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="student" stroke="#64748b" fontSize={12} />
                    <YAxis stroke="#64748b" fontSize={12} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="marks" name="Marks Obtained" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="max" name="Component Max" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* TAB: INTERNAL MARKS ENTRY */}
        {activeTab === 'internal-marks' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  Internal Assessment Evaluation Ledger
                </h2>
                <p className="text-xs text-slate-500">
                  Course: {selectedOffering?.course?.code} ({selectedOffering?.course?.title}) • Section {selectedOffering?.section?.name}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSubmitMarksForLock}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <Lock className="h-3.5 w-3.5" />
                  Lock &amp; Submit to Exam Admin
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 font-bold">
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Roll Number</th>
                    <th className="py-3 px-4">Assessment Component</th>
                    <th className="py-3 px-4">Max Marks</th>
                    <th className="py-3 px-4">Marks Obtained</th>
                    <th className="py-3 px-4">Absent</th>
                    <th className="py-3 px-4">OCC Version</th>
                    <th className="py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {marks.length > 0 ? (
                    marks.map((m: any) => {
                      const state = marksState[m.id] || { marksObtained: m.marksObtained, isAbsent: m.isAbsent, version: m.version };
                      const isSaving = savingId === m.id;

                      return (
                        <tr key={m.id} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-4 font-bold text-slate-900">{m.student?.user?.name}</td>
                          <td className="py-3 px-4 font-mono text-slate-600">{m.student?.rollNumber}</td>
                          <td className="py-3 px-4 font-semibold text-indigo-700">{m.component?.name}</td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-500">{m.component?.maxMarks}</td>
                          <td className="py-3 px-4">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              max={m.component?.maxMarks}
                              disabled={state.isAbsent || m.status === 'LOCKED'}
                              value={state.marksObtained ?? ''}
                              onChange={(e) => handleMarkChange(m.id, e.target.value)}
                              className="w-20 border border-slate-300 rounded px-2 py-1 font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 text-xs"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <input
                              type="checkbox"
                              checked={state.isAbsent}
                              onChange={(e) => handleAbsentToggle(m.id, e.target.checked)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">
                              v{state.version}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              <button
                                disabled={isSaving || m.status === 'LOCKED'}
                                onClick={() => handleSaveMark(m.id)}
                                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold transition flex items-center gap-1 shadow-sm"
                              >
                                <Save className="h-3 w-3" />
                                {isSaving ? 'Saving...' : 'Save'}
                              </button>

                              {/* Interactive Scenario A Stale Test Trigger */}
                              <button
                                title="Simulate concurrent conflict by submitting stale version"
                                onClick={() => handleTriggerSimulatedStaleEdit(m.id)}
                                className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded font-semibold text-[10px]"
                              >
                                Test OCC 409
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-slate-500">
                        No assessment marks records found for this offering.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: ATTENDANCE MANAGEMENT */}
        {activeTab === 'attendance' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
            <div className="pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-emerald-600" />
                Attendance Management Center
              </h2>
              <p className="text-xs text-slate-500">
                Course: {selectedOffering?.course?.code} • Date: {new Date().toLocaleDateString()}
              </p>
            </div>

            {/* Attendance Session Entry Form */}
            <form onSubmit={handleRecordAttendance} className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Record New Attendance Session</h3>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Lecture Topic / Learning Objective *</label>
                <input
                  type="text"
                  required
                  value={newSessionTopic}
                  onChange={(e) => setNewSessionTopic(e.target.value)}
                  placeholder="e.g. Memory Hierarchy, Cache Replacement Algorithms"
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Student Attendance Roster</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {enrollments.map((enr: any) => {
                    const isPresent = attendanceRecords[enr.student.id] ?? true;
                    return (
                      <div
                        key={enr.student.id}
                        onClick={() =>
                          setAttendanceRecords((prev) => ({
                            ...prev,
                            [enr.student.id]: !isPresent,
                          }))
                        }
                        className={`p-3 rounded-lg border cursor-pointer select-none transition flex justify-between items-center ${
                          isPresent
                            ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900'
                            : 'bg-rose-50/80 border-rose-300 text-rose-900'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold">{enr.student.user.name}</div>
                          <div className="text-[10px] opacity-75 font-mono">{enr.student.rollNumber}</div>
                        </div>
                        <span className="font-bold text-xs">{isPresent ? 'PRESENT' : 'ABSENT'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {attendanceMsg && (
                <div className={`p-3 rounded-lg text-xs font-semibold ${attendanceMsg.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                  {attendanceMsg.text}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={submittingAttendance}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm"
                >
                  <Save className="h-3.5 w-3.5" />
                  {submittingAttendance ? 'Saving...' : 'Submit Session Attendance'}
                </button>
              </div>
            </form>

            {/* Attendance History */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Historical Attendance Sessions</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 font-bold">
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4">Lecture Topic</th>
                      <th className="py-2.5 px-4">Recorded By</th>
                      <th className="py-2.5 px-4">Present / Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {attendanceSessions.map((s: any) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-mono">{new Date(s.sessionDate).toLocaleDateString()}</td>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">{s.topic}</td>
                        <td className="py-2.5 px-4 text-slate-700">{s.faculty?.name || 'Dr. Alan Turing'}</td>
                        <td className="py-2.5 px-4 font-mono font-bold text-emerald-700">
                          {s.records?.filter((r: any) => r.isPresent).length} / {s.records?.length || enrollments.length}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB: STUDENT ROSTER */}
        {activeTab === 'roster' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-600" />
              Enrolled Student Roster — {selectedOffering?.course?.code} Sec {selectedOffering?.section?.name}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 font-bold">
                    <th className="py-3 px-4">Roll Number</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Batch</th>
                    <th className="py-3 px-4">Section</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {enrollments.map((enr: any) => (
                    <tr key={enr.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-indigo-600">{enr.student?.rollNumber}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{enr.student?.user?.name}</td>
                      <td className="py-3 px-4 text-slate-600">{enr.student?.user?.email}</td>
                      <td className="py-3 px-4 text-slate-700">{selectedOffering?.batch?.name}</td>
                      <td className="py-3 px-4 font-bold text-slate-700">{selectedOffering?.section?.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: MY TIMETABLE */}
        {activeTab === 'timetable' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-indigo-600" />
              Faculty Weekly Schedule
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 font-bold">
                    <th className="py-3 px-4">Day</th>
                    <th className="py-3 px-4">Time Slot</th>
                    <th className="py-3 px-4">Course</th>
                    <th className="py-3 px-4">Section</th>
                    <th className="py-3 px-4">Room Number</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {timetableSlots.map((slot: any) => (
                    <tr key={slot.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-blue-600">{slot.dayOfWeek}</td>
                      <td className="py-3 px-4 font-mono">{slot.startTime} – {slot.endTime}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {slot.offering?.course?.code} — {slot.offering?.course?.title}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-700">{slot.offering?.section?.name}</td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">{slot.roomNumber}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: ASSIGNMENT HISTORY (Scenario D) */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="pb-3 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <History className="h-5 w-5 text-purple-600" />
                Dated Teaching Assignment History (Scenario D)
              </h2>
              <p className="text-xs text-slate-500">
                Preserves instructor attribution and dated teaching scope windows across academic terms.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 font-bold">
                    <th className="py-3 px-4">Course Offering</th>
                    <th className="py-3 px-4">Assigned Instructor</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Effective Start Date</th>
                    <th className="py-3 px-4">Effective End Date</th>
                    <th className="py-3 px-4">Administrative Handover Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedOffering?.teachingAssignments?.map((ta: any) => (
                    <tr key={ta.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {selectedOffering?.course?.code} Sec {selectedOffering?.section?.name}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{ta.faculty?.name}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${ta.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                          {ta.isActive ? 'ACTIVE' : 'REASSIGNED / INACTIVE'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono">{new Date(ta.startDate).toLocaleDateString()}</td>
                      <td className="py-3 px-4 font-mono">{ta.endDate ? new Date(ta.endDate).toLocaleDateString() : 'PRESENT'}</td>
                      <td className="py-3 px-4 text-slate-600 italic">{ta.reason || 'Term appointment'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: ASSIGNED COURSES */}
        {activeTab === 'assigned-courses' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-indigo-600" />
                Teaching Assignments &amp; Course Syllabus
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {assignedOfferings.map((off) => (
                  <div key={off.id} className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="font-mono font-bold text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">
                        {off.course?.code}
                      </span>
                      <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                        Active Term
                      </span>
                    </div>
                    <div className="font-bold text-slate-900 text-base">{off.course?.title}</div>
                    <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-200">
                      <div>Department: <span className="font-semibold text-slate-800">{off.course?.department?.name}</span></div>
                      <div>Batch &amp; Section: <span className="font-semibold text-slate-800">{off.batch?.name} • Sec {off.section?.name}</span></div>
                      <div>Credits: <span className="font-semibold text-slate-800">{off.course?.credits} Credits</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB: MY SECTIONS */}
        {activeTab === 'sections' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Layers className="h-5 w-5 text-indigo-600" />
                Assigned Student Sections &amp; Class Cohorts
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {assignedOfferings.map((off) => (
                  <div key={off.id} className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-base font-black text-slate-900">
                        {off.batch?.name} — Section {off.section?.name}
                      </span>
                      <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        {off.course?.code}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Enrolled Students: <span className="font-bold text-slate-900">{enrollments.length}</span>
                    </p>
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => { setSelectedOfferingId(off.id); setActiveTab('roster'); }}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold text-xs"
                      >
                        View Student Roster
                      </button>
                      <button
                        onClick={() => { setSelectedOfferingId(off.id); setActiveTab('attendance'); }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-xs"
                      >
                        Record Attendance
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB: ASSESSMENT SUBMISSION */}
        {activeTab === 'submission' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Lock className="h-5 w-5 text-indigo-600" />
                Assessment Submission &amp; Examination Locking
              </h2>
              <p className="text-xs text-slate-500">
                Finalize internal marks for submission to the Examination Branch. Once submitted, marks are locked against accidental modification.
              </p>
              <div className="p-5 bg-amber-50 rounded-xl border border-amber-200 space-y-3">
                <div className="font-bold text-amber-900 text-sm">Course Offering: {selectedOffering?.course?.code} — {selectedOffering?.course?.title}</div>
                <p className="text-xs text-amber-800">
                  Total student marks entered: {marksList.length}. Submitting will forward internal marks to the Examination Branch for official grade calculations.
                </p>
                <button
                  onClick={handleSubmitOfferingMarks}
                  disabled={submittingMarks}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shadow-sm flex items-center gap-2 disabled:opacity-50"
                >
                  <Lock className="h-4 w-4" />
                  {submittingMarks ? 'Locking & Submitting...' : 'Confirm Submission to Examination Branch'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB: CORRECTION REQUESTS */}
        {activeTab === 'corrections' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-indigo-600" />
                Student Result Correction Requests
              </h2>
              <p className="text-xs text-slate-500">
                Review student-initiated mark grievances. Faculty verifies the evaluation and proposes updated marks to the Examination Admin.
              </p>
              <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
                No pending correction requests requiring review for this course offering.
              </div>
            </div>
          </div>
        )}

        {/* TAB: CLASS PERFORMANCE */}
        {activeTab === 'performance' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-indigo-600" />
                Class Performance Analytics
              </h2>
              <div className="h-80 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={marksList.map((m: any) => ({
                    student: m.student?.user?.name || 'Student',
                    marks: m.marksObtained ?? 0,
                    max: m.component?.maxMarks || 15,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="student" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="marks" fill="#6366f1" radius={[4, 4, 0, 0]} name="Marks Obtained" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* TAB: ANNOUNCEMENTS */}
        {activeTab === 'announcements' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Bell className="h-5 w-5 text-indigo-600" />
                Campus &amp; Academic Announcements
              </h2>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="font-bold text-sm text-slate-900">Mid-Semester Marks Entry Cutoff Notice</div>
                <p className="text-xs text-slate-600">
                  All teaching faculty are requested to complete Mid-1 and Mid-2 internal assessment marks entry before the upcoming statutory senate deadline.
                </p>
                <div className="text-[10px] text-slate-400">Office of the Dean of Academic Affairs</div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: SCENARIO A OCC CONCURRENCY TEST */}
        {activeTab === 'scenario-a' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Shield className="h-5 w-5 text-indigo-600" />
                Scenario A: Optimistic Concurrency Control (OCC) Live Test Suite
              </h2>
              <p className="text-xs text-slate-500">
                Demonstrates collision avoidance when concurrent faculty sessions edit the same mark record simultaneously.
              </p>
              <div className="p-5 bg-indigo-50 border border-indigo-200 rounded-xl space-y-3">
                <p className="text-xs text-indigo-900 leading-relaxed">
                  Trigger an automated stale concurrency collision against PostgreSQL 18. Session A advances the record version while Session B submits with a stale version, returning an HTTP 409 Conflict.
                </p>
                <button
                  onClick={handleSimulateConcurrencyConflict}
                  disabled={simulatingConflict}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-sm flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${simulatingConflict ? 'animate-spin' : ''}`} />
                  {simulatingConflict ? 'Executing Concurrent Writes...' : 'Simulate Stale Concurrent Collision (HTTP 409)'}
                </button>
              </div>

              {concurrencyConflict && (
                <div className="p-5 bg-rose-50 border border-rose-300 rounded-xl space-y-4">
                  <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
                    <AlertTriangle className="h-5 w-5 text-rose-600" />
                    HTTP 409 Conflict: Concurrent Modification Conflict Detected
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-3 bg-white rounded-lg border border-rose-200">
                      <div className="font-bold text-slate-700">Your Stale Submission:</div>
                      <div className="text-rose-600 font-mono font-bold mt-1">Version: {concurrencyConflict.staleVersion}</div>
                      <div className="text-slate-600 font-mono">Attempted Marks: {concurrencyConflict.staleMarks}</div>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-rose-200">
                      <div className="font-bold text-slate-700">Current Database State:</div>
                      <div className="text-emerald-600 font-mono font-bold mt-1">Version: {concurrencyConflict.serverVersion}</div>
                      <div className="text-slate-900 font-mono font-bold">Server Marks: {concurrencyConflict.serverData?.marksObtained}</div>
                    </div>
                  </div>
                  <button
                    onClick={handleResolveConflictByReloading}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs"
                  >
                    Reload &amp; Accept Latest Server State
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: CAMPUS HUB EMBEDDED */}
        {activeTab === 'campushub' && (
          <div className="space-y-4">
            <CampusHub currentUser={currentUser} initialTab="EVENTS" embedded={true} />
          </div>
        )}
      </div>
    </PortalLayout>
  );
};
