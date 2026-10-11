import { app } from '../app';
import request from 'supertest';
import { prisma } from '../prisma';

async function runApiAudit() {
  console.log('========================================================================');
  console.log('       INSTITUTIONAL ERP — COMPREHENSIVE API AUDIT SUITE                ');
  console.log('========================================================================\n');

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  const failures: string[] = [];

  async function checkEndpoint(
    desc: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    token: string | null,
    body: any = null,
    expectedStatus: number | number[] = 200
  ) {
    totalTests++;
    let req = (request(app) as any)[method.toLowerCase()](url);
    if (token) {
      req = req.set('Authorization', `Bearer ${token}`);
    }
    if (body) {
      req = req.send(body);
    }

    try {
      const res = await req;
      const expected = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
      if (expected.includes(res.status)) {
        passedTests++;
        console.log(`  ✔ [${res.status}] ${method} ${url} — ${desc}`);
        return { success: true, res };
      } else {
        failedTests++;
        const msg = `❌ [${res.status} != ${expected.join('/')}] ${method} ${url} — ${desc}\n    Response: ${JSON.stringify(res.body || res.text).slice(0, 300)}`;
        console.log(`  ${msg}`);
        failures.push(msg);
        return { success: false, res };
      }
    } catch (err: any) {
      failedTests++;
      const msg = `❌ [EXCEPTION] ${method} ${url} — ${desc}: ${err.message}`;
      console.log(`  ${msg}`);
      failures.push(msg);
      return { success: false, error: err };
    }
  }

  // --------------------------------------------------------------------------
  // 1. AUTHENTICATION & LOGIN CHECKS
  // --------------------------------------------------------------------------
  console.log('--- 1. Testing Authentication Endpoints ---');

  const studentLoginRes = await checkEndpoint(
    'Student Login via Roll Number (24CS001)',
    'POST',
    '/api/auth/login',
    null,
    { identifier: '24CS001', password: 'Student@123' },
    200
  );
  const studentToken = studentLoginRes.res?.body?.token;
  const studentUser = studentLoginRes.res?.body?.user;
  const studentProfileId = studentUser?.studentProfile?.id;

  await checkEndpoint(
    'Student Login via Institutional Email',
    'POST',
    '/api/auth/login',
    null,
    { identifier: 'rahul.cse@college.edu', password: 'Student@123' },
    200
  );

  const facultyLoginRes = await checkEndpoint(
    'Faculty Login (Dr. Alan Turing)',
    'POST',
    '/api/auth/login',
    null,
    { identifier: 'alan.turing@college.edu', password: 'Faculty@123' },
    200
  );
  const facultyToken = facultyLoginRes.res?.body?.token;

  const adminLoginRes = await checkEndpoint(
    'Academic Admin Login (Prof. John von Neumann)',
    'POST',
    '/api/auth/login',
    null,
    { identifier: 'academic.admin@college.edu', password: 'Admin@123' },
    200
  );
  const adminToken = adminLoginRes.res?.body?.token;

  const examAdminCseRes = await checkEndpoint(
    'Exam Admin CSE Login (Dr. Ada Lovelace)',
    'POST',
    '/api/auth/login',
    null,
    { identifier: 'exam.admin.cse@college.edu', password: 'Exam@123' },
    200
  );
  const examAdminCseToken = examAdminCseRes.res?.body?.token;

  await checkEndpoint('Server Health Check', 'GET', '/health', null, null, 200);

  // --------------------------------------------------------------------------
  // 2. STUDENT PORTAL API ENDPOINTS
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Testing Student Portal Endpoints ---');
  await checkEndpoint('Student Get Current Profile (/api/auth/me)', 'GET', '/api/auth/me', studentToken, null, 200);
  await checkEndpoint('Student Get Academic Departments', 'GET', '/api/academic/departments', studentToken, null, 200);
  await checkEndpoint('Student Get Batches', 'GET', '/api/academic/batches', studentToken, null, 200);
  await checkEndpoint('Student Get Courses', 'GET', '/api/academic/courses', studentToken, null, 200);
  await checkEndpoint('Student Get Course Offerings', 'GET', '/api/academic/offerings', studentToken, null, 200);
  await checkEndpoint('Student Get Timetable', 'GET', '/api/academic/timetable', studentToken, null, 200);
  await checkEndpoint('Student Get Announcements', 'GET', '/api/academic/announcements', studentToken, null, 200);

  let studentPublishedResultId: string | null = null;
  if (studentProfileId) {
    const resRes = await checkEndpoint('Student Get Own Published Results', 'GET', `/api/results/student/${studentProfileId}`, studentToken, null, 200);
    studentPublishedResultId = resRes.res?.body?.results?.[0]?.id || null;
    await checkEndpoint('Student Get Own Subject Attendance', 'GET', `/api/attendance/student/${studentProfileId}`, studentToken, null, 200);
    await checkEndpoint('Student Get Own Internal Marks Breakdown', 'GET', `/api/marks/student/${studentProfileId}`, studentToken, null, 200);
  }
  await checkEndpoint('Student Get Revaluation Requests', 'GET', '/api/results/revaluation/requests', studentToken, null, 200);

  // --------------------------------------------------------------------------
  // 3. FACULTY PORTAL API ENDPOINTS
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Testing Faculty Portal Endpoints ---');
  await checkEndpoint('Faculty Get Current Profile (/api/auth/me)', 'GET', '/api/auth/me', facultyToken, null, 200);
  const facultyOfferingsRes = await checkEndpoint('Faculty Get Course Offerings', 'GET', '/api/academic/offerings', facultyToken, null, 200);
  await checkEndpoint('Faculty Get Timetable', 'GET', '/api/academic/timetable', facultyToken, null, 200);
  await checkEndpoint('Faculty Get Announcements', 'GET', '/api/academic/announcements', facultyToken, null, 200);

  const offerings = facultyOfferingsRes.res?.body?.offerings || [];
  const facultyUser = facultyLoginRes.res?.body?.user;
  const activeOffering =
    offerings.find((o: any) =>
      o.teachingAssignments?.some(
        (ta: any) => (ta.faculty?.id === facultyUser?.id || ta.facultyId === facultyUser?.id) && ta.isActive
      )
    ) || offerings[0];
  let markRecord: any = null;

  if (activeOffering) {
    const marksRes = await checkEndpoint(
      `Faculty Get Offering Marks (${activeOffering.id})`,
      'GET',
      `/api/marks/offering/${activeOffering.id}`,
      facultyToken,
      null,
      200
    );
    markRecord = marksRes.res?.body?.marks?.[0] || null;

    await checkEndpoint(
      `Faculty Get Offering Attendance (${activeOffering.id})`,
      'GET',
      `/api/attendance/offering/${activeOffering.id}`,
      facultyToken,
      null,
      200
    );
    await checkEndpoint(
      `Faculty Get Offering Assignments (${activeOffering.id})`,
      'GET',
      `/api/academic/offerings/${activeOffering.id}/assignments`,
      facultyToken,
      null,
      200
    );

    // Faculty update mark with OCC
    if (markRecord) {
      const safeMark = markRecord.component?.maxMarks ? Math.max(1, markRecord.component.maxMarks - 2) : 8;
      await checkEndpoint(
        `Faculty Update Mark (${markRecord.id})`,
        'PUT',
        `/api/marks/${markRecord.id}`,
        facultyToken,
        {
          expectedVersion: markRecord.version,
          marksObtained: safeMark,
          isAbsent: false,
        },
        200
      );
    }

    // Faculty Record Attendance Session
    if (studentProfileId) {
      const attSessionRes = await checkEndpoint(
        'Faculty Record Attendance Session',
        'POST',
        '/api/attendance/session',
        facultyToken,
        {
          offeringId: activeOffering.id,
          topic: 'Advanced Database Systems Lecture',
          records: [{ studentId: studentProfileId, isPresent: true }],
        },
        201
      );
      const createdSession = attSessionRes.res?.body?.session;
      if (createdSession) {
        // Fetch session records to test OCC update on attendance record
        const sessionRecord = await prisma.attendanceRecord.findFirst({
          where: { sessionId: createdSession.id },
        });
        if (sessionRecord) {
          await checkEndpoint(
            `Faculty Update Attendance Record with OCC (${sessionRecord.id})`,
            'PUT',
            `/api/attendance/record/${sessionRecord.id}`,
            facultyToken,
            {
              expectedVersion: sessionRecord.version,
              isPresent: false,
            },
            200
          );
        }
      }
    }

    // Faculty Submit Offering Marks
    await checkEndpoint(
      `Faculty Submit Offering Marks for Verification (${activeOffering.id})`,
      'POST',
      `/api/marks/submit/${activeOffering.id}`,
      facultyToken,
      null,
      200
    );
  }

  // --------------------------------------------------------------------------
  // 4. ACADEMIC ADMIN PORTAL API ENDPOINTS
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Testing Academic Admin Portal Endpoints ---');
  await checkEndpoint('Admin Get Current Profile', 'GET', '/api/auth/me', adminToken, null, 200);
  const deptsRes = await checkEndpoint('Admin Get Departments', 'GET', '/api/academic/departments', adminToken, null, 200);
  const batchesRes = await checkEndpoint('Admin Get Batches', 'GET', '/api/academic/batches', adminToken, null, 200);
  await checkEndpoint('Admin Get Courses', 'GET', '/api/academic/courses', adminToken, null, 200);
  await checkEndpoint('Admin Get Offerings', 'GET', '/api/academic/offerings', adminToken, null, 200);
  await checkEndpoint('Admin Get Students', 'GET', '/api/academic/students', adminToken, null, 200);
  await checkEndpoint('Admin Get Faculty List', 'GET', '/api/academic/faculty', adminToken, null, 200);
  await checkEndpoint('Admin Get Faculty Accounts', 'GET', '/api/academic/faculty-accounts', adminToken, null, 200);
  await checkEndpoint('Admin Get Timetable', 'GET', '/api/academic/timetable', adminToken, null, 200);
  await checkEndpoint('Admin Get Attendance Overview (Read-Only)', 'GET', '/api/academic/attendance-overview', adminToken, null, 200);
  await checkEndpoint('Admin Get Reports / KPIs', 'GET', '/api/academic/reports', adminToken, null, 200);
  await checkEndpoint('Admin Get Announcements', 'GET', '/api/academic/announcements', adminToken, null, 200);
  await checkEndpoint('Admin Get System Audit Logs', 'GET', '/api/audit', adminToken, null, 200);

  // Admin Mutations
  const testDeptCode = `D${Math.floor(Math.random() * 8999 + 1000)}`;
  const deptCreateRes = await checkEndpoint(
    `Admin Create Department (${testDeptCode})`,
    'POST',
    '/api/academic/departments',
    adminToken,
    { code: testDeptCode, name: `Department of Test ${testDeptCode}` },
    201
  );
  const createdDept = deptCreateRes.res?.body?.department;

  const testCourseCode = `CS${Math.floor(Math.random() * 899 + 100)}`;
  const firstDept = deptsRes.res?.body?.departments?.[0] || createdDept;
  let createdCourse: any = null;
  if (firstDept) {
    const courseRes = await checkEndpoint(
      `Admin Create Course (${testCourseCode})`,
      'POST',
      '/api/academic/courses',
      adminToken,
      {
        code: testCourseCode,
        title: `Algorithms & Optimization ${testCourseCode}`,
        departmentId: firstDept.id,
        credits: 4,
        isTheory: true,
        isLab: false,
      },
      201
    );
    createdCourse = courseRes.res?.body?.course;
  }

  // Admin Create Student
  const randNum = Math.floor(Math.random() * 89999 + 10000);
  const firstBatch = batchesRes.res?.body?.batches?.[0];
  const firstSection = firstBatch?.sections?.[0];
  let createdStudent: any = null;

  if (firstDept && firstBatch && firstSection) {
    const newStudentRes = await checkEndpoint(
      `Admin Create Student (24TS${randNum})`,
      'POST',
      '/api/academic/students',
      adminToken,
      {
        rollNumber: `24TS${randNum}`,
        name: `Test Student ${randNum}`,
        email: `student.${randNum}@college.edu`,
        password: 'Password@123',
        departmentId: firstDept.id,
        batchId: firstBatch.id,
        sectionId: firstSection.id,
        semester: 1,
      },
      201
    );
    createdStudent = newStudentRes.res?.body?.student;

    // Admin Create Faculty
    const newFacultyRes = await checkEndpoint(
      `Admin Create Faculty (EMP${randNum})`,
      'POST',
      '/api/academic/faculty',
      adminToken,
      {
        employeeId: `EMP${randNum}`,
        name: `Dr. Turing Colleague ${randNum}`,
        email: `faculty.${randNum}@college.edu`,
        password: 'Password@123',
        departmentId: firstDept.id,
        designation: 'Assistant Professor',
      },
      201
    );
    const createdFaculty = newFacultyRes.res?.body?.faculty;

    // Deactivation & Reactivation Verification Suite
    if (createdStudent && createdFaculty) {
      // 1. Deactivate student
      await checkEndpoint(
        `Admin Deactivate Student (${createdStudent.rollNumber})`,
        'PUT',
        `/api/academic/students/${createdStudent.id}/status`,
        adminToken,
        { isActive: false, reason: 'Temporary disciplinary administrative suspension' },
        200
      );

      // 2. Verify deactivated student login is blocked with 403 ACCOUNT_DEACTIVATED
      await checkEndpoint(
        `Blocked Login Attempt for Deactivated Student (${createdStudent.rollNumber})`,
        'POST',
        '/api/auth/login',
        null,
        { identifier: createdStudent.rollNumber, password: 'Password@123' },
        403
      );

      // 3. Verify enrolling deactivated student is blocked with 400
      if (activeOffering) {
        await checkEndpoint(
          'Blocked Enrollment Attempt for Deactivated Student',
          'POST',
          '/api/academic/enrollments',
          adminToken,
          { offeringId: activeOffering.id, studentId: createdStudent.id },
          400
        );
      }

      // 4. Reactivate student
      await checkEndpoint(
        `Admin Reactivate Student (${createdStudent.rollNumber})`,
        'PUT',
        `/api/academic/students/${createdStudent.id}/status`,
        adminToken,
        { isActive: true, reason: 'Suspension completed, restored active status' },
        200
      );

      // 5. Verify reactivated student login succeeds
      await checkEndpoint(
        `Login for Reactivated Student (${createdStudent.rollNumber})`,
        'POST',
        '/api/auth/login',
        null,
        { identifier: createdStudent.rollNumber, password: 'Password@123' },
        200
      );

      // 6. Deactivate faculty
      await checkEndpoint(
        `Admin Deactivate Faculty (${createdFaculty.employeeId})`,
        'PUT',
        `/api/academic/faculty/${createdFaculty.id}/status`,
        adminToken,
        { isActive: false, reason: 'Faculty unpaid leave of absence' },
        200
      );

      // 7. Verify deactivated faculty login is blocked with 403
      await checkEndpoint(
        `Blocked Login Attempt for Deactivated Faculty (${createdFaculty.employeeId})`,
        'POST',
        '/api/auth/login',
        null,
        { identifier: createdFaculty.employeeId, password: 'Password@123' },
        403
      );

      // 8. Verify assigning deactivated faculty is blocked with 400
      if (activeOffering) {
        await checkEndpoint(
          'Blocked Assignment Attempt for Deactivated Faculty',
          'POST',
          '/api/academic/assignments',
          adminToken,
          {
            offeringId: activeOffering.id,
            newFacultyId: createdFaculty.userId,
            effectiveDate: new Date().toISOString(),
            reason: 'Invalid assignment test',
          },
          400
        );
      }

      // 9. Reactivate faculty
      await checkEndpoint(
        `Admin Reactivate Faculty (${createdFaculty.employeeId})`,
        'PUT',
        `/api/academic/faculty/${createdFaculty.id}/status`,
        adminToken,
        { isActive: true, reason: 'Returned from leave of absence' },
        200
      );

      // 10. Verify reactivated faculty login succeeds
      await checkEndpoint(
        `Login for Reactivated Faculty (${createdFaculty.employeeId})`,
        'POST',
        '/api/auth/login',
        null,
        { identifier: createdFaculty.employeeId, password: 'Password@123' },
        200
      );

      // 11. Self-deactivation prevention for Academic Admin
      const adminMeRes = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${adminToken}`);
      const adminUserId = adminMeRes.body?.user?.id;
      if (adminUserId) {
        await checkEndpoint(
          'Prevent Academic Admin Self-Deactivation',
          'PUT',
          `/api/academic/users/${adminUserId}/status`,
          adminToken,
          { isActive: false },
          400
        );
      }
    }

    // Admin Create Course Offering
    if (createdCourse) {
      const offeringRes = await checkEndpoint(
        'Admin Create Course Offering',
        'POST',
        '/api/academic/offerings',
        adminToken,
        {
          courseId: createdCourse.id,
          batchId: firstBatch.id,
          sectionId: firstSection.id,
          semester: 1,
          academicYear: '2024-2025',
        },
        201
      );
      const createdOffering = offeringRes.res?.body?.offering;

      // Admin Enroll Student in Offering
      if (createdOffering && createdStudent) {
        await checkEndpoint(
          'Admin Enroll Student in Course Offering',
          'POST',
          '/api/academic/enrollments',
          adminToken,
          {
            offeringId: createdOffering.id,
            studentId: createdStudent.id,
          },
          201
        );
      }

      // Admin Faculty Reassignment (Scenario D)
      if (createdOffering && createdFaculty) {
        await checkEndpoint(
          'Admin Mid-Semester Faculty Reassignment (Scenario D)',
          'POST',
          '/api/academic/assignments',
          adminToken,
          {
            offeringId: createdOffering.id,
            newFacultyId: createdFaculty.userId,
            effectiveDate: new Date().toISOString(),
            reason: 'Departmental curriculum rotation assignment',
          },
          201
        );
      }

      // Admin Create Timetable Slot
      if (createdOffering) {
        await checkEndpoint(
          'Admin Create Timetable Slot',
          'POST',
          '/api/academic/timetable',
          adminToken,
          {
            offeringId: createdOffering.id,
            dayOfWeek: 'SAT',
            startTime: '15:00',
            endTime: '16:00',
            roomNumber: `AUD-${randNum}`,
          },
          201
        );
      }
    }

    // Admin Semester Progression
    if (firstBatch) {
      await checkEndpoint(
        `Admin Semester Progression (Cohort -> Sem 2)`,
        'POST',
        '/api/academic/progress-semester',
        adminToken,
        {
          batchId: firstBatch.id,
          targetSemester: 2,
          academicYear: '2024-2025',
        },
        200
      );
    }
  }

  // Admin Create Announcement
  await checkEndpoint(
    'Admin Create Announcement',
    'POST',
    '/api/academic/announcements',
    adminToken,
    {
      title: 'Automated Audit Verification Notice',
      content: 'System-wide comprehensive verification test in progress.',
      category: 'ACADEMIC',
      targetRole: 'ALL',
    },
    201
  );

  // --------------------------------------------------------------------------
  // 5. EXAMINATION ADMIN PORTAL API ENDPOINTS & WORKFLOWS
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Testing Examination Admin Portal Endpoints & Workflows ---');
  await checkEndpoint('Exam Admin Get Current Profile', 'GET', '/api/auth/me', examAdminCseToken, null, 200);
  await checkEndpoint('Exam Admin Get Offerings', 'GET', '/api/academic/offerings', examAdminCseToken, null, 200);
  if (activeOffering) {
    await checkEndpoint(
      `Exam Admin Get Offering Results (${activeOffering.id})`,
      'GET',
      `/api/results/offering/${activeOffering.id}`,
      examAdminCseToken,
      null,
      200
    );
  }
  await checkEndpoint('Exam Admin Get Revaluation Requests', 'GET', '/api/results/revaluation/requests', examAdminCseToken, null, 200);
  await checkEndpoint('Exam Admin Get Branch Audit Logs', 'GET', '/api/audit', examAdminCseToken, null, 200);

  if (studentPublishedResultId) {
    await checkEndpoint(
      `Exam Admin Get Result History (${studentPublishedResultId})`,
      'GET',
      `/api/results/${studentPublishedResultId}/history`,
      examAdminCseToken,
      null,
      200
    );
  }

  // Publish / Unpublish / Reopen Flow on a fresh result
  if (activeOffering && studentProfileId) {
    const publishRes = await checkEndpoint(
      'Exam Admin Publish Result for Student',
      'POST',
      '/api/results/publish',
      examAdminCseToken,
      {
        offeringId: activeOffering.id,
        studentId: studentProfileId,
        internalMarks: 32,
        externalMarks: 48,
      },
      201
    );
    const pubResult = publishRes.res?.body?.result;

    if (pubResult) {
      // Unpublish
      await checkEndpoint(
        `Exam Admin Unpublish Result (${pubResult.id})`,
        'POST',
        `/api/results/${pubResult.id}/unpublish`,
        examAdminCseToken,
        null,
        200
      );

      // Reopen
      await checkEndpoint(
        `Exam Admin Reopen Result (${pubResult.id})`,
        'POST',
        `/api/results/${pubResult.id}/reopen`,
        examAdminCseToken,
        null,
        200
      );

      // Scenario C: Privileged Direct Examination Admin Correction
      const directCorrRes = await checkEndpoint(
        `Exam Admin Direct Correction (Scenario C - ${pubResult.id})`,
        'POST',
        `/api/results/${pubResult.id}/direct-correction`,
        examAdminCseToken,
        {
          expectedVersion: pubResult.currentVersion,
          category: 'TRANSCRIPTION_ERROR',
          reason: 'Corrected transcription discrepancy against authoritative ledger',
          evidenceReference: 'EXAM-OFFICIAL-LEDGER-2026',
          internalMarks: 34,
          externalMarks: 50,
        },
        200
      );
      const updatedResult = directCorrRes.res?.body?.result;

      // Correction Request Workflow: Student requests -> Faculty proposes -> Exam Admin approves
      if (updatedResult) {
        const reqCorrRes = await checkEndpoint(
          'Student Submit Correction Request',
          'POST',
          `/api/results/${updatedResult.id}/request-correction`,
          studentToken,
          {
            reason: 'Internal assignment component recalculation requested',
            requestedMarks: 36,
          },
          201
        );
        const corrRequestId = reqCorrRes.res?.body?.request?.id;

        if (corrRequestId) {
          // Faculty reviews and proposes
          await checkEndpoint(
            `Faculty Review Correction Request (${corrRequestId})`,
            'PUT',
            `/api/results/requests/${corrRequestId}/faculty-review`,
            facultyToken,
            {
              action: 'PROPOSE',
              reason: 'Reviewed laboratory submission records, verified 2 bonus marks',
              proposedInternalMarks: 36,
            },
            200
          );

          // Exam Admin authorizes
          await checkEndpoint(
            `Exam Admin Authorize Correction Request (${corrRequestId})`,
            'PUT',
            `/api/results/requests/${corrRequestId}/admin-approve`,
            examAdminCseToken,
            {
              reason: 'Authorized following departmental verification',
            },
            200
          );
        }

        // Revaluation Workflow: Student applies -> Exam Admin decides
        const revalApplyRes = await checkEndpoint(
          `Student Apply for External Revaluation (${updatedResult.id})`,
          'POST',
          `/api/results/${updatedResult.id}/revaluation`,
          studentToken,
          {
            reason: 'Requesting formal paper re-evaluation for external theory component',
          },
          201
        );
        const revalReqId = revalApplyRes.res?.body?.request?.id;

        if (revalReqId) {
          await checkEndpoint(
            `Exam Admin Decide Revaluation (${revalReqId})`,
            'PUT',
            `/api/results/revaluation/${revalReqId}/decide`,
            examAdminCseToken,
            {
              status: 'APPROVED',
              revisedExternalMarks: 52,
              decisionNotes: 'Senior evaluator confirmed marking rubric variance of +2 marks',
            },
            200
          );
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // 6. CAMPUS HUB API ENDPOINTS (SHARED COMMUNITY)
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Testing Campus Hub Endpoints ---');
  const eventsRes = await checkEndpoint('Get Campus Events', 'GET', '/api/hub/events', studentToken, null, 200);
  const itemsRes = await checkEndpoint('Get Lost & Found Items', 'GET', '/api/hub/lost-found', studentToken, null, 200);

  // Blocked Event Creation for Student
  await checkEndpoint(
    'Block Student from Creating Event (HTTP 403)',
    'POST',
    '/api/hub/events',
    studentToken,
    {
      title: `Student Tech Talk ${randNum}`,
      description: 'Unauthorized student event post',
      category: 'Technical',
      venue: 'Auditorium',
      eventDate: '2026-11-20T09:30:00.000Z',
    },
    403
  );

  // Faculty Create Campus Event
  const newEventRes = await checkEndpoint(
    'Faculty Create Campus Event in Campus Hub',
    'POST',
    '/api/hub/events',
    facultyToken,
    {
      title: `Grand Tech Symposium ${randNum}`,
      description: 'Annual inter-departmental innovation hackathon and presentation summit.',
      category: 'Technical',
      venue: 'Main Auditorium Complex',
      eventDate: '2026-11-20T09:30:00.000Z',
    },
    201
  );
  const createdEvent = newEventRes.res?.body?.event;

  const eventList = eventsRes.res?.body?.events || [];
  const testEvent = createdEvent || eventList[0];
  if (testEvent) {
    await checkEndpoint(
      `Toggle Upvote on Event (${testEvent.id})`,
      'POST',
      `/api/hub/events/${testEvent.id}/upvote`,
      studentToken,
      null,
      200
    );
    await checkEndpoint(
      `Set RSVP Status on Event (${testEvent.id})`,
      'POST',
      `/api/hub/events/${testEvent.id}/rsvp`,
      studentToken,
      { status: 'ATTENDING' },
      200
    );
  }

  // Report Lost & Found item
  const reportItemRes = await checkEndpoint(
    'Report Found Item in Campus Hub',
    'POST',
    '/api/hub/lost-found',
    studentToken,
    {
      title: 'Graphing Calculator TI-84',
      description: 'Found on table 4 in Central Engineering Library reading hall.',
      type: 'FOUND',
      category: 'Electronics',
      location: 'Central Library Floor 2',
    },
    201
  );
  const reportedItemId = reportItemRes.res?.body?.item?.id;

  if (reportedItemId) {
    // Update Item Status
    await checkEndpoint(
      `Update Lost & Found Item Status (${reportedItemId})`,
      'PUT',
      `/api/hub/lost-found/${reportedItemId}/status`,
      studentToken,
      { status: 'CLAIMED' },
      200
    );
  }

  // Claim reported item using another student
  const priyaLoginRes = await request(app).post('/api/auth/login').send({ identifier: '24CS002', password: 'Student@123' });
  const priyaToken = priyaLoginRes.body?.token;

  if (reportedItemId && priyaToken) {
    const claimRes = await checkEndpoint(
      'Submit Claim on Found Item',
      'POST',
      `/api/hub/lost-found/${reportedItemId}/claim`,
      priyaToken,
      {
        proofDescription: 'Black TI-84 Plus with my student roll number written in white marker on back.',
        contactInfo: 'priya.cse@college.edu',
      },
      201
    );
    const claimId = claimRes.res?.body?.claim?.id;

    if (claimId) {
      await checkEndpoint(
        'Review and Approve Claim',
        'PUT',
        `/api/hub/lost-found/${reportedItemId}/claims/${claimId}`,
        studentToken,
        {
          status: 'APPROVED',
          reviewNotes: 'Marker label matches claimant description.',
        },
        200
      );
    }
  }

  // --------------------------------------------------------------------------
  // 7. SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`TOTAL ENDPOINTS AUDITED: ${totalTests}`);
  console.log(`PASSED: ${passedTests}`);
  console.log(`FAILED: ${failedTests}`);
  console.log('========================================================================');

  if (failedTests > 0) {
    console.log('\nFAILURES DETECTED:');
    failures.forEach((f) => console.log(f));
    process.exit(1);
  } else {
    console.log('\n✔ ALL AUDITED API ENDPOINTS SUCCEEDED WITH ZERO FAILURES!');
    process.exit(0);
  }
}

runApiAudit().catch((err) => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
