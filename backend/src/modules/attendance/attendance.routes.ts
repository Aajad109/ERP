import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma';
import { authenticateToken } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { logAuditEvent } from '../../middleware/audit';

export const attendanceRouter = Router();

attendanceRouter.get('/offering/:offeringId', authenticateToken, async (req: Request, res: Response) => {
  const { offeringId } = req.params;

  if (req.user!.role === 'STUDENT') {
    const studentRecords = await prisma.attendanceRecord.findMany({
      where: {
        studentId: req.user!.studentProfileId,
        session: { offeringId },
      },
      include: {
        session: true,
      },
    });

    const totalSessions = await prisma.attendanceSession.count({ where: { offeringId } });
    const presentCount = studentRecords.filter((r) => r.isPresent).length;
    const percentage = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 1000) / 10 : 0;

    return res.json({
      records: studentRecords,
      totalSessions,
      presentCount,
      percentage,
    });
  }

  const sessions = await prisma.attendanceSession.findMany({
    where: { offeringId },
    include: {
      faculty: { select: { id: true, name: true } },
      records: { include: { student: { include: { user: true } } } },
    },
    orderBy: { sessionDate: 'desc' },
  });

  return res.json({ sessions });
});

const createSessionSchema = z.object({
  offeringId: z.string().uuid(),
  topic: z.string().min(2),
  sessionDate: z.string().optional(),
  records: z.array(
    z.object({
      studentId: z.string().uuid(),
      isPresent: z.boolean(),
    })
  ),
});

attendanceRouter.post(
  '/session',
  authenticateToken,
  requireRole('FACULTY'),
  async (req: Request, res: Response) => {
    try {
      const parseResult = createSessionSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.format() });
      }

      const { offeringId, topic, sessionDate, records } = parseResult.data;

      // Verify faculty teaching assignment scope
      const now = new Date();
      const assignment = await prisma.teachingAssignment.findFirst({
        where: {
          offeringId,
          facultyId: req.user!.id,
          isActive: true,
          OR: [{ endDate: null }, { endDate: { gte: now } }],
        },
      });

      if (!assignment) {
        return res.status(403).json({
          error: 'FORBIDDEN_TEACHING_SCOPE',
          message: 'You do not have an active teaching assignment for this course offering.',
        });
      }

      const session = await prisma.$transaction(async (tx) => {
        const s = await tx.attendanceSession.create({
          data: {
            offeringId,
            facultyId: req.user!.id,
            topic,
            sessionDate: sessionDate ? new Date(sessionDate) : new Date(),
          },
        });

        for (const rec of records) {
          await tx.attendanceRecord.create({
            data: {
              sessionId: s.id,
              studentId: rec.studentId,
              isPresent: rec.isPresent,
              version: 1,
            },
          });
        }

        return s;
      });

      await logAuditEvent({
        actorUserId: req.user!.id,
        actorRole: req.user!.role,
        action: 'ATTENDANCE_SESSION_RECORDED',
        entityType: 'AttendanceSession',
        entityId: session.id,
        req,
      });

      return res.status(201).json({ message: 'Attendance session recorded', session });
    } catch (err: any) {
      if (err.code === 'P2002') {
        return res.status(409).json({
          error: 'CONCURRENT_MODIFICATION_CONFLICT',
          message: 'An attendance record for this student and session already exists. Duplicate insert rejected with 409 Conflict.',
        });
      }
      console.error('Attendance recording error:', err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }
);

/**
 * Atomic version checking for AttendanceRecord updates (Scenario A / Concurrency requirement)
 */
const updateAttendanceRecordSchema = z.object({
  expectedVersion: z.number().int().positive(),
  isPresent: z.boolean(),
});

attendanceRouter.put(
  '/record/:recordId',
  authenticateToken,
  requireRole('FACULTY'),
  async (req: Request, res: Response) => {
    try {
      const { recordId } = req.params;
      const parseResult = updateAttendanceRecordSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.format() });
      }

      const { expectedVersion, isPresent } = parseResult.data;

      const existingRecord = await prisma.attendanceRecord.findUnique({
        where: { id: recordId },
        include: { session: true },
      });

      if (!existingRecord) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Attendance record not found' });
      }

      // Teaching assignment verification
      const now = new Date();
      const assignment = await prisma.teachingAssignment.findFirst({
        where: {
          offeringId: existingRecord.session.offeringId,
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

      if (existingRecord.version !== expectedVersion) {
        return res.status(409).json({
          error: 'CONCURRENT_MODIFICATION_CONFLICT',
          message: 'Record was modified by another session. Please reload latest data and review changes before resubmitting.',
          currentVersion: existingRecord.version,
          staleVersion: expectedVersion,
        });
      }

      const updated = await prisma.attendanceRecord.update({
        where: { id: recordId, version: expectedVersion },
        data: {
          isPresent,
          version: { increment: 1 },
        },
      });

      await logAuditEvent({
        actorUserId: req.user!.id,
        actorRole: req.user!.role,
        action: 'ATTENDANCE_RECORD_UPDATED',
        entityType: 'AttendanceRecord',
        entityId: recordId,
        oldData: { isPresent: existingRecord.isPresent, version: existingRecord.version },
        newData: { isPresent: updated.isPresent, version: updated.version },
        req,
      });

      return res.json({ message: 'Attendance record updated successfully', record: updated });
    } catch (err: any) {
      if (err.code === 'P2002') {
        return res.status(409).json({
          error: 'CONCURRENT_MODIFICATION_CONFLICT',
          message: 'Concurrent conflict detected.',
        });
      }
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }
);

/**
 * Detailed Student Attendance Analytics (Across all enrolled courses)
 */
attendanceRouter.get('/student/:studentProfileId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { studentProfileId } = req.params;

    // Student can only view own attendance
    if (req.user!.role === 'STUDENT' && req.user!.studentProfileId !== studentProfileId) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'You can only view your own attendance records' });
    }

    const enrollments = await prisma.courseEnrollment.findMany({
      where: { studentId: studentProfileId },
      include: {
        offering: {
          include: {
            course: true,
            attendanceSessions: {
              include: {
                records: {
                  where: { studentId: studentProfileId },
                },
              },
              orderBy: { sessionDate: 'asc' },
            },
          },
        },
      },
    });

    const subjectBreakdown = enrollments.map((enr) => {
      const sessions = enr.offering.attendanceSessions;
      const totalSessions = sessions.length;
      let attendedCount = 0;

      sessions.forEach((s) => {
        if (s.records.length > 0 && s.records[0].isPresent) {
          attendedCount++;
        }
      });

      const missedCount = totalSessions - attendedCount;
      const percentage = totalSessions > 0 ? Math.round((attendedCount / totalSessions) * 1000) / 10 : 100;
      const isShortage = percentage < 75;

      return {
        offeringId: enr.offering.id,
        courseCode: enr.offering.course.code,
        courseTitle: enr.offering.course.title,
        credits: enr.offering.course.credits,
        totalSessions,
        attendedCount,
        missedCount,
        percentage,
        isShortage,
      };
    });

    const totalSessionsAll = subjectBreakdown.reduce((acc, curr) => acc + curr.totalSessions, 0);
    const attendedAll = subjectBreakdown.reduce((acc, curr) => acc + curr.attendedCount, 0);
    const overallPercentage = totalSessionsAll > 0 ? Math.round((attendedAll / totalSessionsAll) * 1000) / 10 : 100;

    return res.json({
      overallPercentage,
      totalSessionsAll,
      attendedAll,
      overallShortage: overallPercentage < 75,
      subjectBreakdown,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});
