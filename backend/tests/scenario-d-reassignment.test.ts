import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/prisma';
import { seedDatabase } from '../src/prisma/seed';

describe('Scenario D: Mid-Semester Faculty Reassignment (Historical Attribution & Forward Scope Transfer)', () => {
  let acadAdminToken: string;
  let turingToken: string;
  let hopperToken: string;

  let offeringId: string;
  let facultyTuringId: string;
  let facultyHopperId: string;
  let markId: string;

  beforeAll(async () => {
    await seedDatabase();

    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'academic.admin@college.edu', password: 'Admin@123' });
    acadAdminToken = adminRes.body.token;

    const turingRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alan.turing@college.edu', password: 'Faculty@123' });
    turingToken = turingRes.body.token;
    facultyTuringId = turingRes.body.user.id;

    const hopperRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'grace.hopper@college.edu', password: 'Faculty@123' });
    hopperToken = hopperRes.body.token;
    facultyHopperId = hopperRes.body.user.id;

    const offering = await prisma.courseOffering.findFirst({
      include: { teachingAssignments: true },
    });
    offeringId = offering!.id;

    const mark = await prisma.assessmentMark.findFirst({
      where: { offeringId, recordedByFacultyId: facultyTuringId },
    });
    markId = mark!.id;
  });

  it('confirms Faculty A (Turing) initially has active scope and historical work', async () => {
    const activeAssignment = await prisma.teachingAssignment.findFirst({
      where: { offeringId, isActive: true },
    });
    expect(activeAssignment?.facultyId).toBe(facultyTuringId);

    const histSession = await prisma.attendanceSession.findFirst({
      where: { offeringId },
    });
    expect(histSession?.facultyId).toBe(facultyTuringId);

    const mark = await prisma.assessmentMark.findUnique({ where: { id: markId } });
    const res = await request(app)
      .put(`/api/marks/${markId}`)
      .set('Authorization', `Bearer ${turingToken}`)
      .send({
        expectedVersion: mark!.version,
        marksObtained: 13.0,
      });

    expect(res.status).toBe(200);
  });

  it('Academic Admin reassigns the offering to Faculty B (Dr. Hopper) with an effective date', async () => {
    const effectiveDate = new Date().toISOString();

    const res = await request(app)
      .post('/api/academic/assignments')
      .set('Authorization', `Bearer ${acadAdminToken}`)
      .send({
        offeringId,
        newFacultyId: facultyHopperId,
        effectiveDate,
        reason: 'Mid-semester research sabbatical replacement',
      });

    expect(res.status).toBe(201);
    expect(res.body.assignment.facultyId).toBe(facultyHopperId);
    expect(res.body.assignment.isActive).toBe(true);

    const turingAssignment = await prisma.teachingAssignment.findFirst({
      where: { offeringId, facultyId: facultyTuringId },
    });
    expect(turingAssignment?.isActive).toBe(false);
    expect(turingAssignment?.endDate).not.toBeNull();
  });

  it('verifies historical attribution is strictly preserved', async () => {
    const histSession = await prisma.attendanceSession.findFirst({
      where: { offeringId },
    });
    expect(histSession?.facultyId).toBe(facultyTuringId);

    const histMark = await prisma.assessmentMark.findUnique({
      where: { id: markId },
    });
    expect(histMark?.recordedByFacultyId).toBe(facultyTuringId);
  });

  it('verifies Faculty A (Turing) can no longer edit marks for this offering after reassignment', async () => {
    const mark = await prisma.assessmentMark.findUnique({ where: { id: markId } });

    const res = await request(app)
      .put(`/api/marks/${markId}`)
      .set('Authorization', `Bearer ${turingToken}`)
      .send({
        expectedVersion: mark!.version,
        marksObtained: 14.0,
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN_TEACHING_SCOPE');
    expect(res.body.message).toContain('You do not have an active teaching assignment');
  });

  it('verifies Faculty B (Hopper) now holds active authorization to update marks for this offering', async () => {
    const mark = await prisma.assessmentMark.findUnique({ where: { id: markId } });

    const res = await request(app)
      .put(`/api/marks/${markId}`)
      .set('Authorization', `Bearer ${hopperToken}`)
      .send({
        expectedVersion: mark!.version,
        marksObtained: 14.5,
      });

    expect(res.status).toBe(200);
    expect(res.body.mark.marksObtained).toBe(14.5);
    expect(res.body.mark.recordedBy.id).toBe(facultyHopperId);
  });
});
