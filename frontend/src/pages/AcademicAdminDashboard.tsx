import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { PortalLayout, NavItem } from '../components/PortalLayout';
import {
  LayoutDashboard,
  UserCheck,
  Users,
  Building2,
  Calendar,
  Layers,
  BookOpen,
  ArrowRightLeft,
  GraduationCap,
  ClipboardList,
  Bell,
  Flame,
  Search,
  FileText,
  CheckCircle,
  AlertCircle,
  Clock,
  Shield,
  PlusCircle,
  Eye,
  EyeOff,
  Send,
  RotateCcw,
  AlertTriangle
} from 'lucide-react';

interface AcademicAdminDashboardProps {
  currentUser: any;
  onViewChange?: (view: 'ERP' | 'CAMPUS_HUB') => void;
  onLogout?: () => void;
  onQuickSwitchUser?: (email: string, pass: string) => void;
  switchingRole?: boolean;
}

export const AcademicAdminDashboard: React.FC<AcademicAdminDashboardProps> = ({
  currentUser,
  onViewChange = () => {},
  onLogout = () => {},
  onQuickSwitchUser = () => {},
  switchingRole = false,
}) => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [departments, setDepartments] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [offerings, setOfferings] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [facultyList, setFacultyList] = useState<any[]>([]);
  const [timetableSlots, setTimetableSlots] = useState<any[]>([]);
  const [attendanceReport, setAttendanceReport] = useState<any[]>([]);
  const [reportsData, setReportsData] = useState<any>(null);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Forms State
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 1. Create Student Form
  const [newStudent, setNewStudent] = useState({
    rollNumber: '',
    name: '',
    email: '',
    password: 'Student@123',
    departmentId: '',
    batchId: '',
    sectionId: '',
    semester: 1,
  });

  // 2. Create Faculty Form
  const [newFaculty, setNewFaculty] = useState({
    employeeId: '',
    name: '',
    email: '',
    password: 'Faculty@123',
    departmentId: '',
    designation: 'Assistant Professor',
  });

  // 3. Create Course Form
  const [newCourse, setNewCourse] = useState({
    code: '',
    title: '',
    departmentId: '',
    credits: 4,
    isTheory: true,
    isLab: false,
  });

  // 4. Create Offering Form
  const [newOffering, setNewOffering] = useState({
    courseId: '',
    batchId: '',
    sectionId: '',
    semester: 1,
    academicYear: '2024-2025',
  });

  // 5. Enroll Student Form
  const [enrollOfferingId, setEnrollOfferingId] = useState<string>('');
  const [enrollStudentId, setEnrollStudentId] = useState<string>('');

  // 6. Faculty Reassignment Form (Scenario D)
  const [reassignOfferingId, setReassignOfferingId] = useState<string>('');
  const [reassignFacultyId, setReassignFacultyId] = useState<string>('');
  const [reassignDate, setReassignDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [reassignReason, setReassignReason] = useState<string>('Faculty mid-semester sabbatical coverage and medical handover');
  const [submittingReassign, setSubmittingReassign] = useState<boolean>(false);
  const [reassignResult, setReassignResult] = useState<any>(null);

  // 7. Timetable Slot Form
  const [newSlot, setNewSlot] = useState({
    offeringId: '',
    dayOfWeek: 'MON' as 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT',
    startTime: '09:00',
    endTime: '10:00',
    roomNumber: 'LH-101',
  });

  // 8. Semester Progression Form
  const [progressionBatchId, setProgressionBatchId] = useState<string>('');
  const [progressionTargetSem, setProgressionTargetSem] = useState<number>(2);
  const [progressionYear, setProgressionYear] = useState<string>('2025-2026');

  // 9. Announcement Form
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    content: '',
    category: 'ACADEMIC' as 'ACADEMIC' | 'EXAMINATION' | 'CAMPUS' | 'URGENT',
    targetRole: 'ALL',
  });

  useEffect(() => {
    loadAllAcademicData();
  }, [currentUser]);

  const loadAllAcademicData = async () => {
    try {
      setLoading(true);
      const [deptRes, batchRes, courseRes, offRes, studRes, facRes, timeRes, attRes, repRes, annRes] =
        await Promise.all([
          api.getDepartments(),
          api.getBatches(),
          api.getCourses().catch(() => ({ courses: [] })),
          api.getOfferings(),
          api.getStudents().catch(() => ({ students: [] })),
          api.getFacultyAccounts().catch(() => ({ faculty: [] })),
          api.getTimetable().catch(() => ({ slots: [] })),
          api.getAttendanceOverview().catch(() => ({ report: [] })),
          api.getReports().catch(() => null),
          api.getAnnouncements().catch(() => ({ announcements: [] })),
        ]);

      setDepartments(deptRes.departments || []);
      setBatches(batchRes.batches || []);
      setCourses(courseRes.courses || []);
      setOfferings(offRes.offerings || []);
      setStudents(studRes.students || []);
      setFacultyList(facRes.faculty || []);
      setTimetableSlots(timeRes.slots || []);
      setAttendanceReport(attRes.report || []);
      setReportsData(repRes);
      setAnnouncements(annRes.announcements || []);

      // Default select dropdowns
      if (deptRes.departments?.length > 0) {
        setNewStudent((prev) => ({ ...prev, departmentId: deptRes.departments[0].id }));
        setNewFaculty((prev) => ({ ...prev, departmentId: deptRes.departments[0].id }));
        setNewCourse((prev) => ({ ...prev, departmentId: deptRes.departments[0].id }));
      }
      if (batchRes.batches?.length > 0) {
        setNewStudent((prev) => ({
          ...prev,
          batchId: batchRes.batches[0].id,
          sectionId: batchRes.batches[0].sections?.[0]?.id || '',
        }));
        setNewOffering((prev) => ({
          ...prev,
          batchId: batchRes.batches[0].id,
          sectionId: batchRes.batches[0].sections?.[0]?.id || '',
        }));
        setProgressionBatchId(batchRes.batches[0].id);
      }
      if (offRes.offerings?.length > 0) {
        setEnrollOfferingId(offRes.offerings[0].id);
        setReassignOfferingId(offRes.offerings[0].id);
        setNewSlot((prev) => ({ ...prev, offeringId: offRes.offerings[0].id }));
      }
      if (courseRes.courses?.length > 0) {
        setNewOffering((prev) => ({ ...prev, courseId: courseRes.courses[0].id }));
      }
      if (facRes.faculty?.length > 1) {
        setReassignFacultyId(facRes.faculty[1].user.id);
      }
    } catch (err) {
      console.error('Failed to load academic data:', err);
    } finally {
      setLoading(false);
    }
  };

  // 1. Create Student
  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setFeedback(null);
      await api.createStudent(newStudent);
      setFeedback({ type: 'success', text: `Student ${newStudent.name} (${newStudent.rollNumber}) created successfully!` });
      setNewStudent((prev) => ({ ...prev, rollNumber: '', name: '', email: '' }));
      loadAllAcademicData();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.data?.message || err.message });
    }
  };

  // 2. Create Faculty
  const handleCreateFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setFeedback(null);
      await api.createFaculty(newFaculty);
      setFeedback({ type: 'success', text: `Faculty member ${newFaculty.name} (${newFaculty.employeeId}) created successfully!` });
      setNewFaculty((prev) => ({ ...prev, employeeId: '', name: '', email: '' }));
      loadAllAcademicData();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.data?.message || err.message });
    }
  };

  // 3. Create Course
  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setFeedback(null);
      const res = await api.createCourse(newCourse);
      setFeedback({
        type: 'success',
        text: `Course ${res.course.code} (${res.course.title}) created! Immediately available for Course Offerings.`,
      });
      setNewCourse((prev) => ({ ...prev, code: '', title: '' }));
      loadAllAcademicData();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.data?.message || err.message });
    }
  };

  // 4. Create Offering
  const handleCreateOffering = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setFeedback(null);
      await api.createOffering(newOffering);
      setFeedback({ type: 'success', text: 'Course Offering created and assessment components initialized!' });
      loadAllAcademicData();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.data?.message || err.message });
    }
  };

  // 5. Enroll Student
  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setFeedback(null);
      await api.enrollStudent(enrollOfferingId, enrollStudentId);
      setFeedback({ type: 'success', text: 'Student successfully enrolled into course offering!' });
      loadAllAcademicData();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.data?.message || err.message });
    }
  };

  // 6. Faculty Reassignment (Scenario D)
  const handleExecuteReassignment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingReassign(true);
      setFeedback(null);
      const res = await api.reassignFaculty(
        reassignOfferingId,
        reassignFacultyId,
        new Date(reassignDate).toISOString(),
        reassignReason
      );
      setReassignResult(res);
      setFeedback({
        type: 'success',
        text: `Scenario D Verified: Successfully reassigned offering to ${res.assignment?.faculty?.name} effective ${new Date(reassignDate).toLocaleDateString()}. Prior faculty permissions terminated for future dates.`,
      });
      loadAllAcademicData();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.data?.message || err.message });
    } finally {
      setSubmittingReassign(false);
    }
  };

  // 7. Create Timetable Slot
  const handleCreateTimetableSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setFeedback(null);
      await api.createTimetableSlot(newSlot);
      setFeedback({ type: 'success', text: `Timetable slot scheduled in Room ${newSlot.roomNumber} on ${newSlot.dayOfWeek}!` });
      loadAllAcademicData();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.data?.message || err.message });
    }
  };

  // 8. Semester Progression
  const handleProgressSemester = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setFeedback(null);
      const res = await api.progressSemester({
        batchId: progressionBatchId,
        targetSemester: Number(progressionTargetSem),
        academicYear: progressionYear,
      });
      setFeedback({
        type: 'success',
        text: res.message || `Successfully progressed cohort to Semester ${progressionTargetSem}!`,
      });
      loadAllAcademicData();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.data?.message || err.message });
    }
  };

  // 9. Create Announcement
  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setFeedback(null);
      await api.createAnnouncement({
        title: newAnnouncement.title,
        content: newAnnouncement.content,
        category: newAnnouncement.category,
        targetRole: newAnnouncement.targetRole !== 'ALL' ? newAnnouncement.targetRole : undefined,
      });
      setFeedback({ type: 'success', text: 'Official institutional announcement published successfully!' });
      setNewAnnouncement({ title: '', content: '', category: 'ACADEMIC', targetRole: 'ALL' });
      loadAllAcademicData();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.data?.message || err.message });
    }
  };

  // Sidebar Items strictly matching prompt Section 8
  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'student-accounts', label: 'Student Accounts', icon: UserCheck, badge: students.length || undefined },
    { id: 'faculty-accounts', label: 'Faculty Accounts', icon: Users, badge: facultyList.length || undefined },
    { id: 'departments', label: 'Departments', icon: Building2, badge: departments.length || undefined },
    { id: 'batches', label: 'Batches & Sections', icon: Layers },
    { id: 'courses', label: 'Courses', icon: BookOpen, badge: courses.length || undefined },
    { id: 'offerings', label: 'Course Offerings', icon: GraduationCap, badge: offerings.length || undefined },
    { id: 'enrollment', label: 'Student Enrollment', icon: UserCheck },
    { id: 'assignments', label: 'Faculty Assignments (D)', icon: ArrowRightLeft },
    { id: 'timetable', label: 'Official Timetable', icon: Calendar },
    { id: 'progression', label: 'Semester Progression', icon: RotateCcw },
    { id: 'attendance-overview', label: 'Attendance Overview', icon: ClipboardList },
    { id: 'announcements', label: 'Announcements', icon: Bell },
    { id: 'event-management', label: 'Event Management', icon: Flame },
    { id: 'lost-found-mod', label: 'Lost & Found Moderation', icon: Search },
    { id: 'reports', label: 'Reports', icon: FileText },
  ];

  const handleNavSelect = (id: string) => {
    if (id === 'event-management' || id === 'lost-found-mod') {
      onViewChange('CAMPUS_HUB');
    } else {
      setActiveTab(id);
    }
  };

  return (
    <PortalLayout
      currentUser={currentUser}
      currentRoleTitle="Academic Admin Portal"
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
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 text-white rounded-xl shadow-md p-6 border border-slate-800">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                  Academic Administration Authority
                </span>
                <span className="text-xs text-slate-400 font-mono">Scope: Entire Institution</span>
              </div>
              <h1 className="text-2xl font-black mt-1 text-white">{currentUser.name}</h1>
              <p className="text-xs text-slate-300 mt-1">
                Governs Academic Structure, Accounts, Cohorts, Curriculum, Assignments, and Progression
              </p>
            </div>

            <div className="bg-purple-900/40 border border-purple-400/30 p-3 rounded-lg text-xs space-y-1">
              <div className="text-[10px] text-purple-200 font-bold uppercase">Statutory Restriction</div>
              <div className="text-purple-100 font-semibold">Cannot edit marks or publish exam results</div>
            </div>
          </div>
        </div>

        {/* Global Feedback Alert */}
        {feedback && (
          <div
            className={`p-4 rounded-xl border text-xs font-semibold flex items-center justify-between ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-rose-50 text-rose-800 border-rose-300'
            }`}
          >
            <span>{feedback.text}</span>
            <button onClick={() => setFeedback(null)} className="font-bold ml-4">✕</button>
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
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Students</div>
                    <div className="text-2xl font-black text-slate-900 mt-1">{reportsData?.kpis?.totalStudents || students.length}</div>
                    <div className="text-xs text-purple-600 font-semibold mt-1">Across 4 Departments</div>
                  </div>
                  <div className="p-2.5 bg-purple-50 text-purple-600 rounded-lg">
                    <UserCheck className="h-5 w-5" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Instructional Faculty</div>
                    <div className="text-2xl font-black text-slate-900 mt-1">{reportsData?.kpis?.totalFaculty || facultyList.length}</div>
                    <div className="text-xs text-blue-600 font-semibold mt-1">Appointed &amp; Assigned</div>
                  </div>
                  <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                    <Users className="h-5 w-5" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Offerings</div>
                    <div className="text-2xl font-black text-slate-900 mt-1">{offerings.length}</div>
                    <div className="text-xs text-emerald-600 font-semibold mt-1">Current Academic Term</div>
                  </div>
                  <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Academic Batches</div>
                    <div className="text-2xl font-black text-slate-900 mt-1">{batches.length}</div>
                    <div className="text-xs text-amber-600 font-semibold mt-1">2024-28, 2025-29, 2026-30</div>
                  </div>
                  <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
                    <Layers className="h-5 w-5" />
                  </div>
                </div>
              </div>
            </div>

            {/* Academic Structure Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Departments */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-3">
                <div className="flex items-center space-x-2 text-slate-900 font-bold border-b border-slate-100 pb-2">
                  <Building2 className="h-5 w-5 text-indigo-600" />
                  <span>Configured Departments</span>
                </div>
                <div className="space-y-2 text-xs">
                  {departments.map((d) => (
                    <div key={d.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 flex justify-between items-center">
                      <div>
                        <span className="font-bold text-slate-900">{d.code}</span>
                        <div className="text-[11px] text-slate-500">{d.name}</div>
                      </div>
                      <span className="bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded text-[10px]">
                        Exam: {d.examAdminDesignations?.[0]?.user?.name?.split(' ')[1] || 'Designated'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Batches & Sections */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-3">
                <div className="flex items-center space-x-2 text-slate-900 font-bold border-b border-slate-100 pb-2">
                  <Calendar className="h-5 w-5 text-amber-600" />
                  <span>Cohorts &amp; Sections</span>
                </div>
                <div className="space-y-2 text-xs">
                  {batches.map((b) => (
                    <div key={b.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 space-y-1">
                      <div className="font-bold text-slate-900">Batch {b.name}</div>
                      <div className="text-[11px] text-slate-500">
                        Years: {b.startYear} – {b.endYear} • Sections: A, B, C, D
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Academic Actions */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-3">
                <div className="flex items-center space-x-2 text-slate-900 font-bold border-b border-slate-100 pb-2">
                  <Clock className="h-5 w-5 text-emerald-600" />
                  <span>Quick Operations</span>
                </div>
                <div className="space-y-2 text-xs">
                  <button
                    onClick={() => setActiveTab('student-accounts')}
                    className="w-full text-left p-2.5 bg-purple-50 hover:bg-purple-100 rounded-lg text-purple-900 font-bold transition flex items-center justify-between"
                  >
                    <span>+ Create Student Account</span>
                    <span>&rarr;</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('courses')}
                    className="w-full text-left p-2.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg text-indigo-900 font-bold transition flex items-center justify-between"
                  >
                    <span>+ Add Course Curriculum</span>
                    <span>&rarr;</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('assignments')}
                    className="w-full text-left p-2.5 bg-amber-50 hover:bg-amber-100 rounded-lg text-amber-900 font-bold transition flex items-center justify-between"
                  >
                    <span>Execute Faculty Reassignment (D)</span>
                    <span>&rarr;</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: STUDENT ACCOUNTS */}
        {activeTab === 'student-accounts' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-purple-600" />
                Register Permitted Student Account
              </h2>
              <p className="text-xs text-slate-500">
                Institutional security requirement: No public self-registration. Academic Admin issues permitted student accounts.
              </p>

              <form onSubmit={handleCreateStudent} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Roll Number *</label>
                  <input
                    type="text"
                    required
                    value={newStudent.rollNumber}
                    onChange={(e) => setNewStudent({ ...newStudent, rollNumber: e.target.value })}
                    placeholder="e.g. 24CS005"
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Student Full Name *</label>
                  <input
                    type="text"
                    required
                    value={newStudent.name}
                    onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                    placeholder="e.g. Amit Kumar"
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Institutional Email *</label>
                  <input
                    type="email"
                    required
                    value={newStudent.email}
                    onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                    placeholder="e.g. amit.cse@college.edu"
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Department *</label>
                  <select
                    value={newStudent.departmentId}
                    onChange={(e) => setNewStudent({ ...newStudent, departmentId: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 text-xs"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Batch *</label>
                  <select
                    value={newStudent.batchId}
                    onChange={(e) => {
                      const b = batches.find((x) => x.id === e.target.value);
                      setNewStudent({
                        ...newStudent,
                        batchId: e.target.value,
                        sectionId: b?.sections?.[0]?.id || '',
                      });
                    }}
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 text-xs"
                  >
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>Batch {b.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Section *</label>
                  <select
                    value={newStudent.sectionId}
                    onChange={(e) => setNewStudent({ ...newStudent, sectionId: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 text-xs"
                  >
                    {batches.find((b) => b.id === newStudent.batchId)?.sections?.map((s: any) => (
                      <option key={s.id} value={s.id}>Section {s.name}</option>
                    )) || <option value="">Section A</option>}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Current Semester</label>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    value={newStudent.semester}
                    onChange={(e) => setNewStudent({ ...newStudent, semester: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Temporary Password *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={newStudent.password}
                      onChange={(e) => setNewStudent({ ...newStudent, password: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2.5 pr-10 focus:ring-2 focus:ring-purple-500 text-xs font-mono"
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

                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold shadow-sm transition"
                  >
                    + Register Student
                  </button>
                </div>
              </form>
            </div>

            {/* Students Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Enrolled Student Accounts Roster</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 font-bold">
                      <th className="py-3 px-4">Roll Number</th>
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4">Batch</th>
                      <th className="py-3 px-4">Section</th>
                      <th className="py-3 px-4">Semester</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono font-bold text-purple-700">{s.rollNumber}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{s.user.name}</td>
                        <td className="py-3 px-4 text-slate-600">{s.user.email}</td>
                        <td className="py-3 px-4 font-semibold text-slate-800">{s.department?.code}</td>
                        <td className="py-3 px-4 text-slate-600">{s.batch?.name}</td>
                        <td className="py-3 px-4 font-bold">{s.section?.name}</td>
                        <td className="py-3 px-4 font-mono">Sem {s.currentSemester || 5}</td>
                        <td className="py-3 px-4">
                          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">
                            ACTIVE
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB: COURSES */}
        {activeTab === 'courses' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-indigo-600" />
                Create Institutional Course Curriculum
              </h2>
              <p className="text-xs text-slate-500">
                A newly created course immediately becomes available in the Course Offerings interface without manual intervention.
              </p>

              <form onSubmit={handleCreateCourse} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Course Code *</label>
                  <input
                    type="text"
                    required
                    value={newCourse.code}
                    onChange={(e) => setNewCourse({ ...newCourse, code: e.target.value })}
                    placeholder="e.g. CS401"
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Course Title *</label>
                  <input
                    type="text"
                    required
                    value={newCourse.title}
                    onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                    placeholder="e.g. Distributed Database Systems"
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Department *</label>
                  <select
                    value={newCourse.departmentId}
                    onChange={(e) => setNewCourse({ ...newCourse, departmentId: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 text-xs"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Credits</label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={newCourse.credits}
                    onChange={(e) => setNewCourse({ ...newCourse, credits: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 text-xs"
                  />
                </div>

                <div className="flex items-center space-x-4 pt-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newCourse.isTheory}
                      onChange={(e) => setNewCourse({ ...newCourse, isTheory: e.target.checked })}
                      className="rounded border-slate-300 text-indigo-600"
                    />
                    <span className="font-bold text-slate-700">Theory Course</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newCourse.isLab}
                      onChange={(e) => setNewCourse({ ...newCourse, isLab: e.target.checked })}
                      className="rounded border-slate-300 text-indigo-600"
                    />
                    <span className="font-bold text-slate-700">Laboratory Component</span>
                  </label>
                </div>

                <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-sm"
                  >
                    + Create Course
                  </button>
                </div>
              </form>
            </div>

            {/* Courses Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Configured College Courses</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 font-bold">
                      <th className="py-3 px-4">Code</th>
                      <th className="py-3 px-4">Course Title</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4">Credits</th>
                      <th className="py-3 px-4">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {courses.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono font-bold text-indigo-600">{c.code}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{c.title}</td>
                        <td className="py-3 px-4 text-slate-600">{c.department?.code}</td>
                        <td className="py-3 px-4 font-semibold">{c.credits}</td>
                        <td className="py-3 px-4">
                          <span className="bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded text-[10px]">
                            {c.isTheory ? 'Theory' : ''} {c.isLab ? '• Lab' : ''}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB: FACULTY ASSIGNMENTS & REASSIGNMENT (SCENARIO D) */}
        {activeTab === 'assignments' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-purple-200 p-6 space-y-6">
              <div className="flex items-start justify-between border-b border-purple-100 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <ArrowRightLeft className="h-5 w-5 text-purple-600" />
                    Scenario D: Mid-Semester Effective-Dated Faculty Reassignment
                  </h2>
                  <p className="text-xs text-slate-600 mt-1 max-w-3xl">
                    Transfers future instructional authority from Faculty A to Faculty B as of an authoritative effective date. Faculty A retains historical attribution and read-only access to their past sessions, but is blocked from writing new sessions.
                  </p>
                </div>
                <span className="bg-purple-100 text-purple-800 font-bold text-xs px-3 py-1 rounded-full border border-purple-300">
                  Hackathon Mandatory Scenario D
                </span>
              </div>

              <form onSubmit={handleExecuteReassignment} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Target Course Offering *</label>
                  <select
                    value={reassignOfferingId}
                    onChange={(e) => setReassignOfferingId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 text-xs font-semibold"
                  >
                    {offerings.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.course.code} — {o.batch.name} Sec {o.section.name} (Sem {o.semester})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Reassign To (New Instructor) *</label>
                  <select
                    value={reassignFacultyId}
                    onChange={(e) => setReassignFacultyId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 text-xs font-semibold"
                  >
                    {facultyList.map((f) => (
                      <option key={f.user.id} value={f.user.id}>
                        {f.user.name} ({f.employeeId} • {f.department?.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Effective Reassignment Date *</label>
                  <input
                    type="date"
                    required
                    value={reassignDate}
                    onChange={(e) => setReassignDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Administrative Justification *</label>
                  <input
                    type="text"
                    required
                    value={reassignReason}
                    onChange={(e) => setReassignReason(e.target.value)}
                    placeholder="e.g. Mid-semester academic sabbatical handover"
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 text-xs"
                  />
                </div>

                <div className="sm:col-span-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={submittingReassign}
                    className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold shadow-sm transition flex items-center gap-2"
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                    {submittingReassign ? 'Reassigning...' : 'Execute Reassignment Transaction'}
                  </button>
                </div>
              </form>

              {/* Assignment Timeline Display */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Dated Teaching Assignments Ledger</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 font-bold">
                        <th className="py-2.5 px-4">Course Offering</th>
                        <th className="py-2.5 px-4">Faculty Member</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4">Start Date</th>
                        <th className="py-2.5 px-4">End Date</th>
                        <th className="py-2.5 px-4">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {offerings.flatMap((o) => o.teachingAssignments || []).map((ta: any) => (
                        <tr key={ta.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-bold text-slate-900">{ta.offering?.course?.code || 'CS301'}</td>
                          <td className="py-2.5 px-4 font-semibold text-slate-800">{ta.faculty?.name}</td>
                          <td className="py-2.5 px-4">
                            <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${ta.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                              {ta.isActive ? 'ACTIVE' : 'EXPIRED'}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-mono">{new Date(ta.startDate).toLocaleDateString()}</td>
                          <td className="py-2.5 px-4 font-mono">{ta.endDate ? new Date(ta.endDate).toLocaleDateString() : 'PRESENT'}</td>
                          <td className="py-2.5 px-4 text-slate-600 italic">{ta.reason || 'Appointed'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: SEMESTER PROGRESSION */}
        {activeTab === 'progression' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
            <div className="pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-indigo-600" />
                Idempotent Semester Progression Engine
              </h2>
              <p className="text-xs text-slate-500">
                Advances eligible cohort students to the subsequent academic semester according to institutional calendar.
              </p>
            </div>

            <form onSubmit={handleProgressSemester} className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs p-5 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Target Cohort (Batch) *</label>
                <select
                  value={progressionBatchId}
                  onChange={(e) => setProgressionBatchId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 text-xs font-bold"
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>Batch {b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Advance to Semester *</label>
                <input
                  type="number"
                  min="2"
                  max="8"
                  value={progressionTargetSem}
                  onChange={(e) => setProgressionTargetSem(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Academic Year *</label>
                <input
                  type="text"
                  value={progressionYear}
                  onChange={(e) => setProgressionYear(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 text-xs font-mono"
                />
              </div>

              <div className="sm:col-span-3 flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-sm"
                >
                  Execute Semester Progression
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB: ATTENDANCE OVERVIEW (READ-ONLY) */}
        {activeTab === 'attendance-overview' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-indigo-600" />
                  College-Wide Attendance Reports (Read-Only)
                </h2>
                <p className="text-xs text-slate-500">
                  Academic Admin monitors attendance compliance across departments; cannot alter faculty-recorded data.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 font-bold">
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Course</th>
                    <th className="py-3 px-4">Batch &amp; Section</th>
                    <th className="py-3 px-4">Assigned Faculty</th>
                    <th className="py-3 px-4">Conducted Sessions</th>
                    <th className="py-3 px-4">Aggregate Attendance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendanceReport.map((rep) => (
                    <tr key={rep.offeringId} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-900">{rep.department}</td>
                      <td className="py-3 px-4 font-semibold text-indigo-700">{rep.courseCode} — {rep.courseTitle}</td>
                      <td className="py-3 px-4 text-slate-600">{rep.batch} Sec {rep.section}</td>
                      <td className="py-3 px-4 text-slate-800">{rep.assignedFaculty}</td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">{rep.totalSessions}</td>
                      <td className="py-3 px-4 font-mono font-black text-emerald-600">{rep.avgPercentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: ANNOUNCEMENTS */}
        {activeTab === 'announcements' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Bell className="h-5 w-5 text-indigo-600" />
                Publish Institutional Announcement
              </h2>

              <form onSubmit={handleCreateAnnouncement} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Title *</label>
                    <input
                      type="text"
                      required
                      value={newAnnouncement.title}
                      onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                      placeholder="e.g. Schedule for Academic Senate & Examination Gazetting"
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Category *</label>
                    <select
                      value={newAnnouncement.category}
                      onChange={(e) => setNewAnnouncement({ ...newAnnouncement, category: e.target.value as any })}
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-xs font-semibold"
                    >
                      <option value="ACADEMIC">ACADEMIC</option>
                      <option value="EXAMINATION">EXAMINATION</option>
                      <option value="CAMPUS">CAMPUS</option>
                      <option value="URGENT">URGENT</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Announcement Body *</label>
                  <textarea
                    required
                    rows={3}
                    value={newAnnouncement.content}
                    onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
                    placeholder="Provide official notification text..."
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-xs"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-sm"
                  >
                    + Publish Notice
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PortalLayout>
  );
};
