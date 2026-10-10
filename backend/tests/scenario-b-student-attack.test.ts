import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/prisma';
import { seedDatabase } from '../src/prisma/seed';

describe('Scenario B: Student Attacks Faculty & Admin APIs (Server-Side RBAC & IDOR Protection)', () => {
  let studentToken: string;
  let studentUser: any;
  let studentPriya: any;
  let markId: string;
  let offeringId: string;

  beforeAll(async () => {
    await seedDatabase();

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'rahul.cse@college.edu', password: 'Student@123' });

    expect(loginRes.status).toBe(200);
    studentToken = loginRes.body.token;
    studentUser = loginRes.body.user;

    const priya = await prisma.studentProfile.findFirst({
      where: { rollNumber: '24CS002' },
    });
    studentPriya = priya;

    const mark = await prisma.assessmentMark.findFirst({});
    markId = mark!.id;
    offeringId = mark!.offeringId;
  });

  it('rejects student attempt to modify assessment marks directly (Faculty endpoint)', async () => {
    const initialMark = await prisma.assessmentMark.findUnique({ where: { id: markId } });

    const res = await request(app)
      .put(`/api/marks/${markId}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        expectedVersion: initialMark!.version,
        marksObtained: 15.0,
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
    expect(res.body.message).toContain('Your role (STUDENT) is not authorized');

    const afterMark = await prisma.assessmentMark.findUnique({ where: { id: markId } });
    expect(afterMark?.marksObtained).toBe(initialMark?.marksObtained);
    expect(afterMark?.version).toBe(initialMark?.version);
  });

  it('rejects student attempt to reassign faculty (Academic Admin endpoint)', async () => {
    const res = await request(app)
      .post('/api/academic/assignments')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        offeringId,
        newFacultyId: studentUser.id,
        effectiveDate: new Date().toISOString(),
        reason: 'Malicious student self-assignment',
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('rejects student attempt to publish examination results (Exam Admin endpoint)', async () => {
    const res = await request(app)
      .post('/api/results/publish')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        offeringId,
        studentId: studentUser.studentProfile.id,
        internalMarks: 40,
        externalMarks: 60,
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('rejects student IDOR attack attempting to view another student private published result', async () => {
    const res = await request(app)
      .get(`/api/results/student/${studentPriya.id}`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN_STUDENT_SCOPE');
    expect(res.body.message).toContain('You can only view your own academic records');

    const auditRecord = await prisma.auditLog.findFirst({
      where: {
        actorUserId: studentUser.id,
        action: 'IDOR_STUDENT_CROSS_ACCESS_ATTEMPT',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(auditRecord).not.toBeNull();
    expect(auditRecord?.entityId).toBe(studentPriya.id);
  });
});
