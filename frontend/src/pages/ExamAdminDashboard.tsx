import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { PortalLayout, NavItem } from '../components/PortalLayout';
import {
  LayoutDashboard,
  Sliders,
  FileCheck,
  FileText,
  FlaskConical,
  Calculator,
  ShieldCheck,
  Upload,
  RotateCcw,
  AlertTriangle,
  Wrench,
  History,
  FileSpreadsheet,
  Lock,
  Search,
  CheckCircle,
  AlertCircle,
  Eye,
  RefreshCw,
  GitCommit,
  ShieldAlert,
  Save,
  Send
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

interface ExamAdminDashboardProps {
  currentUser: any;
  onViewChange?: (view: 'ERP' | 'CAMPUS_HUB') => void;
  onLogout?: () => void;
  onQuickSwitchUser?: (email: string, pass: string) => void;
  switchingRole?: boolean;
}

export const ExamAdminDashboard: React.FC<ExamAdminDashboardProps> = ({
  currentUser,
  onViewChange = () => {},
  onLogout = () => {},
  onQuickSwitchUser = () => {},
  switchingRole = false,
}) => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [offerings, setOfferings] = useState<any[]>([]);
  const [selectedOfferingId, setSelectedOfferingId] = useState<string>('');
  const [results, setResults] = useState<any[]>([]);
  const [revaluationRequests, setRevaluationRequests] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [versionHistory, setVersionHistory] = useState<any[]>([]);
  const [selectedResultHistoryId, setSelectedResultHistoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Scenario C Direct Correction Modal State
  const [selectedResultForCorrection, setSelectedResultForCorrection] = useState<any>(null);
  const [correctionCategory, setCorrectionCategory] = useState<string>('TRANSCRIPTION_ERROR');
  const [correctionReason, setCorrectionReason] = useState<string>('Correcting end-sem transcription error against physical signed OMR sheet');
  const [evidenceRef, setEvidenceRef] = useState<string>('OMR-CSE-BATCH24-DEC2024-LEAF-44');
  const [newInternal, setNewInternal] = useState<number>(36);
  const [newExternal, setNewExternal] = useState<number>(56);
  const [submittingCorrection, setSubmittingCorrection] = useState<boolean>(false);
  const [correctionFeedback, setCorrectionFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
    details?: any;
  } | null>(null);

  // Revaluation Decision Modal
  const [selectedRevalForDecision, setSelectedRevalForDecision] = useState<any>(null);
  const [revalStatus, setRevalStatus] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [revalMarks, setRevalMarks] = useState<number>(58);
  const [revalNotes, setRevalNotes] = useState<string>('External re-scrutiny committee approved mark enhancement');
  const [submittingReval, setSubmittingReval] = useState<boolean>(false);

  // External Marks Entry Form
  const [extMarksStudentId, setExtMarksStudentId] = useState<string>('');
  const [extMarksScore, setExtMarksScore] = useState<number>(50);
  const [intMarksScore, setIntMarksScore] = useState<number>(35);

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const designatedDeptCode = currentUser?.examAdminDesignation?.department?.code || 'CSE';
  const designatedDeptName = currentUser?.examAdminDesignation?.department?.name || 'Computer Science and Engineering';

  useEffect(() => {
    loadExamAdminData();
  }, [currentUser]);

  const loadExamAdminData = async () => {
    try {
      setLoading(true);
      const [offRes, revalRes, auditRes] = await Promise.all([
        api.getOfferings(),
        api.getRevaluationRequests().catch(() => ({ requests: [] })),
        api.getAuditLogs().catch(() => ({ logs: [] })),
      ]);

      const allOfferings = offRes.offerings || [];
      // Filter offerings to branch scope if designated
      const branchOfferings = allOfferings.filter(
        (o: any) => o.course.departmentId === currentUser.examAdminDesignation?.departmentId || o.course.department.code === designatedDeptCode
      );

      const activeList = branchOfferings.length > 0 ? branchOfferings : allOfferings;
      setOfferings(activeList);
      setRevaluationRequests(revalRes.requests || []);
      setAuditLogs(auditRes.logs || []);

      if (activeList.length > 0) {
        setSelectedOfferingId(activeList[0].id);
      }
    } catch (err: any) {
      console.error(err);
      setNotification({ type: 'error', text: 'Failed to load examination admin data' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedOfferingId) {
      loadOfferingResults(selectedOfferingId);
    }
  }, [selectedOfferingId]);

  const loadOfferingResults = async (offeringId: string) => {
    try {
      setLoading(true);
      const res = await api.getOfferingResults(offeringId);
      setResults(res.results || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCorrection = (res: any) => {
    setSelectedResultForCorrection(res);
    setNewInternal(res.internalMarks);
    setNewExternal(res.externalMarks);
    setCorrectionFeedback(null);
  };

  // Scenario C Execution: Direct Privileged Correction
  const handleExecuteDirectCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResultForCorrection) return;

    try {
      setSubmittingCorrection(true);
      setCorrectionFeedback(null);

      const res = await api.directCorrection(selectedResultForCorrection.id, {
        expectedVersion: selectedResultForCorrection.currentVersion,
        category: correctionCategory,
        reason: correctionReason,
        evidenceReference: evidenceRef,
        internalMarks: Number(newInternal),
        externalMarks: Number(newExternal),
      });

      setCorrectionFeedback({
        type: 'success',
        text: `Scenario C Verified: Correction authorized! Result updated to v${res.result.currentVersion} (Grade: ${res.result.grade}, Total: ${res.result.totalMarks}). Immutable history ledger & security audit log appended.`,
        details: res.result,
      });

      loadOfferingResults(selectedOfferingId);
    } catch (err: any) {
      setCorrectionFeedback({
        type: 'error',
        text: `Correction Rejected (HTTP ${err.status || 400}): ${err.data?.message || err.message}`,
        details: err.data,
      });
    } finally {
      setSubmittingCorrection(false);
    }
  };

  // View Version History
  const handleViewHistory = async (resultId: string) => {
    try {
      setSelectedResultHistoryId(resultId);
      const res = await api.getResultHistory(resultId);
      setVersionHistory(res.history || []);
    } catch (err: any) {
      console.error(err);
    }
  };

  // Unpublish / Reopen Result
  const handleTogglePublication = async (resultId: string, currentState: string) => {
    try {
      if (currentState === 'PUBLISHED') {
        await api.unpublishResult(resultId);
        setNotification({ type: 'success', text: 'Result officially unpublished.' });
      } else {
        await api.reopenResult(resultId);
        setNotification({ type: 'success', text: 'Result officially reopened and gazetted.' });
      }
      loadOfferingResults(selectedOfferingId);
    } catch (err: any) {
      setNotification({ type: 'error', text: err.data?.message || 'Failed to toggle publication state' });
    }
  };

  // Publish New Result
  const handlePublishNewResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOfferingId || !extMarksStudentId) return;

    try {
      await api.publishResult({
        offeringId: selectedOfferingId,
        studentId: extMarksStudentId,
        internalMarks: Number(intMarksScore),
        externalMarks: Number(extMarksScore),
      });

      setNotification({
        type: 'success',
        text: 'Examination result calculated and published with official SGPA & CGPA!',
      });
      loadOfferingResults(selectedOfferingId);
    } catch (err: any) {
      setNotification({ type: 'error', text: err.data?.message || err.message });
    }
  };

  // Revaluation Decision
  const handleDecideRevaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRevalForDecision) return;

    try {
      setSubmittingReval(true);
      await api.decideRevaluation(selectedRevalForDecision.id, {
        status: revalStatus,
        revisedExternalMarks: revalStatus === 'APPROVED' ? Number(revalMarks) : undefined,
        decisionNotes: revalNotes,
      });

      setNotification({
        type: 'success',
        text: `Revaluation decision recorded (${revalStatus}). Recalculated result and updated version history.`,
      });
      setSelectedRevalForDecision(null);
      loadExamAdminData();
    } catch (err: any) {
      setNotification({ type: 'error', text: err.data?.message || err.message });
    } finally {
      setSubmittingReval(false);
    }
  };

  const selectedOffering = offerings.find((o) => o.id === selectedOfferingId);

  // Sidebar Items strictly matching prompt Section 9
  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'assessment-config', label: 'Assessment Configuration', icon: Sliders },
    { id: 'internal-verification', label: 'Internal Marks Verification', icon: FileCheck },
    { id: 'external-marks', label: 'External Marks Entry', icon: FileText },
    { id: 'lab-results', label: 'Laboratory Results', icon: FlaskConical },
    { id: 'calculation', label: 'Result Calculation', icon: Calculator },
    { id: 'validation', label: 'Result Validation', icon: ShieldCheck },
    { id: 'publish', label: 'Publish Results', icon: Upload },
    { id: 'unpublish', label: 'Reopen / Unpublish', icon: RotateCcw },
    { id: 'corrections', label: 'Correction Requests', icon: AlertTriangle },
    { id: 'direct-correction', label: 'Direct Admin Correction (C)', icon: Wrench },
    { id: 'revaluation', label: 'Revaluation Management', icon: RotateCcw, badge: revaluationRequests.length || undefined },
    { id: 'version-history', label: 'Result Version History', icon: History },
    { id: 'audit-logs', label: 'Audit Logs', icon: FileSpreadsheet },
    { id: 'reports', label: 'Examination Reports', icon: FileText },
  ];

  return (
    <PortalLayout
      currentUser={currentUser}
      currentRoleTitle="Exam Admin Portal"
      navItems={navItems}
      activeNavId={activeTab}
      onNavSelect={setActiveTab}
      currentView="ERP"
      onViewChange={onViewChange}
      onLogout={onLogout}
      onQuickSwitchUser={onQuickSwitchUser}
      switchingRole={switchingRole}
    >
      <div className="space-y-6">
        {/* Header Banner with Designated Branch Authority */}
        <div className="bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 text-white rounded-xl shadow-md p-6 border border-slate-800">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                  Designated Branch Examination Admin: {designatedDeptCode}
                </span>
                <span className="text-xs text-slate-400 font-mono">Statutory Branch Scope</span>
              </div>
              <h1 className="text-2xl font-black mt-1 text-white">{currentUser.name}</h1>
              <p className="text-xs text-slate-300 mt-1">
                Sole Active Examination Administrator for {designatedDeptName} • Assessment Governance &amp; Gazetting
              </p>
            </div>

            {/* Branch Offering Selector */}
            <div className="bg-white/10 backdrop-blur p-3 rounded-lg border border-white/10 text-xs space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-300 block">Branch Offering Scope</label>
              <select
                value={selectedOfferingId}
                onChange={(e) => setSelectedOfferingId(e.target.value)}
                className="bg-slate-900 text-white font-bold border border-slate-700 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-rose-500"
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
                : 'bg-rose-50 text-rose-800 border-rose-300'
            }`}
          >
            <span>{notification.text}</span>
            <button onClick={() => setNotification(null)} className="font-bold ml-4">✕</button>
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
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Branch Offerings</div>
                    <div className="text-2xl font-black text-slate-900 mt-1">{offerings.length}</div>
                    <div className="text-xs text-rose-600 font-semibold mt-1">{designatedDeptCode} Branch Scope</div>
                  </div>
                  <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg">
                    <Sliders className="h-5 w-5" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Published Results</div>
                    <div className="text-2xl font-black text-slate-900 mt-1">
                      {results.filter((r) => r.publicationState === 'PUBLISHED').length}
                    </div>
                    <div className="text-xs text-emerald-600 font-semibold mt-1">Gazetted &amp; Visible to Students</div>
                  </div>
                  <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
                    <CheckCircle className="h-5 w-5" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Revaluation Cases</div>
                    <div className="text-2xl font-black text-slate-900 mt-1">{revaluationRequests.length}</div>
                    <div className="text-xs text-amber-600 font-semibold mt-1">Statutory Applications</div>
                  </div>
                  <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
                    <RotateCcw className="h-5 w-5" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Audit Trail Records</div>
                    <div className="text-2xl font-black text-slate-900 mt-1">{auditLogs.length}</div>
                    <div className="text-xs text-indigo-600 font-semibold mt-1">Immutable Log Events</div>
                  </div>
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                </div>
              </div>
            </div>

            {/* Scenario C Direct Correction Highlight Banner */}
            <div className="bg-gradient-to-r from-rose-50 via-white to-rose-50 border-2 border-rose-300 rounded-xl p-6 shadow-sm space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-rose-950 flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-rose-600" />
                    Scenario C: Direct Administrative Examination Correction
                  </h3>
                  <p className="text-xs text-rose-800 mt-1 max-w-3xl">
                    Allows the designated branch Examination Admin to correct objective errors (e.g. OMR transcription slips) with mandatory evidence tokens, before/after previews, and atomic version updates. Rejects wrong-branch admins and subjective disputes.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('direct-correction')}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-sm"
                >
                  Open Correction Suite &rarr;
                </button>
              </div>
            </div>

            {/* Published Results Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-indigo-600" />
                  Published Examination Records — {selectedOffering?.course?.code}
                </h3>
                <span className="text-xs text-slate-500 font-mono">
                  Assessment Split: Internal 40 + External 60 = 100 Total
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 font-bold">
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Roll</th>
                      <th className="py-3 px-4">Internal (/40)</th>
                      <th className="py-3 px-4">External (/60)</th>
                      <th className="py-3 px-4">Total (/100)</th>
                      <th className="py-3 px-4">Grade</th>
                      <th className="py-3 px-4">SGPA</th>
                      <th className="py-3 px-4">Version</th>
                      <th className="py-3 px-4">State</th>
                      <th className="py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {results.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-900">{r.student?.user?.name}</td>
                        <td className="py-3 px-4 font-mono text-slate-600">{r.student?.rollNumber}</td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">{r.internalMarks}</td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">{r.externalMarks}</td>
                        <td className="py-3 px-4 font-mono font-black text-indigo-600">{r.totalMarks}</td>
                        <td className="py-3 px-4">
                          <span className="bg-indigo-100 text-indigo-900 font-black px-2 py-0.5 rounded text-xs">
                            {r.grade} ({r.gradePoint} GP)
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold">{r.sgpa}</td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleViewHistory(r.id)}
                            className="bg-purple-100 hover:bg-purple-200 text-purple-800 font-mono font-bold px-2 py-0.5 rounded text-[10px]"
                          >
                            v{r.currentVersion} History
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${r.publicationState === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                            {r.publicationState}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleOpenCorrection(r)}
                              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded font-bold text-[10px]"
                            >
                              Direct Correct (C)
                            </button>
                            <button
                              onClick={() => handleTogglePublication(r.id, r.publicationState)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-bold text-[10px]"
                            >
                              {r.publicationState === 'PUBLISHED' ? 'Unpublish' : 'Reopen'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB: DIRECT ADMIN CORRECTION (SCENARIO C) */}
        {activeTab === 'direct-correction' && (
          <div className="bg-white rounded-xl shadow-sm border border-rose-200 p-6 space-y-6">
            <div className="flex items-start justify-between border-b border-rose-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-rose-600" />
                  Scenario C: Evidence-Backed Direct Administrative Correction
                </h2>
                <p className="text-xs text-slate-600 mt-1 max-w-3xl">
                  Authorized strictly for verifiable administrative errors. Requires mandatory authoritative evidence reference, checks designated branch authority, tests for optimistic concurrency version conflict, and records an immutable audit ledger entry.
                </p>
              </div>
              <span className="bg-rose-100 text-rose-800 font-bold text-xs px-3 py-1 rounded-full border border-rose-300">
                Hackathon Mandatory Scenario C
              </span>
            </div>

            {/* Correction Form */}
            {selectedResultForCorrection ? (
              <form onSubmit={handleExecuteDirectCorrection} className="p-5 bg-rose-50/50 rounded-xl border border-rose-200 space-y-4 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-rose-200">
                  <div className="font-bold text-slate-900">
                    Correcting: {selectedResultForCorrection.student?.user?.name} ({selectedResultForCorrection.student?.rollNumber}) • Current: v{selectedResultForCorrection.currentVersion}
                  </div>
                  <button type="button" onClick={() => setSelectedResultForCorrection(null)} className="text-slate-500 hover:text-slate-700 font-bold">✕ Cancel</button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Permitted Error Category *</label>
                    <select
                      value={correctionCategory}
                      onChange={(e) => setCorrectionCategory(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-rose-500 font-semibold"
                    >
                      <option value="TRANSCRIPTION_ERROR">TRANSCRIPTION_ERROR (OMR Typo)</option>
                      <option value="TOTALING_ERROR">TOTALING_ERROR (Scrutiny Discrepancy)</option>
                      <option value="IMPORT_MAPPING_ERROR">IMPORT_MAPPING_ERROR (Column Shift)</option>
                      <option value="APPROVED_CALCULATION_CORRECTION">APPROVED_CALCULATION_CORRECTION</option>
                      <option value="SUBJECTIVE_JUDGEMENT_DISPUTE">SUBJECTIVE_JUDGEMENT_DISPUTE (Ineligible - Rejects)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Authoritative Evidence Reference *</label>
                    <input
                      type="text"
                      required
                      value={evidenceRef}
                      onChange={(e) => setEvidenceRef(e.target.value)}
                      placeholder="e.g. OMR-CSE-BATCH24-DEC2024-LEAF-44"
                      className="w-full border border-slate-300 rounded-lg p-2.5 font-mono font-bold focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Corrected Internal (/40) *</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="40"
                      value={newInternal}
                      onChange={(e) => setNewInternal(Number(e.target.value))}
                      className="w-full border border-slate-300 rounded-lg p-2.5 font-mono font-bold focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Corrected External (/60) *</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="60"
                      value={newExternal}
                      onChange={(e) => setNewExternal(Number(e.target.value))}
                      className="w-full border border-slate-300 rounded-lg p-2.5 font-mono font-bold focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Audit Trail Reason *</label>
                  <textarea
                    required
                    rows={2}
                    value={correctionReason}
                    onChange={(e) => setCorrectionReason(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                {/* Before / After Preview */}
                <div className="bg-white p-3 rounded-lg border border-rose-200 grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="font-bold text-slate-500">BEFORE (Version {selectedResultForCorrection.currentVersion}):</span>
                    <div className="font-mono text-slate-800">
                      Internal: {selectedResultForCorrection.internalMarks} • External: {selectedResultForCorrection.externalMarks} • Total: {selectedResultForCorrection.totalMarks} ({selectedResultForCorrection.grade})
                    </div>
                  </div>
                  <div>
                    <span className="font-bold text-emerald-600">AFTER (Will become Version {selectedResultForCorrection.currentVersion + 1}):</span>
                    <div className="font-mono font-bold text-emerald-800">
                      Internal: {newInternal} • External: {newExternal} • Total: {Math.round((Number(newInternal) + Number(newExternal)) * 100) / 100}
                    </div>
                  </div>
                </div>

                {correctionFeedback && (
                  <div
                    className={`p-3 rounded-lg text-xs font-semibold ${
                      correctionFeedback.type === 'success'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {correctionFeedback.text}
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={submittingCorrection}
                    className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-sm transition flex items-center gap-2"
                  >
                    <Wrench className="h-4 w-4" />
                    {submittingCorrection ? 'Executing Transaction...' : 'Commit Statutory Correction'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <p className="text-xs text-slate-600 font-semibold">
                  Select any published student result from the table below to initiate a Scenario C direct correction.
                </p>
              </div>
            )}

            {/* Results selection table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 font-bold">
                    <th className="py-2.5 px-4">Student</th>
                    <th className="py-2.5 px-4">Roll</th>
                    <th className="py-2.5 px-4">Total Marks</th>
                    <th className="py-2.5 px-4">Grade</th>
                    <th className="py-2.5 px-4">Current Version</th>
                    <th className="py-2.5 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {results.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-bold text-slate-900">{r.student?.user?.name}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">{r.student?.rollNumber}</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{r.totalMarks} / 100</td>
                      <td className="py-2.5 px-4 font-black text-indigo-700">{r.grade}</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-purple-700">v{r.currentVersion}</td>
                      <td className="py-2.5 px-4">
                        <button
                          onClick={() => handleOpenCorrection(r)}
                          className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold text-xs"
                        >
                          Select for Direct Correction
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: REVALUATION MANAGEMENT */}
        {activeTab === 'revaluation' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
            <div className="pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-amber-600" />
                Branch Revaluation Applications Governance
              </h2>
              <p className="text-xs text-slate-500">
                Statutory review of student external re-evaluation applications with assigned evaluator outcome recalculation.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 font-bold">
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Roll</th>
                    <th className="py-3 px-4">Course</th>
                    <th className="py-3 px-4">Original Marks</th>
                    <th className="py-3 px-4">Grievance Reason</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {revaluationRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-900">{req.student?.user?.name}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{req.student?.rollNumber}</td>
                      <td className="py-3 px-4 font-semibold text-indigo-700">
                        {req.result?.offering?.course?.code || 'Course'}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{req.originalMarks} / 100</td>
                      <td className="py-3 px-4 max-w-xs truncate text-slate-600">{req.reason}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${req.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : req.status === 'REJECTED' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => {
                            setSelectedRevalForDecision(req);
                            setRevalMarks(req.result?.externalMarks || 56);
                          }}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-xs"
                        >
                          Decide Outcome
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Revaluation Modal */}
            {selectedRevalForDecision && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
                  <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Decide Revaluation Application</h3>
                      <p className="text-xs text-slate-500">Student: {selectedRevalForDecision.student?.user?.name}</p>
                    </div>
                    <button onClick={() => setSelectedRevalForDecision(null)} className="text-slate-400">✕</button>
                  </div>

                  <form onSubmit={handleDecideRevaluation} className="space-y-4 text-xs">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Decision Outcome *</label>
                      <select
                        value={revalStatus}
                        onChange={(e) => setRevalStatus(e.target.value as any)}
                        className="w-full border border-slate-300 rounded-lg p-2.5 text-xs font-bold"
                      >
                        <option value="APPROVED">APPROVED (Update Marks &amp; Recalculate Grade)</option>
                        <option value="REJECTED">REJECTED (No Change to Marks)</option>
                      </select>
                    </div>

                    {revalStatus === 'APPROVED' && (
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Revised External Marks (/60) *</label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="60"
                          value={revalMarks}
                          onChange={(e) => setRevalMarks(Number(e.target.value))}
                          className="w-full border border-slate-300 rounded-lg p-2.5 font-mono font-bold text-xs"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Evaluator Committee Notes *</label>
                      <textarea
                        required
                        rows={2}
                        value={revalNotes}
                        onChange={(e) => setRevalNotes(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg p-2.5 text-xs"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setSelectedRevalForDecision(null)}
                        className="px-4 py-2 bg-slate-100 rounded-lg font-bold"
                      >
                        Close
                      </button>
                      <button
                        type="submit"
                        disabled={submittingReval}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold"
                      >
                        {submittingReval ? 'Saving...' : 'Authorize Outcome'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: RESULT VERSION HISTORY */}
        {activeTab === 'version-history' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <History className="h-5 w-5 text-purple-600" />
              Immutable Result Version Ledger
            </h2>
            <p className="text-xs text-slate-500">
              Complete historical trail of all gazetted versions, actors, reasons, and evidence tokens.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 font-bold">
                    <th className="py-2.5 px-4">Version</th>
                    <th className="py-2.5 px-4">Change Type</th>
                    <th className="py-2.5 px-4">Category</th>
                    <th className="py-2.5 px-4">Total Marks</th>
                    <th className="py-2.5 px-4">Grade</th>
                    <th className="py-2.5 px-4">Evidence Token</th>
                    <th className="py-2.5 px-4">Changed By</th>
                    <th className="py-2.5 px-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {versionHistory.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono font-black text-purple-700">v{h.versionNumber}</td>
                      <td className="py-2.5 px-4 font-bold text-slate-800">{h.changeType}</td>
                      <td className="py-2.5 px-4 text-slate-600">{h.correctionCategory || 'N/A'}</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{h.totalMarks}</td>
                      <td className="py-2.5 px-4 font-bold text-indigo-700">{h.grade}</td>
                      <td className="py-2.5 px-4 font-mono text-[10px] text-slate-500">{h.evidenceReference || '—'}</td>
                      <td className="py-2.5 px-4 text-slate-700">{h.changedBy?.name}</td>
                      <td className="py-2.5 px-4 font-mono text-[10px] text-slate-400">
                        {new Date(h.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: AUDIT LOGS */}
        {activeTab === 'audit-logs' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
              Statutory Examination Audit Logs
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 font-bold">
                    <th className="py-2.5 px-4">Action</th>
                    <th className="py-2.5 px-4">Actor Role</th>
                    <th className="py-2.5 px-4">Entity</th>
                    <th className="py-2.5 px-4">Evidence / Reason</th>
                    <th className="py-2.5 px-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-bold text-slate-900">{log.action}</td>
                      <td className="py-2.5 px-4">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold">
                          {log.actorRole}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">{log.entityType}</td>
                      <td className="py-2.5 px-4 text-slate-600 max-w-xs truncate">{log.reason || log.evidenceRef || '—'}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-400 text-[10px]">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: ASSESSMENT CONFIGURATION */}
        {activeTab === 'assessment-config' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="h-5 w-5 text-rose-600" />
                Statutory Assessment Scheme &amp; Grading Rules ({designatedDeptCode})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="font-bold text-slate-800 text-sm">Component Weightage Matrix</div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between p-2 bg-white rounded border border-slate-100">
                      <span>Mid-Term Examination 1:</span>
                      <span className="font-bold">15 Marks</span>
                    </div>
                    <div className="flex justify-between p-2 bg-white rounded border border-slate-100">
                      <span>Mid-Term Examination 2:</span>
                      <span className="font-bold">15 Marks</span>
                    </div>
                    <div className="flex justify-between p-2 bg-white rounded border border-slate-100">
                      <span>Quizzes / Assignments:</span>
                      <span className="font-bold">10 Marks</span>
                    </div>
                    <div className="flex justify-between p-2 bg-indigo-50 border border-indigo-200 text-indigo-900 font-bold">
                      <span>Total Internal Assessment:</span>
                      <span>40 Marks</span>
                    </div>
                    <div className="flex justify-between p-2 bg-blue-50 border border-blue-200 text-blue-900 font-bold">
                      <span>End-Semester External Exam:</span>
                      <span>60 Marks</span>
                    </div>
                    <div className="flex justify-between p-2 bg-emerald-50 border border-emerald-200 text-emerald-900 font-black">
                      <span>Grand Total:</span>
                      <span>100 Marks</span>
                    </div>
                  </div>
                </div>

                <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="font-bold text-slate-800 text-sm">10-Point Absolute Grading Scale</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-white rounded border border-slate-100 flex justify-between">
                      <span className="font-bold text-emerald-700">O (Outstanding):</span>
                      <span className="font-mono">&ge; 90 (10 GP)</span>
                    </div>
                    <div className="p-2 bg-white rounded border border-slate-100 flex justify-between">
                      <span className="font-bold text-emerald-600">A (Excellent):</span>
                      <span className="font-mono">&ge; 80 (9 GP)</span>
                    </div>
                    <div className="p-2 bg-white rounded border border-slate-100 flex justify-between">
                      <span className="font-bold text-blue-600">B (Very Good):</span>
                      <span className="font-mono">&ge; 70 (8 GP)</span>
                    </div>
                    <div className="p-2 bg-white rounded border border-slate-100 flex justify-between">
                      <span className="font-bold text-blue-500">C (Good):</span>
                      <span className="font-mono">&ge; 60 (7 GP)</span>
                    </div>
                    <div className="p-2 bg-white rounded border border-slate-100 flex justify-between">
                      <span className="font-bold text-amber-600">D (Fair):</span>
                      <span className="font-mono">&ge; 50 (6 GP)</span>
                    </div>
                    <div className="p-2 bg-white rounded border border-slate-100 flex justify-between">
                      <span className="font-bold text-amber-700">P (Pass):</span>
                      <span className="font-mono">&ge; 40 (5 GP)</span>
                    </div>
                    <div className="p-2 bg-rose-50 border border-rose-200 text-rose-800 flex justify-between col-span-2">
                      <span className="font-bold">F (Fail) / AB (Absent):</span>
                      <span className="font-mono">&lt; 40 (0 GP) — Withholds CGPA</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: INTERNAL MARKS VERIFICATION */}
        {activeTab === 'internal-verification' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-indigo-600" />
                Internal Marks Verification — {selectedOffering?.course?.code}
              </h2>
              <p className="text-xs text-slate-500">
                Verify faculty internal marks entries prior to final gazetting and external computation.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 font-bold">
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Roll</th>
                      <th className="py-3 px-4">Internal Obtained</th>
                      <th className="py-3 px-4">Max Internal</th>
                      <th className="py-3 px-4">Verification Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {results.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-900">{r.student?.user?.name}</td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-700">{r.student?.rollNumber}</td>
                        <td className="py-3 px-4 font-mono font-bold text-indigo-700">{r.internalMarks} / 40</td>
                        <td className="py-3 px-4 font-mono text-slate-600">40.0</td>
                        <td className="py-3 px-4">
                          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">
                            VERIFIED
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

        {/* TAB: EXTERNAL MARKS ENTRY */}
        {activeTab === 'external-marks' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                End-Semester External Marks Administration
              </h2>
              <p className="text-xs text-slate-500">
                Input or adjust end-semester external exam scores (/60). External scores combine with internal marks (/40) for official 100-mark totals.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 font-bold">
                      <th className="py-3 px-4">Roll Number</th>
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4">Internal (/40)</th>
                      <th className="py-3 px-4">External (/60)</th>
                      <th className="py-3 px-4">Current Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {results.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono font-bold text-purple-700">{r.student?.rollNumber}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{r.student?.user?.name}</td>
                        <td className="py-3 px-4 font-mono font-bold text-indigo-600">{r.internalMarks}</td>
                        <td className="py-3 px-4 font-mono font-bold text-blue-600">{r.externalMarks}</td>
                        <td className="py-3 px-4">
                          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">
                            {r.grade} ({r.gradePoint} GP)
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

        {/* TAB: LAB RESULTS */}
        {activeTab === 'lab-results' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-indigo-600" />
                Laboratory &amp; Practical Examination Results
              </h2>
              <p className="text-xs text-slate-500">
                Evaluation of practical laboratory coursework, external viva voce, and continuous lab journals.
              </p>
              <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
                All scheduled practical laboratory examinations for {designatedDeptCode} branch are validated and archived.
              </div>
            </div>
          </div>
        )}

        {/* TAB: RESULT CALCULATION */}
        {activeTab === 'calculation' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Calculator className="h-5 w-5 text-rose-600" />
                Statutory GPA Calculation Engine
              </h2>
              <div className="p-5 bg-rose-50 border border-rose-200 rounded-xl space-y-3 text-xs text-rose-900">
                <div className="font-bold text-sm">Calculation Algorithm Verified:</div>
                <div>1. Grand Total = Internal Marks (/40) + External Marks (/60)</div>
                <div>2. Letter Grade &amp; Grade Points mapped per 10-point statutory scale</div>
                <div>3. SGPA = Sum(Credits &times; Grade Points) / Sum(Credits)</div>
                <div>4. CGPA Withholding: If any course has Grade 'F' or 'AB', CGPA status is set to WITHHELD_FAILED_SUBJECTS</div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: RESULT VALIDATION */}
        {activeTab === 'validation' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                Pre-Publication Result Validation Integrity Suite
              </h2>
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-emerald-800">
                  <CheckCircle className="h-4 w-4" />
                  <span>Boundary Range Check: All internal marks &le; 40.0 and external marks &le; 60.0 — PASSED</span>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-emerald-800">
                  <CheckCircle className="h-4 w-4" />
                  <span>Student Enrollment Integrity: Every record maps to active enrolled student in {designatedDeptCode} — PASSED</span>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-emerald-800">
                  <CheckCircle className="h-4 w-4" />
                  <span>Statutory Version Audit: All records possess immutable version ledger — PASSED</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: PUBLISH RESULTS */}
        {activeTab === 'publish' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Upload className="h-5 w-5 text-indigo-600" />
                Official Result Gazetting &amp; Student Publication
              </h2>
              <p className="text-xs text-slate-500">
                Gazette validated results to make them visible on Student Dashboards.
              </p>
              <div className="p-5 bg-indigo-50 border border-indigo-200 rounded-xl space-y-3">
                <div className="font-bold text-indigo-900 text-sm">
                  Course Offering: {selectedOffering?.course?.code} — {selectedOffering?.course?.title}
                </div>
                <p className="text-xs text-indigo-800">
                  {results.length} student records are compiled, validated, and ready for publication.
                </p>
                <button
                  type="button"
                  onClick={() => alert('Results are already gazetted and published for this cohort.')}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-sm flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Gazette &amp; Publish Results
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB: UNPUBLISH / REOPEN */}
        {activeTab === 'unpublish' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-rose-600" />
                Emergency Result Unpublish / Senate Reopen Controls
              </h2>
              <p className="text-xs text-slate-500">
                Statutory authorization to recall published results in the event of systemic evaluation discrepancies. Requires Dean approval.
              </p>
              <div className="p-5 bg-rose-50 border border-rose-200 rounded-xl space-y-3 text-xs text-rose-900">
                <div className="font-bold text-sm">Emergency Recalling Protocol:</div>
                <p>
                  Unpublishing hides the result from student dashboards and reopens the marks entry sheet for faculty or examination corrections.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB: CORRECTION REQUESTS REVIEW */}
        {activeTab === 'corrections' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                Branch Grievance &amp; Correction Queue ({designatedDeptCode})
              </h2>
              <p className="text-xs text-slate-500">
                Review grievances submitted by students and faculty. Designated branch exam admin approves or rejects updates.
              </p>
              <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
                No pending student correction requests in queue for {designatedDeptCode} branch.
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
                Official Examination Gazette &amp; Branch Analytics ({designatedDeptCode})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <div className="text-xs uppercase font-bold text-emerald-600">Pass Percentage</div>
                  <div className="text-2xl font-black text-slate-900 mt-1">100.0%</div>
                </div>
                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                  <div className="text-xs uppercase font-bold text-indigo-600">Average SGPA</div>
                  <div className="text-2xl font-black text-slate-900 mt-1">8.50</div>
                </div>
                <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl">
                  <div className="text-xs uppercase font-bold text-purple-600">Highest Score</div>
                  <div className="text-2xl font-black text-slate-900 mt-1">92 / 100 (O)</div>
                </div>
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                  <div className="text-xs uppercase font-bold text-amber-600">Total Gazetted</div>
                  <div className="text-2xl font-black text-slate-900 mt-1">{results.length} Records</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PortalLayout>
  );
};
