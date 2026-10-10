import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { logAuditEvent } from './audit';

export function requireRole(...allowedRoles: Array<'STUDENT' | 'FACULTY' | 'ACADEMIC_ADMIN' | 'EXAM_ADMIN'>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      await logAuditEvent({
        actorUserId: req.user.id,
        actorRole: req.user.role,
        action: 'UNAUTHORIZED_ROLE_ACCESS_ATTEMPT',
        entityType: 'ENDPOINT',
        entityId: req.originalUrl,
        reason: `Role ${req.user.role} attempted to access endpoint requiring [${allowedRoles.join(', ')}]`,
        req,
      });

      return res.status(403).json({
        error: 'FORBIDDEN',
        message: `Your role (${req.user.role}) is not authorized to perform this action.`,
      });
    }

    next();
  };
}

/**
 * Validates that the faculty has an active, effective-dated teaching assignment for the offering
 */
export async function verifyFacultyOfferingScope(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'FACULTY') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Only faculty can perform this action' });
  }

  const offeringId = req.params.offeringId || req.body.offeringId;
  if (!offeringId) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Offering ID is required' });
  }

  const now = new Date();

  // Find active assignment where startDate <= now and (endDate is null or endDate >= now)
  const assignment = await prisma.teachingAssignment.findFirst({
    where: {
      offeringId,
      facultyId: req.user.id,
      isActive: true,
      startDate: { lte: now },
      OR: [
        { endDate: null },
        { endDate: { gte: now } },
      ],
    },
  });

  if (!assignment) {
    await logAuditEvent({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'FACULTY_OUT_OF_SCOPE_ATTEMPT',
      entityType: 'CourseOffering',
      entityId: offeringId,
      reason: 'Faculty does not hold an active effective-dated teaching assignment for this course offering',
      req,
    });

    return res.status(403).json({
      error: 'FORBIDDEN_TEACHING_SCOPE',
      message: 'You do not have an active teaching assignment for this course offering at the current date.',
    });
  }

  next();
}

/**
 * Validates that an Examination Admin is designated for the branch of the target offering/department
 */
export async function verifyExamAdminBranchScope(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'EXAM_ADMIN') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Only Examination Admin can perform this action' });
  }

  let departmentId = req.params.departmentId || req.body.departmentId;

  if (!departmentId) {
    const offeringId = req.params.offeringId || req.body.offeringId;
    if (offeringId) {
      const offering = await prisma.courseOffering.findUnique({
        where: { id: offeringId },
        include: { course: true },
      });
      departmentId = offering?.course.departmentId;
    }
  }

  if (!departmentId) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Target department/branch could not be resolved' });
  }

  // Check backend designation
  if (req.user.designatedDepartmentId !== departmentId) {
    await logAuditEvent({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'EXAM_ADMIN_WRONG_BRANCH_ATTEMPT',
      entityType: 'Department',
      entityId: departmentId,
      departmentId,
      reason: `Exam Admin designated for ${req.user.designatedDepartmentId} attempted examination operation on branch ${departmentId}`,
      req,
    });

    return res.status(403).json({
      error: 'FORBIDDEN_BRANCH_SCOPE',
      message: 'You are not the designated Examination Admin for this branch/department.',
    });
  }

  next();
}

/**
 * Student ownership check: ensures student can only access their own profile/records
 */
export function verifyStudentOwnership(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
  }

  // If role is STUDENT, ensure studentId belongs to this student
  if (req.user.role === 'STUDENT') {
    const requestedStudentId = req.params.studentId || req.query.studentId;
    if (requestedStudentId && requestedStudentId !== req.user.studentProfileId) {
      logAuditEvent({
        actorUserId: req.user.id,
        actorRole: req.user.role,
        action: 'IDOR_STUDENT_CROSS_ACCESS_ATTEMPT',
        entityType: 'StudentProfile',
        entityId: String(requestedStudentId),
        reason: 'Student attempted to access another student private record',
        req,
      });

      return res.status(403).json({
        error: 'FORBIDDEN_STUDENT_SCOPE',
        message: 'Access denied: You can only view your own academic records.',
      });
    }
  }

  next();
}
