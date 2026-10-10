import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma';
import { authenticateToken } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { logAuditEvent } from '../../middleware/audit';

export const marksRouter = Router();

const updateMarkSchema = z.object({
  expectedVersion: z.number().int().positive(),
  marksObtained: z.number().min(0).nullable().optional(),
  isAbsent: z.boolean().optional(),
});

marksRouter.get('/offering/:offeringId', authenticateToken, async (req: Request, res: Response) => {
  const { offeringId } = req.params;

  // Verify offering exists
  const offering = await prisma.courseOffering.findUnique({
    where: { id: offeringId },
    include: {
      course: true,
      components: { orderBy: { order: 'asc' } },
      enrollments: {
        include: {
          student: { include: { user: true } },
        },
      },
    },
  });

  if (!offering) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Course offering not found' });
  }

  // Scoped authorization
  if (req.user!.role === 'STUDENT') {
    const studentMarks = await prisma.assessmentMark.findMany({
      where: { offeringId, studentId: req.user!.studentProfileId },
      include: { component: true },
    });
    return res.json({ offering, marks: studentMarks });
  }

  if (req.user!.role === 'FACULTY') {
    const now = new Date();
    const assignment = await prisma.teachingAssignment.findFirst({
      where: {
        offeringId,
        facultyId: req.user!.id,
        isActive: true,
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
    });
    if (!assignment) {
      return res.status(403).json({
        error: 'FORBIDDEN_TEACHING_SCOPE',
        message: 'You are not assigned to this course offering or your assignment is not active.',
      });
    }
  }

  if (req.user!.role === 'EXAM_ADMIN') {
    if (req.user!.designatedDepartmentId !== offering.course.departmentId) {
      return res.status(403).json({
        error: 'FORBIDDEN_BRANCH_SCOPE',
        message: 'You are not the designated Exam Admin for this branch.',
      });
    }
  }

  const marks = await prisma.assessmentMark.findMany({
    where: { offeringId },
    include: {
      component: true,
      student: { include: { user: true } },
      recordedBy: { select: { id: true, name: true } },
    },
  });

  return res.json({ offering, marks });
});

/**
 * Optimistic Concurrency Controlled Mark Update
 * Scenario A requirement: Rejects stale version updates with HTTP 409
 */
marksRouter.put(
  '/:markId',
  authenticateToken,
  requireRole('FACULTY'),
  async (req: Request, res: Response) => {
    try {
      const { markId } = req.params;
      const parseResult = updateMarkSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.format() });
      }

      const { expectedVersion, marksObtained, isAbsent } = parseResult.data;

      // Fetch target mark record
      const currentMark = await prisma.assessmentMark.findUnique({
        where: { id: markId },
        include: {
          component: true,
          offering: { include: { course: true } },
        },
      });

      if (!currentMark) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Assessment mark record not found' });
      }

      // Verify Faculty Teaching Assignment Scope
      const now = new Date();
      const assignment = await prisma.teachingAssignment.findFirst({
        where: {
          offeringId: currentMark.offeringId,
          facultyId: req.user!.id,
          isActive: true,
          startDate: { lte: now },
          OR: [{ endDate: null }, { endDate: { gte: now } }],
        },
      });

      if (!assignment) {
        await logAuditEvent({
          actorUserId: req.user!.id,
          actorRole: req.user!.role,
          action: 'FACULTY_OUT_OF_SCOPE_MARK_UPDATE_ATTEMPT',
          entityType: 'AssessmentMark',
          entityId: markId,
          departmentId: currentMark.offering.course.departmentId,
          reason: 'Faculty does not have an active teaching assignment on current date for this offering',
          req,
        });

        return res.status(403).json({
          error: 'FORBIDDEN_TEACHING_SCOPE',
          message: 'You do not have an active teaching assignment for this course offering.',
        });
      }

      // Check max marks boundary
      if (marksObtained !== null && marksObtained !== undefined) {
        if (marksObtained > currentMark.component.maxMarks) {
          return res.status(400).json({
            error: 'MAX_MARKS_EXCEEDED',
            message: `Marks obtained (${marksObtained}) exceeds component maximum (${currentMark.component.maxMarks})`,
          });
        }
      }

      // --- OPTIMISTIC CONCURRENCY CHECK ---
      if (currentMark.version !== expectedVersion) {
        await logAuditEvent({
          actorUserId: req.user!.id,
          actorRole: req.user!.role,
          action: 'CONCURRENT_MODIFICATION_CONFLICT',
          entityType: 'AssessmentMark',
          entityId: markId,
          departmentId: currentMark.offering.course.departmentId,
          reason: `Stale version submission. Expected ${expectedVersion}, but database is at ${currentMark.version}`,
          oldData: { version: currentMark.version, marks: currentMark.marksObtained },
          newData: { expectedVersion, marks: marksObtained },
          req,
        });

        return res.status(409).json({
          error: 'CONCURRENT_MODIFICATION_CONFLICT',
          message: 'Record was modified by another session. Please reload latest data and review changes before resubmitting.',
          currentVersion: currentMark.version,
          staleVersion: expectedVersion,
          currentData: {
            marksObtained: currentMark.marksObtained,
            isAbsent: currentMark.isAbsent,
            recordedByFacultyId: currentMark.recordedByFacultyId,
            updatedAt: currentMark.updatedAt,
          },
        });
      }

      // Atomically update mark and increment version
      const updatedMark = await prisma.assessmentMark.update({
        where: {
          id: markId,
          version: expectedVersion, // Database-level guard ensuring atomic version match
        },
        data: {
          marksObtained: isAbsent ? null : marksObtained,
          isAbsent: isAbsent ?? false,
          recordedByFacultyId: req.user!.id,
          version: { increment: 1 },
          updatedAt: new Date(),
        },
        include: {
          recordedBy: { select: { id: true, name: true } },
          component: true,
        },
      });

      await logAuditEvent({
        actorUserId: req.user!.id,
        actorRole: req.user!.role,
        action: 'MARKS_UPDATED',
        entityType: 'AssessmentMark',
        entityId: markId,
        departmentId: currentMark.offering.course.departmentId,
        oldData: { marks: currentMark.marksObtained, version: currentMark.version },
        newData: { marks: updatedMark.marksObtained, version: updatedMark.version },
        req,
      });

      return res.json({
        message: 'Marks updated successfully',
        mark: updatedMark,
      });
    } catch (err: any) {
      console.error('Error updating marks:', err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }
);

// ============================================================================
// FACULTY ASSESSMENT SUBMISSION FOR VERIFICATION
// ============================================================================

marksRouter.post(
  '/submit/:offeringId',
  authenticateToken,
  requireRole('FACULTY'),
  async (req: Request, res: Response) => {
    try {
      const { offeringId } = req.params;

      const now = new Date();
      const assignment = await prisma.teachingAssignment.findFirst({
        where: {
          offeringId,
          facultyId: req.user!.id,
          isActive: true,
          startDate: { lte: now },
          OR: [{ endDate: null }, { endDate: { gte: now } }],
        },
      });

      if (!assignment) {
        return res.status(403).json({
          error: 'FORBIDDEN_TEACHING_SCOPE',
          message: 'You do not have an active teaching assignment for this course offering.',
        });
      }

      const updateResult = await prisma.assessmentMark.updateMany({
        where: { offeringId, status: 'DRAFT' },
        data: { status: 'SUBMITTED' },
      });

      await logAuditEvent({
        actorUserId: req.user!.id,
        actorRole: req.user!.role,
        action: 'INTERNAL_MARKS_SUBMITTED_FOR_VERIFICATION',
        entityType: 'CourseOffering',
        entityId: offeringId,
        newData: { submittedRecords: updateResult.count },
        req,
      });

      return res.json({
        message: `Successfully submitted ${updateResult.count} marks records for examination verification.`,
        submittedCount: updateResult.count,
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }
);

// ============================================================================
// STUDENT DETAILED MARKS OVERVIEW (Mid-1, Mid-2, Quiz, Internal /40, External /60, Total /100)
// ============================================================================

marksRouter.get('/student/:studentProfileId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { studentProfileId } = req.params;

    if (req.user!.role === 'STUDENT' && req.user!.studentProfileId !== studentProfileId) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'You can only view your own marks' });
    }

    const marks = await prisma.assessmentMark.findMany({
      where: { studentId: studentProfileId },
      include: {
        component: true,
        offering: {
          include: {
            course: true,
            results: { where: { studentId: studentProfileId } },
          },
        },
      },
      orderBy: { component: { order: 'asc' } },
    });

    // Group by course offering
    const courseMap: Record<string, any> = {};

    marks.forEach((m) => {
      const offId = m.offeringId;
      if (!courseMap[offId]) {
        const publishedRes = m.offering.results[0];
        courseMap[offId] = {
          offeringId: offId,
          courseCode: m.offering.course.code,
          courseTitle: m.offering.course.title,
          credits: m.offering.course.credits,
          components: [],
          internalTotal: 0,
          internalMax: 40,
          externalMarks: publishedRes ? publishedRes.externalMarks : null,
          externalMax: 60,
          totalMarks: publishedRes ? publishedRes.totalMarks : null,
          totalMax: 100,
          grade: publishedRes ? publishedRes.grade : null,
          status: publishedRes ? publishedRes.publicationState : 'IN_PROGRESS',
        };
      }

      courseMap[offId].components.push({
        name: m.component.name,
        type: m.component.type,
        maxMarks: m.component.maxMarks,
        marksObtained: m.marksObtained,
        isAbsent: m.isAbsent,
        status: m.status,
      });

      if (m.component.type === 'INTERNAL' && m.marksObtained !== null) {
        courseMap[offId].internalTotal += m.marksObtained;
      }
    });

    return res.json({ courses: Object.values(courseMap) });
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

