import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { PortalLayout, NavItem } from '../components/PortalLayout';
import { CampusHub } from './CampusHub';
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
  AlertTriangle,
  UserX
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

  // Department State
  const [newDepartment, setNewDepartment] = useState({
    code: '',
    name: '',
  });
  const [submittingDept, setSubmittingDept] = useState<boolean>(false);

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
    imageData: '',
  });

  // Timetable Hierarchy Filtering State
  const [timetableDeptFilter, setTimetableDeptFilter] = useState<string>('ALL');
  const [timetableBatchFilter, setTimetableBatchFilter] = useState<string>('ALL');
  const [timetableSectionFilter, setTimetableSectionFilter] = useState<string>('ALL');

  // Timetable Hierarchy Creation State (Slot Schedule Form)
  const [slotDeptFilter, setSlotDeptFilter] = useState<string>('ALL');
  const [slotBatchFilter, setSlotBatchFilter] = useState<string>('ALL');
  const [slotSectionFilter, setSlotSectionFilter] = useState<string>('ALL');

  // Account Status Filtering & Toggling State
  const [studentFilterStatus, setStudentFilterStatus] = useState<'ALL' | 'ACTIVE' | 'DEACTIVATED'>('ALL');
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [facultyFilterStatus, setFacultyFilterStatus] = useState<'ALL' | 'ACTIVE' | 'DEACTIVATED'>('ALL');
  const [facultySearch, setFacultySearch] = useState<string>('');
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);

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

  // Toggle Student Account Status (Active / Deactivated)
  const handleToggleStudentStatus = async (student: any) => {
    const currentActive = student.user?.isActive !== false;
    const newActive = !currentActive;
    const confirmText = newActive
      ? `Reactivate account for student ${student.user?.name} (${student.rollNumber})?\n\nThis will restore their student portal login access and permissions.`
      : `DEACTIVATE student account for ${student.user?.name} (${student.rollNumber})?\n\nThis will immediately revoke their portal access, terminate active sessions, and prevent new logins.`;

    if (!window.confirm(confirmText)) return;

    try {
      setTogglingUserId(student.id);
      setFeedback(null);
      const res = await api.toggleStudentStatus(student.id, newActive);
      setFeedback({
        type: 'success',
        text: res.message || `Student ${student.user?.name} status updated to ${newActive ? 'Active' : 'Deactivated'}.`,
      });
      loadAllAcademicData();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.data?.message || err.message });
    } finally {
      setTogglingUserId(null);
    }
  };

  // Toggle Faculty Account Status (Active / Deactivated)
  const handleToggleFacultyStatus = async (faculty: any) => {
    const currentActive = faculty.user?.isActive !== false;
    const newActive = !currentActive;
    const confirmText = newActive
      ? `Reactivate account for faculty member ${faculty.user?.name} (${faculty.employeeId})?\n\nThis will restore their faculty portal login and teaching permissions.`
      : `DEACTIVATE faculty account for ${faculty.user?.name} (${faculty.employeeId})?\n\nThis will immediately revoke portal access and terminate any active course teaching assignments.`;

    if (!window.confirm(confirmText)) return;

    try {
      setTogglingUserId(faculty.id);
      setFeedback(null);
      const res = await api.toggleFacultyStatus(faculty.id, newActive);
      setFeedback({
        type: 'success',
        text: res.message || `Faculty ${faculty.user?.name} status updated to ${newActive ? 'Active' : 'Deactivated'}.`,
      });
      loadAllAcademicData();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.data?.message || err.message });
    } finally {
      setTogglingUserId(null);
    }
  };

  // Create Department Handler
  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingDept(true);
      setFeedback(null);
      await api.createDepartment(newDepartment);
      setFeedback({
        type: 'success',
        text: `Department ${newDepartment.code.toUpperCase()} (${newDepartment.name}) created successfully! Sections A, B, C, D initialized across all batches.`,
      });
      setNewDepartment({ code: '', name: '' });
      loadAllAcademicData();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.data?.message || err.message });
    } finally {
      setSubmittingDept(false);
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
    if (!newSlot.offeringId) {
      setFeedback({
        type: 'error',
        text: 'Please select a valid Course Offering for the designated Branch, Academic Batch, and Section.',
      });
      return;
    }
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
      const res = await api.createAnnouncement({
        title: newAnnouncement.title,
        content: newAnnouncement.content,
        category: newAnnouncement.category,
        targetRole: newAnnouncement.targetRole !== 'ALL' ? newAnnouncement.targetRole : undefined,
        imageData: newAnnouncement.imageData || undefined,
      });
      setFeedback({ type: 'success', text: 'Official institutional announcement published successfully! Broadcast across all portals.' });
      setNewAnnouncement({ title: '', content: '', category: 'ACADEMIC', targetRole: 'ALL', imageData: '' });
      if (res?.announcement) {
        setAnnouncements((prev) => [res.announcement, ...prev]);
      }
      loadAllAcademicData();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.data?.message || err.message });
    }
  };

  const filteredStudents = students.filter((s) => {
    const isActive = s.user?.isActive !== false;
    if (studentFilterStatus === 'ACTIVE' && !isActive) return false;
    if (studentFilterStatus === 'DEACTIVATED' && isActive) return false;
    if (studentSearch.trim()) {
      const q = studentSearch.toLowerCase();
      const matchRoll = s.rollNumber?.toLowerCase().includes(q);
      const matchName = s.user?.name?.toLowerCase().includes(q);
      const matchEmail = s.user?.email?.toLowerCase().includes(q);
      const matchDept = s.department?.code?.toLowerCase().includes(q);
      return matchRoll || matchName || matchEmail || matchDept;
    }
    return true;
  });

  const studentActiveCount = students.filter((s) => s.user?.isActive !== false).length;
  const studentDeactivatedCount = students.length - studentActiveCount;

  const filteredFaculty = facultyList.filter((f) => {
    const isActive = f.user?.isActive !== false;
    if (facultyFilterStatus === 'ACTIVE' && !isActive) return false;
    if (facultyFilterStatus === 'DEACTIVATED' && isActive) return false;
    if (facultySearch.trim()) {
      const q = facultySearch.toLowerCase();
      const matchEmp = f.employeeId?.toLowerCase().includes(q);
      const matchName = f.user?.name?.toLowerCase().includes(q);
      const matchEmail = f.user?.email?.toLowerCase().includes(q);
      const matchDept = f.department?.code?.toLowerCase().includes(q);
      return matchEmp || matchName || matchEmail || matchDept;
    }
    return true;
  });

  const facultyActiveCount = facultyList.filter((f) => f.user?.isActive !== false).length;
  const facultyDeactivatedCount = facultyList.length - facultyActiveCount;

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
    setActiveTab(id);
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Enrolled Student Accounts Roster</h3>
                  <p className="text-xs text-slate-500">
                    Total: {students.length} students &bull; Active: {studentActiveCount} &bull; Deactivated: {studentDeactivatedCount}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex p-1 bg-slate-100 rounded-lg text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setStudentFilterStatus('ALL')}
                      className={`px-3 py-1 rounded-md transition ${studentFilterStatus === 'ALL' ? 'bg-white text-purple-700 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      All ({students.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStudentFilterStatus('ACTIVE')}
                      className={`px-3 py-1 rounded-md transition ${studentFilterStatus === 'ACTIVE' ? 'bg-white text-emerald-700 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      Active ({studentActiveCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStudentFilterStatus('DEACTIVATED')}
                      className={`px-3 py-1 rounded-md transition ${studentFilterStatus === 'DEACTIVATED' ? 'bg-white text-rose-700 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      Deactivated ({studentDeactivatedCount})
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search students..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs w-48 focus:ring-2 focus:ring-purple-500"
                    />
                    <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  </div>
                </div>
              </div>

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
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-400 text-xs font-semibold">
                          No student accounts found matching selected criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((s) => {
                        const isActive = s.user?.isActive !== false;
                        const isToggling = togglingUserId === s.id;

                        return (
                          <tr key={s.id} className={`hover:bg-slate-50 transition ${!isActive ? 'bg-rose-50/20' : ''}`}>
                            <td className="py-3 px-4 font-mono font-bold text-purple-700">{s.rollNumber}</td>
                            <td className="py-3 px-4 font-bold text-slate-900">
                              {s.user.name}
                              {!isActive && <span className="ml-1.5 text-[10px] text-rose-600 font-normal">(Deactivated)</span>}
                            </td>
                            <td className="py-3 px-4 text-slate-600">{s.user.email}</td>
                            <td className="py-3 px-4 font-semibold text-slate-800">{s.department?.code}</td>
                            <td className="py-3 px-4 text-slate-600">{s.batch?.name}</td>
                            <td className="py-3 px-4 font-bold">{s.section?.name}</td>
                            <td className="py-3 px-4 font-mono">Sem {s.currentSemester || 1}</td>
                            <td className="py-3 px-4">
                              {isActive ? (
                                <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                                  ACTIVE
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                                  DEACTIVATED
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {isActive ? (
                                <button
                                  type="button"
                                  onClick={() => handleToggleStudentStatus(s)}
                                  disabled={isToggling}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition disabled:opacity-50"
                                  title="Deactivate student account (revoke portal access)"
                                >
                                  <UserX className="h-3 w-3" />
                                  {isToggling ? 'Updating...' : 'Deactivate'}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleToggleStudentStatus(s)}
                                  disabled={isToggling}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition disabled:opacity-50"
                                  title="Reactivate student account"
                                >
                                  <UserCheck className="h-3 w-3" />
                                  {isToggling ? 'Updating...' : 'Reactivate'}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB: FACULTY ACCOUNTS */}
        {activeTab === 'faculty-accounts' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-600" />
                Provision New Faculty Account
              </h2>
              <p className="text-xs text-slate-500">
                Institutional security requirement: Academic Admin provisions official faculty credentials with department affiliation.
              </p>

              <form onSubmit={handleCreateFaculty} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Employee ID *</label>
                  <input
                    type="text"
                    required
                    value={newFaculty.employeeId}
                    onChange={(e) => setNewFaculty({ ...newFaculty, employeeId: e.target.value })}
                    placeholder="e.g. FAC-CSE-003"
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Faculty Full Name *</label>
                  <input
                    type="text"
                    required
                    value={newFaculty.name}
                    onChange={(e) => setNewFaculty({ ...newFaculty, name: e.target.value })}
                    placeholder="e.g. Dr. Claude Shannon"
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Institutional Email *</label>
                  <input
                    type="email"
                    required
                    value={newFaculty.email}
                    onChange={(e) => setNewFaculty({ ...newFaculty, email: e.target.value })}
                    placeholder="e.g. claude.shannon@college.edu"
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Initial Password *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={newFaculty.password}
                      onChange={(e) => setNewFaculty({ ...newFaculty, password: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2.5 pr-9 focus:ring-2 focus:ring-indigo-500 text-xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Department *</label>
                  <select
                    value={newFaculty.departmentId}
                    onChange={(e) => setNewFaculty({ ...newFaculty, departmentId: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 text-xs"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code} — {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Designation *</label>
                  <select
                    value={newFaculty.designation}
                    onChange={(e) => setNewFaculty({ ...newFaculty, designation: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 text-xs"
                  >
                    <option value="Professor">Professor</option>
                    <option value="Associate Professor">Associate Professor</option>
                    <option value="Assistant Professor">Assistant Professor</option>
                    <option value="Lecturer">Lecturer</option>
                  </select>
                </div>

                <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-sm flex items-center gap-2"
                  >
                    <Users className="h-4 w-4" />
                    Provision Faculty Account
                  </button>
                </div>
              </form>
            </div>

            {/* Faculty Accounts Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Registered Faculty Directory</h3>
                  <p className="text-xs text-slate-500">
                    Total: {facultyList.length} faculty &bull; Active: {facultyActiveCount} &bull; Deactivated: {facultyDeactivatedCount}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex p-1 bg-slate-100 rounded-lg text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setFacultyFilterStatus('ALL')}
                      className={`px-3 py-1 rounded-md transition ${facultyFilterStatus === 'ALL' ? 'bg-white text-indigo-700 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      All ({facultyList.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFacultyFilterStatus('ACTIVE')}
                      className={`px-3 py-1 rounded-md transition ${facultyFilterStatus === 'ACTIVE' ? 'bg-white text-emerald-700 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      Active ({facultyActiveCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFacultyFilterStatus('DEACTIVATED')}
                      className={`px-3 py-1 rounded-md transition ${facultyFilterStatus === 'DEACTIVATED' ? 'bg-white text-rose-700 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      Deactivated ({facultyDeactivatedCount})
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search faculty..."
                      value={facultySearch}
                      onChange={(e) => setFacultySearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs w-48 focus:ring-2 focus:ring-indigo-500"
                    />
                    <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 font-bold">
                      <th className="py-3 px-4">Employee ID</th>
                      <th className="py-3 px-4">Faculty Name</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4">Designation</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredFaculty.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 text-xs font-semibold">
                          No faculty accounts found matching selected criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredFaculty.map((f) => {
                        const isActive = f.user?.isActive !== false;
                        const isToggling = togglingUserId === f.id;

                        return (
                          <tr key={f.id} className={`hover:bg-slate-50 transition ${!isActive ? 'bg-rose-50/20' : ''}`}>
                            <td className="py-3 px-4 font-mono font-bold text-indigo-700">{f.employeeId}</td>
                            <td className="py-3 px-4 font-bold text-slate-900">
                              {f.user?.name}
                              {!isActive && <span className="ml-1.5 text-[10px] text-rose-600 font-normal">(Deactivated)</span>}
                            </td>
                            <td className="py-3 px-4 text-slate-600">{f.user?.email}</td>
                            <td className="py-3 px-4 font-semibold text-slate-800">{f.department?.code}</td>
                            <td className="py-3 px-4 text-slate-600">{f.designation}</td>
                            <td className="py-3 px-4">
                              {isActive ? (
                                <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                                  ACTIVE
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                                  DEACTIVATED
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {isActive ? (
                                <button
                                  type="button"
                                  onClick={() => handleToggleFacultyStatus(f)}
                                  disabled={isToggling}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition disabled:opacity-50"
                                  title="Deactivate faculty account (revoke portal access and teaching assignments)"
                                >
                                  <UserX className="h-3 w-3" />
                                  {isToggling ? 'Updating...' : 'Deactivate'}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleToggleFacultyStatus(f)}
                                  disabled={isToggling}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition disabled:opacity-50"
                                  title="Reactivate faculty account"
                                >
                                  <UserCheck className="h-3 w-3" />
                                  {isToggling ? 'Updating...' : 'Reactivate'}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB: DEPARTMENTS */}
        {activeTab === 'departments' && (
          <div className="space-y-6">
            {/* Create Department Form */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-indigo-600" />
                Add New Academic Department
              </h2>
              <p className="text-xs text-slate-500">
                Register authorized academic departments. Standard Sections A, B, C, D will automatically be initialized across all batches.
              </p>

              <form onSubmit={handleCreateDepartment} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Department Code *</label>
                  <input
                    type="text"
                    required
                    value={newDepartment.code}
                    onChange={(e) => setNewDepartment({ ...newDepartment, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. MECH, AIDS, ECE"
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 text-xs font-mono font-bold uppercase"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Unique 2-10 letter uppercase abbreviation</span>
                </div>

                <div className="sm:col-span-1 lg:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Department Full Name *</label>
                  <input
                    type="text"
                    required
                    value={newDepartment.name}
                    onChange={(e) => setNewDepartment({ ...newDepartment, name: e.target.value })}
                    placeholder="e.g. Mechanical Engineering"
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 text-xs font-bold"
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
                  <button
                    type="submit"
                    disabled={submittingDept}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-sm flex items-center gap-2 disabled:opacity-50"
                  >
                    <PlusCircle className="h-4 w-4" />
                    {submittingDept ? 'Creating Department...' : 'Create Department'}
                  </button>
                </div>
              </form>
            </div>

            {/* Configured Departments List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-slate-900">Configured Academic Departments ({departments.length})</h3>
                <span className="text-xs text-indigo-600 font-semibold">Institutional Scope Active</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {departments.map((d) => (
                  <div key={d.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 hover:border-indigo-300 transition">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-black font-mono bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">
                        {d.code}
                      </span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                        Active
                      </span>
                    </div>
                    <div className="font-bold text-sm text-slate-900">{d.name}</div>
                    <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-100 flex justify-between">
                      <span>Sections:</span>
                      <span className="font-semibold text-slate-700">A, B, C, D</span>
                    </div>
                    {d.examAdminDesignations?.length > 0 && (
                      <div className="text-[11px] text-slate-500 flex justify-between">
                        <span>Exam Admin:</span>
                        <span className="font-semibold text-purple-700">{d.examAdminDesignations[0]?.user?.name || 'Assigned'}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB: BATCHES & SECTIONS */}
        {activeTab === 'batches' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Layers className="h-5 w-5 text-indigo-600" />
                Configured Batches & Cohort Sections
              </h2>
              <p className="text-xs text-slate-500">
                Institutional batches spanning 4-year engineering curriculum with standard Sections A through D per department.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {batches.map((b) => (
                  <div key={b.id} className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                      <span className="text-base font-black text-slate-900">{b.name}</span>
                      <span className="text-xs font-mono text-indigo-600 font-bold">{b.startYear} – {b.endYear}</span>
                    </div>
                    <div className="text-xs font-bold text-slate-600">Configured Sections:</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {['Section A', 'Section B', 'Section C', 'Section D'].map((sec) => (
                        <div key={sec} className="p-2 bg-white rounded border border-slate-200 text-center font-semibold text-slate-700">
                          {sec}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
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

        {/* TAB: COURSE OFFERINGS */}
        {activeTab === 'offerings' && (
          <div className="space-y-6">
            {/* Create Offering Form */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-indigo-600" />
                Initialize Course Offering
              </h2>
              <p className="text-xs text-slate-500">
                Instantiate a course offering for an academic year, batch, and section with internal/external assessment components.
              </p>

              <form onSubmit={handleCreateOffering} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Course *</label>
                  <select
                    value={newOffering.courseId}
                    onChange={(e) => setNewOffering({ ...newOffering, courseId: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 text-xs"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.title} ({c.department?.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Batch *</label>
                  <select
                    value={newOffering.batchId}
                    onChange={(e) => {
                      const b = batches.find((x) => x.id === e.target.value);
                      setNewOffering({
                        ...newOffering,
                        batchId: e.target.value,
                        sectionId: b?.sections?.[0]?.id || '',
                      });
                    }}
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 text-xs"
                  >
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Section *</label>
                  <select
                    value={newOffering.sectionId}
                    onChange={(e) => setNewOffering({ ...newOffering, sectionId: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 text-xs"
                  >
                    {batches
                      .find((b) => b.id === newOffering.batchId)
                      ?.sections?.map((s: any) => (
                        <option key={s.id} value={s.id}>
                          Section {s.name}
                        </option>
                      )) || (
                      <option value="">Select Section</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Semester *</label>
                  <select
                    value={newOffering.semester}
                    onChange={(e) => setNewOffering({ ...newOffering, semester: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 text-xs"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                      <option key={sem} value={sem}>
                        Semester {sem}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Academic Year *</label>
                  <input
                    type="text"
                    required
                    value={newOffering.academicYear}
                    onChange={(e) => setNewOffering({ ...newOffering, academicYear: e.target.value })}
                    placeholder="2024-2025"
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 text-xs"
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-sm flex items-center gap-2"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Initialize Offering
                  </button>
                </div>
              </form>
            </div>

            {/* Offerings Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-900">Active Course Offerings ({offerings.length})</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 font-bold">
                      <th className="py-3 px-4">Course</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4">Batch</th>
                      <th className="py-3 px-4">Section</th>
                      <th className="py-3 px-4">Semester</th>
                      <th className="py-3 px-4">Assigned Faculty</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {offerings.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-indigo-700">{o.course?.code} — {o.course?.title}</td>
                        <td className="py-3 px-4 font-semibold text-slate-800">{o.course?.department?.code}</td>
                        <td className="py-3 px-4 text-slate-600">{o.batch?.name}</td>
                        <td className="py-3 px-4 font-bold">Sec {o.section?.name}</td>
                        <td className="py-3 px-4 font-mono">Sem {o.semester}</td>
                        <td className="py-3 px-4 text-slate-800">
                          {o.teachingAssignments?.[0]?.faculty?.name || (
                            <span className="text-amber-600 italic">Unassigned</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">
                            OFFERED
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

        {/* TAB: STUDENT ENROLLMENT */}
        {activeTab === 'enrollment' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-indigo-600" />
                Enroll Student into Course Offering
              </h2>
              <p className="text-xs text-slate-500">
                Enroll student into designated offering. Automatically initializes individual assessment marks matrix.
              </p>

              <form onSubmit={handleEnrollStudent} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Target Course Offering *</label>
                  <select
                    value={enrollOfferingId}
                    onChange={(e) => setEnrollOfferingId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 text-xs"
                  >
                    {offerings.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.course?.code} — {o.course?.title} ({o.batch?.name} Sec {o.section?.name})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Eligible Student *</label>
                  <select
                    value={enrollStudentId}
                    onChange={(e) => setEnrollStudentId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 text-xs"
                  >
                    <option value="">Select Student to Enroll</option>
                    {students.map((s) => {
                      const isActive = s.user?.isActive !== false;
                      return (
                        <option key={s.id} value={s.id} disabled={!isActive}>
                          {s.rollNumber} — {s.user?.name} ({s.department?.code}) {!isActive ? '⛔ [DEACTIVATED - Ineligible]' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="sm:col-span-2 flex justify-end">
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-sm flex items-center gap-2"
                  >
                    <UserCheck className="h-4 w-4" />
                    Enroll Student
                  </button>
                </div>
              </form>
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
                    {facultyList.map((f) => {
                      const isActive = f.user?.isActive !== false;
                      return (
                        <option key={f.user.id} value={f.user.id} disabled={!isActive}>
                          {f.user.name} ({f.employeeId} • {f.department?.code}) {!isActive ? '⛔ [DEACTIVATED - Ineligible]' : ''}
                        </option>
                      );
                    })}
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

        {/* TAB: OFFICIAL TIMETABLE */}
        {activeTab === 'timetable' && (
          <div className="space-y-6">
            {/* Timetable Branch, Academic Batch, and Section Filter Bar */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-indigo-600" />
                  <h2 className="text-base font-bold text-slate-900">Institutional Timetable Hierarchy Filters</h2>
                </div>
                <div className="text-xs text-slate-500">
                  Separated and organized by Branch (Department), Academic Cohort, and Section
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs pt-1">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Branch (Department)</label>
                  <select
                    value={timetableDeptFilter}
                    onChange={(e) => setTimetableDeptFilter(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 font-semibold bg-white"
                  >
                    <option value="ALL">All Branches / Departments</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.code}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Academic Batch</label>
                  <select
                    value={timetableBatchFilter}
                    onChange={(e) => setTimetableBatchFilter(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 font-semibold bg-white"
                  >
                    <option value="ALL">All Academic Batches</option>
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        Batch {b.name} ({b.startYear}–{b.endYear})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Section</label>
                  <select
                    value={timetableSectionFilter}
                    onChange={(e) => setTimetableSectionFilter(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 font-semibold bg-white"
                  >
                    <option value="ALL">All Sections (A, B, C, D)</option>
                    <option value="A">Section A</option>
                    <option value="B">Section B</option>
                    <option value="C">Section C</option>
                    <option value="D">Section D</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => {
                      setTimetableDeptFilter('ALL');
                      setTimetableBatchFilter('ALL');
                      setTimetableSectionFilter('ALL');
                    }}
                    className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs transition"
                  >
                    Reset Hierarchy Filters
                  </button>
                </div>
              </div>
            </div>

            {/* Schedule Slot Form */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <PlusCircle className="h-4 w-4 text-indigo-600" />
                  Schedule New Timetable Slot
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Select the Department/Branch, Academic Year Cohort, and Section to allocate timetable periods and classroom assignments.
                </p>
              </div>

              {/* Hierarchy Selection Bar for New Slot */}
              <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-3">
                <div className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider">
                  Target Hierarchy (Branch, Academic Year &amp; Section)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Target Branch (Department)</label>
                    <select
                      value={slotDeptFilter}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSlotDeptFilter(val);
                        // Also pre-select matching offering if available
                        const matching = offerings.filter((o) => {
                          const deptMatch = val === 'ALL' || o.course?.departmentId === val || o.course?.department?.code === val;
                          const batchMatch = slotBatchFilter === 'ALL' || o.batchId === slotBatchFilter || o.batch?.id === slotBatchFilter;
                          const secMatch = slotSectionFilter === 'ALL' || o.section?.name === slotSectionFilter;
                          return deptMatch && batchMatch && secMatch;
                        });
                        if (matching.length > 0) {
                          setNewSlot((prev) => ({ ...prev, offeringId: matching[0].id }));
                        }
                      }}
                      className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 text-xs bg-white font-medium"
                    >
                      <option value="ALL">All Branches / Departments</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.code}>
                          {d.name} ({d.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Target Academic Year / Batch</label>
                    <select
                      value={slotBatchFilter}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSlotBatchFilter(val);
                        const matching = offerings.filter((o) => {
                          const deptMatch = slotDeptFilter === 'ALL' || o.course?.departmentId === slotDeptFilter || o.course?.department?.code === slotDeptFilter;
                          const batchMatch = val === 'ALL' || o.batchId === val || o.batch?.id === val;
                          const secMatch = slotSectionFilter === 'ALL' || o.section?.name === slotSectionFilter;
                          return deptMatch && batchMatch && secMatch;
                        });
                        if (matching.length > 0) {
                          setNewSlot((prev) => ({ ...prev, offeringId: matching[0].id }));
                        }
                      }}
                      className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 text-xs bg-white font-medium"
                    >
                      <option value="ALL">All Academic Batches</option>
                      {batches.map((b) => (
                        <option key={b.id} value={b.id}>
                          Batch {b.name} ({b.startYear}–{b.endYear})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Target Section</label>
                    <select
                      value={slotSectionFilter}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSlotSectionFilter(val);
                        const matching = offerings.filter((o) => {
                          const deptMatch = slotDeptFilter === 'ALL' || o.course?.departmentId === slotDeptFilter || o.course?.department?.code === slotDeptFilter;
                          const batchMatch = slotBatchFilter === 'ALL' || o.batchId === slotBatchFilter || o.batch?.id === slotBatchFilter;
                          const secMatch = val === 'ALL' || o.section?.name === val;
                          return deptMatch && batchMatch && secMatch;
                        });
                        if (matching.length > 0) {
                          setNewSlot((prev) => ({ ...prev, offeringId: matching[0].id }));
                        }
                      }}
                      className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 text-xs bg-white font-medium"
                    >
                      <option value="ALL">All Sections (A, B, C, D)</option>
                      <option value="A">Section A</option>
                      <option value="B">Section B</option>
                      <option value="C">Section C</option>
                      <option value="D">Section D</option>
                    </select>
                  </div>
                </div>
              </div>

              <form onSubmit={handleCreateTimetableSlot} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs">
                <div className="sm:col-span-2 lg:col-span-1">
                  <label className="block font-bold text-slate-700 mb-1">Course Offering *</label>
                  {(() => {
                    const matchingOfferings = offerings.filter((o) => {
                      const deptMatch = slotDeptFilter === 'ALL' || o.course?.departmentId === slotDeptFilter || o.course?.department?.code === slotDeptFilter;
                      const batchMatch = slotBatchFilter === 'ALL' || o.batchId === slotBatchFilter || o.batch?.id === slotBatchFilter;
                      const secMatch = slotSectionFilter === 'ALL' || o.section?.name === slotSectionFilter;
                      return deptMatch && batchMatch && secMatch;
                    });

                    return (
                      <select
                        value={newSlot.offeringId}
                        onChange={(e) => setNewSlot({ ...newSlot, offeringId: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 text-xs bg-white font-medium"
                      >
                        {matchingOfferings.length === 0 ? (
                          <option value="">No offerings for selected filters</option>
                        ) : (
                          matchingOfferings.map((o) => (
                            <option key={o.id} value={o.id}>
                              [{o.course?.department?.code || 'CSE'}] {o.course?.code} — {o.course?.title} ({o.batch?.name} Sec {o.section?.name})
                            </option>
                          ))
                        )}
                      </select>
                    );
                  })()}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Day of Week *</label>
                  <select
                    value={newSlot.dayOfWeek}
                    onChange={(e) => setNewSlot({ ...newSlot, dayOfWeek: e.target.value as any })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 text-xs font-bold bg-white"
                  >
                    <option value="MON">Monday</option>
                    <option value="TUE">Tuesday</option>
                    <option value="WED">Wednesday</option>
                    <option value="THU">Thursday</option>
                    <option value="FRI">Friday</option>
                    <option value="SAT">Saturday</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Start Time (Slot Start) *</label>
                  <input
                    type="time"
                    required
                    value={newSlot.startTime}
                    onChange={(e) => setNewSlot({ ...newSlot, startTime: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">End Time (Slot End) *</label>
                  <input
                    type="time"
                    required
                    value={newSlot.endTime}
                    onChange={(e) => setNewSlot({ ...newSlot, endTime: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Classroom / Hall *</label>
                  <input
                    type="text"
                    required
                    value={newSlot.roomNumber}
                    onChange={(e) => setNewSlot({ ...newSlot, roomNumber: e.target.value })}
                    placeholder="LH-101"
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-xs font-bold"
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-5 flex justify-end">
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-sm flex items-center gap-2"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Allocate Timetable Slot
                  </button>
                </div>
              </form>
            </div>

            {/* Hierarchical Timetable Matrix Display */}
            {(() => {
              const filteredSlots = timetableSlots.filter((s) => {
                const deptCode = s.offering?.course?.department?.code;
                const deptId = s.offering?.course?.departmentId || s.offering?.course?.department?.id;
                if (timetableDeptFilter !== 'ALL' && deptCode !== timetableDeptFilter && deptId !== timetableDeptFilter) {
                  return false;
                }
                const batchId = s.offering?.batchId || s.offering?.batch?.id;
                if (timetableBatchFilter !== 'ALL' && batchId !== timetableBatchFilter) {
                  return false;
                }
                const sectionName = s.offering?.section?.name;
                if (timetableSectionFilter !== 'ALL' && sectionName !== timetableSectionFilter) {
                  return false;
                }
                return true;
              });

              // Group filtered slots by: Branch -> Batch -> Section
              const groups: { [key: string]: any[] } = {};
              filteredSlots.forEach((s) => {
                const dept = s.offering?.course?.department?.name || 'Computer Science and Engineering';
                const deptCode = s.offering?.course?.department?.code || 'CSE';
                const batchName = s.offering?.batch?.name || '2024-2028';
                const secName = s.offering?.section?.name || 'A';
                const groupKey = `${deptCode} • Batch ${batchName} • Section ${secName}`;
                if (!groups[groupKey]) {
                  groups[groupKey] = [];
                }
                groups[groupKey].push(s);
              });

              const groupKeys = Object.keys(groups);

              return (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-base font-bold text-slate-900">
                      Weekly Timetable Schedules ({filteredSlots.length} active slots across {groupKeys.length} cohorts)
                    </h3>
                    <span className="text-xs text-indigo-600 font-semibold">Organized by Branch &amp; Section</span>
                  </div>

                  {groupKeys.length === 0 ? (
                    <div className="p-8 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
                      No timetable slots scheduled matching the selected Branch, Batch, or Section filters.
                    </div>
                  ) : (
                    groupKeys.map((groupKey) => {
                      const groupSlots = groups[groupKey];
                      // Sort by Day of Week order and Start Time
                      const dayOrder: { [d: string]: number } = { MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };
                      const sortedSlots = [...groupSlots].sort((a, b) => {
                        const dayDiff = (dayOrder[a.dayOfWeek] || 99) - (dayOrder[b.dayOfWeek] || 99);
                        if (dayDiff !== 0) return dayDiff;
                        return a.startTime.localeCompare(b.startTime);
                      });

                      return (
                        <div key={groupKey} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white px-5 py-3 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-0.5 rounded font-black text-xs bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                                {groupKey.split(' • ')[0]}
                              </span>
                              <span className="font-bold text-sm text-white">
                                {groupKey.split(' • ').slice(1).join(' — ')}
                              </span>
                            </div>
                            <span className="text-xs text-slate-300 font-mono">
                              {sortedSlots.length} Scheduled Periods
                            </span>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                                  <th className="py-3 px-4">Day of Week</th>
                                  <th className="py-3 px-4">Timing Window</th>
                                  <th className="py-3 px-4">Room / Hall</th>
                                  <th className="py-3 px-4">Course Code &amp; Title</th>
                                  <th className="py-3 px-4">Assigned Instructor</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {sortedSlots.map((s) => (
                                  <tr key={s.id} className="hover:bg-slate-50">
                                    <td className="py-3 px-4">
                                      <span className="px-2 py-0.5 rounded font-bold text-xs bg-indigo-50 text-indigo-700 border border-indigo-100">
                                        {s.dayOfWeek}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                                      {s.startTime} – {s.endTime}
                                    </td>
                                    <td className="py-3 px-4 font-bold text-slate-900 bg-slate-50/50">
                                      {s.roomNumber}
                                    </td>
                                    <td className="py-3 px-4 font-semibold text-slate-900">
                                      {s.offering?.course?.code} — {s.offering?.course?.title}
                                    </td>
                                    <td className="py-3 px-4 text-slate-700">
                                      {s.offering?.teachingAssignments?.[0]?.faculty?.name || 'Dr. Alan Turing'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })()}
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
              <p className="text-xs text-slate-500">
                Official notices broadcast across the student, faculty, and administrative portals.
              </p>

              <form onSubmit={handleCreateAnnouncement} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">Notice Headline *</label>
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
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-xs font-semibold bg-white"
                    >
                      <option value="ACADEMIC">ACADEMIC</option>
                      <option value="EXAMINATION">EXAMINATION</option>
                      <option value="CAMPUS">CAMPUS</option>
                      <option value="URGENT">URGENT</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Audience Scope</label>
                    <select
                      value={newAnnouncement.targetRole}
                      onChange={(e) => setNewAnnouncement({ ...newAnnouncement, targetRole: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-xs font-semibold bg-white"
                    >
                      <option value="ALL">Entire Campus (All Users)</option>
                      <option value="STUDENT">Students Only</option>
                      <option value="FACULTY">Faculty Only</option>
                      <option value="EXAM_ADMIN">Examination Authorities Only</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Upload Notification Image / Circular</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setNewAnnouncement({ ...newAnnouncement, imageData: reader.result as string });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    />
                    {newAnnouncement.imageData && (
                      <div className="mt-2 flex items-center gap-3">
                        <div className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200">
                          <img src={newAnnouncement.imageData} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                        <button
                          type="button"
                          onClick={() => setNewAnnouncement({ ...newAnnouncement, imageData: '' })}
                          className="text-xs text-rose-600 hover:underline font-semibold"
                        >
                          Remove Image
                        </button>
                      </div>
                    )}
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
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-sm flex items-center gap-2"
                  >
                    <Send className="h-4 w-4" />
                    Publish Institutional Notice
                  </button>
                </div>
              </form>
            </div>

            {/* Active Notices Feed */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-slate-900">Active Notice Board ({announcements.length})</h3>
                <span className="text-xs text-indigo-600 font-semibold">Broadcast Across All Portals</span>
              </div>
              <div className="space-y-4">
                {announcements.map((ann) => (
                  <div key={ann.id} className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                            ann.category === 'URGENT'
                              ? 'bg-rose-100 text-rose-800'
                              : ann.category === 'EXAMINATION'
                              ? 'bg-amber-100 text-amber-800'
                              : ann.category === 'CAMPUS'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          {ann.category}
                        </span>
                        {ann.targetRole && (
                          <span className="bg-slate-200 text-slate-700 font-semibold px-2 py-0.5 rounded text-[10px]">
                            {ann.targetRole}
                          </span>
                        )}
                      </div>
                      <span className="text-slate-400 font-mono text-[11px]">{new Date(ann.createdAt).toLocaleString()}</span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900">{ann.title}</h4>

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

                    <div className="text-[10px] text-slate-400 pt-2 border-t border-slate-200 flex justify-between items-center">
                      <span>Published by: {ann.createdBy?.name || 'Academic Administration'} • {ann.createdBy?.role || 'ACADEMIC_ADMIN'}</span>
                      <span className="text-emerald-600 font-bold">Active &amp; Visible to All</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB: REPORTS */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-600" />
                Institutional Academic Reports & Compliance KPIs
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                  <div className="text-xs uppercase font-bold text-indigo-600">Total Enrollment</div>
                  <div className="text-2xl font-black text-slate-900 mt-1">{reportsData?.kpis?.totalStudents || students.length}</div>
                </div>
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <div className="text-xs uppercase font-bold text-emerald-600">Teaching Faculty</div>
                  <div className="text-2xl font-black text-slate-900 mt-1">{reportsData?.kpis?.totalFaculty || facultyList.length}</div>
                </div>
                <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl">
                  <div className="text-xs uppercase font-bold text-purple-600">Academic Programs</div>
                  <div className="text-2xl font-black text-slate-900 mt-1">{departments.length} Departments</div>
                </div>
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                  <div className="text-xs uppercase font-bold text-amber-600">Active Offerings</div>
                  <div className="text-2xl font-black text-slate-900 mt-1">{offerings.length} Courses</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: EVENT MANAGEMENT (CAMPUS HUB) */}
        {activeTab === 'event-management' && (
          <div className="space-y-4">
            <CampusHub currentUser={currentUser} initialTab="EVENTS" embedded={true} />
          </div>
        )}

        {/* TAB: LOST & FOUND MODERATION (CAMPUS HUB) */}
        {activeTab === 'lost-found-mod' && (
          <div className="space-y-4">
            <CampusHub currentUser={currentUser} initialTab="LOST_FOUND" embedded={true} />
          </div>
        )}
      </div>
    </PortalLayout>
  );
};
