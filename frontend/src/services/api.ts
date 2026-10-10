const API_BASE = '/api';

export function getStoredToken(): string | null {
  return localStorage.getItem('college_erp_token');
}

export function setStoredToken(token: string) {
  localStorage.setItem('college_erp_token', token);
}

export function clearStoredToken() {
  localStorage.removeItem('college_erp_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error: any = new Error(data.message || 'API request failed');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data as T;
}

export const api = {
  login: (identifier: string, password: string) =>
    request<any>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, email: identifier, password }),
    }),
  getMe: () => request<any>('/auth/me'),

  // Academic Management
  getDepartments: () => request<any>('/academic/departments'),
  createDepartment: (data: { code: string; name: string }) =>
    request<any>('/academic/departments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getBatches: () => request<any>('/academic/batches'),
  getOfferings: () => request<any>('/academic/offerings'),
  createOffering: (data: any) =>
    request<any>('/academic/offerings', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getCourses: () => request<any>('/academic/courses'),
  createCourse: (data: any) =>
    request<any>('/academic/courses', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getStudents: () => request<any>('/academic/students'),
  createStudent: (data: any) =>
    request<any>('/academic/students', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getFaculty: () => request<any>('/academic/faculty'),
  getFacultyAccounts: () => request<any>('/academic/faculty-accounts'),
  createFaculty: (data: any) =>
    request<any>('/academic/faculty', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  toggleUserStatus: (userId: string, isActive: boolean, reason?: string) =>
    request<any>(`/academic/users/${userId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ isActive, reason }),
    }),
  toggleStudentStatus: (studentProfileId: string, isActive: boolean, reason?: string) =>
    request<any>(`/academic/students/${studentProfileId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ isActive, reason }),
    }),
  toggleFacultyStatus: (facultyProfileId: string, isActive: boolean, reason?: string) =>
    request<any>(`/academic/faculty/${facultyProfileId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ isActive, reason }),
    }),
  enrollStudent: (offeringId: string, studentId: string) =>
    request<any>('/academic/enrollments', {
      method: 'POST',
      body: JSON.stringify({ offeringId, studentId }),
    }),
  reassignFaculty: (offeringId: string, newFacultyId: string, effectiveDate: string, reason: string) =>
    request<any>('/academic/assignments', {
      method: 'POST',
      body: JSON.stringify({ offeringId, newFacultyId, effectiveDate, reason }),
    }),
  getTimetable: (offeringId?: string) =>
    request<any>(`/academic/timetable${offeringId ? `?offeringId=${offeringId}` : ''}`),
  createTimetableSlot: (data: any) =>
    request<any>('/academic/timetable', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  progressSemester: (data: any) =>
    request<any>('/academic/progress-semester', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getAttendanceOverview: () => request<any>('/academic/attendance-overview'),
  getReports: () => request<any>('/academic/reports'),
  getAnnouncements: () => request<any>('/academic/announcements'),
  createAnnouncement: (data: any) =>
    request<any>('/academic/announcements', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getOfferingMarks: (offeringId: string) => request<any>(`/marks/offering/${offeringId}`),
  updateMark: (markId: string, expectedVersion: number, marksObtained: number | null, isAbsent: boolean = false) =>
    request<any>(`/marks/${markId}`, {
      method: 'PUT',
      body: JSON.stringify({ expectedVersion, marksObtained, isAbsent }),
    }),

  getStudentResults: (studentId: string) => request<any>(`/results/student/${studentId}`),
  getOfferingResults: (offeringId: string) => request<any>(`/results/offering/${offeringId}`),
  getResultHistory: (resultId: string) => request<any>(`/results/${resultId}/history`),
  requestCorrection: (resultId: string, reason: string, requestedMarks?: number) =>
    request<any>(`/results/${resultId}/request-correction`, {
      method: 'POST',
      body: JSON.stringify({ reason, requestedMarks }),
    }),
  facultyReviewCorrection: (requestId: string, action: 'PROPOSE' | 'REJECT', reason: string, proposedInternalMarks?: number) =>
    request<any>(`/results/requests/${requestId}/faculty-review`, {
      method: 'PUT',
      body: JSON.stringify({ action, reason, proposedInternalMarks }),
    }),
  examAdminApproveCorrection: (requestId: string, reason: string) =>
    request<any>(`/results/requests/${requestId}/admin-approve`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    }),
  directCorrection: (
    resultId: string,
    payload: {
      expectedVersion: number;
      category: string;
      reason: string;
      evidenceReference: string;
      internalMarks: number;
      externalMarks: number;
      isAbsent?: boolean;
    }
  ) =>
    request<any>(`/results/${resultId}/direct-correction`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  submitOfferingMarks: (offeringId: string) =>
    request<any>(`/marks/submit/${offeringId}`, { method: 'POST' }),
  getStudentMarks: (studentProfileId: string) =>
    request<any>(`/marks/student/${studentProfileId}`),
  getStudentAttendance: (studentProfileId: string) =>
    request<any>(`/attendance/student/${studentProfileId}`),
  recordAttendanceSession: (data: any) =>
    request<any>('/attendance/session', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateAttendanceRecord: (recordId: string, expectedVersion: number, isPresent: boolean) =>
    request<any>(`/attendance/record/${recordId}`, {
      method: 'PUT',
      body: JSON.stringify({ expectedVersion, isPresent }),
    }),
  publishResult: (data: any) =>
    request<any>('/results/publish', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  unpublishResult: (resultId: string) =>
    request<any>(`/results/${resultId}/unpublish`, { method: 'POST' }),
  reopenResult: (resultId: string) =>
    request<any>(`/results/${resultId}/reopen`, { method: 'POST' }),
  applyRevaluation: (resultId: string, reason: string) =>
    request<any>(`/results/${resultId}/revaluation`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  getRevaluationRequests: () =>
    request<any>('/results/revaluation/requests'),
  decideRevaluation: (requestId: string, data: any) =>
    request<any>(`/results/revaluation/${requestId}/decide`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getAttendance: (offeringId: string) => request<any>(`/attendance/offering/${offeringId}`),
  getAuditLogs: (page = 1, limit = 50) => request<any>(`/audit?page=${page}&limit=${limit}`),

  // Phase 2: Campus Hub
  getLostAndFoundItems: (params?: { type?: string; status?: string; category?: string; search?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return request<any>(`/hub/lost-found${query ? `?${query}` : ''}`);
  },
  reportLostAndFoundItem: (data: {
    title: string;
    description: string;
    type: 'LOST' | 'FOUND';
    category: string;
    location: string;
    imageData?: string;
  }) =>
    request<any>('/hub/lost-found', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  claimItem: (itemId: string, data: { proofDescription: string; contactInfo: string }) =>
    request<any>(`/hub/lost-found/${itemId}/claim`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  reviewClaim: (itemId: string, claimId: string, data: { status: 'APPROVED' | 'REJECTED'; reviewNotes?: string }) =>
    request<any>(`/hub/lost-found/${itemId}/claims/${claimId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  updateItemStatus: (itemId: string, status: string) =>
    request<any>(`/hub/lost-found/${itemId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),

  getCampusEvents: (params?: { category?: string; departmentId?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return request<any>(`/hub/events${query ? `?${query}` : ''}`);
  },
  createCampusEvent: (data: {
    title: string;
    description: string;
    category: string;
    venue: string;
    eventDate: string;
    departmentId?: string;
    bannerData?: string;
  }) =>
    request<any>('/hub/events', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  toggleEventUpvote: (eventId: string) =>
    request<any>(`/hub/events/${eventId}/upvote`, {
      method: 'POST',
    }),
  setEventRsvp: (eventId: string, status: 'ATTENDING' | 'INTERESTED' | 'REMOVE') =>
    request<any>(`/hub/events/${eventId}/rsvp`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
};
