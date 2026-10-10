import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma';
import { authenticateToken } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { logAuditEvent } from '../../middleware/audit';
import bcrypt from 'bcryptjs';

export const academicRouter = Router();

academicRouter.get('/departments', authenticateToken, async (req: Request, res: Response) => {
  const departments = await prisma.department.findMany({
    include: {
      examAdminDesignations: {
        where: { isActive: true },
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  return res.json({ departments });
});

const createDepartmentSchema = z.object({
  code: z.string().min(2).max(10),
  name: z.string().min(3).max(100),
});

academicRouter.post(
  '/departments',
  authenticateToken,
  requireRole('ACADEMIC_ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const parsed = createDepartmentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.format() });
      }

      const codeUpper = parsed.data.code.trim().toUpperCase();
      const nameTrimmed = parsed.data.name.trim();

      const existing = await prisma.department.findUnique({
        where: { code: codeUpper },
      });

      if (existing) {
        return res.status(409).json({
          error: 'DUPLICATE_DEPARTMENT',
          message: `Department with code '${codeUpper}' already exists`,
        });
      }

      const department = await prisma.$transaction(async (tx) => {
        const dept = await tx.department.create({
          data: {
            code: codeUpper,
            name: nameTrimmed,
          },
        });

        const allBatches = await tx.batch.findMany();
        const sectionNames = ['A', 'B', 'C', 'D'];

        for (const b of allBatches) {
          for (const s of sectionNames) {
            await tx.section.create({
              data: {
                name: s,
                batchId: b.id,
                departmentId: dept.id,
              },
            });
          }
        }

        return dept;
      });

      await logAuditEvent({
        actorUserId: req.user!.id,
        actorRole: req.user!.role,
        action: 'DEPARTMENT_CREATED',
        entityType: 'Department',
        entityId: department.id,
        departmentId: department.id,
        newData: department,
        req,
      });

      return res.status(201).json({
        message: 'Department created successfully with standard sections initialized',
        department,
      });
    } catch (err: any) {
      console.error('Create department error:', err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }
);

academicRouter.get('/batches', authenticateToken, async (req: Request, res: Response) => {
  const batches = await prisma.batch.findMany({
    include: {
      sections: true,
    },
  });
  return res.json({ batches });
});

academicRouter.get('/offerings', authenticateToken, async (req: Request, res: Response) => {
  const offerings = await prisma.courseOffering.findMany({
    include: {
      course: { include: { department: true } },
      batch: true,
      section: true,
      components: true,
      teachingAssignments: {
        include: {
          faculty: { select: { id: true, name: true, email: true } },
          assignedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  return res.json({ offerings });
});

academicRouter.get('/faculty', authenticateToken, async (req: Request, res: Response) => {
  const faculty = await prisma.user.findMany({
    where: { role: 'FACULTY', isActive: true },
    select: { id: true, name: true, email: true, departmentId: true },
  });
  return res.json({ faculty });
});

const assignmentSchema = z.object({
  offeringId: z.string().uuid(),
  newFacultyId: z.string().uuid(),
  effectiveDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  reason: z.string().min(3),
});

/**
 * Mid-Semester Reassignment Endpoint (Academic Admin only)
 * Scenario D requirement: Ends previous faculty assignment as of effectiveDate and activates new assignment
 */
academicRouter.post(
  '/assignments',
  authenticateToken,
  requireRole('ACADEMIC_ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const parseResult = assignmentSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.format() });
      }

      const { offeringId, newFacultyId, effectiveDate, reason } = parseResult.data;
      const effectiveDateTime = new Date(effectiveDate);

      // Verify offering exists
      const offering = await prisma.courseOffering.findUnique({
        where: { id: offeringId },
        include: { course: true },
      });
      if (!offering) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Course offering not found' });
      }

      // Verify new faculty exists and has active FACULTY role
      const newFaculty = await prisma.user.findUnique({
        where: { id: newFacultyId },
      });
      if (!newFaculty || newFaculty.role !== 'FACULTY') {
        return res.status(400).json({ error: 'INVALID_FACULTY', message: 'Target user is not a valid faculty member' });
      }
      if (!newFaculty.isActive) {
        return res.status(400).json({
          error: 'FACULTY_ACCOUNT_DEACTIVATED',
          message: 'Cannot assign a deactivated faculty member to a course offering.',
        });
      }

      // Execute reassignment transaction
      const result = await prisma.$transaction(async (tx) => {
        // Find existing active assignment(s)
        const activeAssignments = await tx.teachingAssignment.findMany({
          where: { offeringId, isActive: true },
        });

        // Terminate existing active assignments at effectiveDateTime
        for (const existing of activeAssignments) {
          await tx.teachingAssignment.update({
            where: { id: existing.id },
            data: {
              isActive: false,
              endDate: effectiveDateTime,
              updatedAt: new Date(),
            },
          });
        }

        // Create new teaching assignment
        const newAssignment = await tx.teachingAssignment.create({
          data: {
            offeringId,
            facultyId: newFacultyId,
            startDate: effectiveDateTime,
            isActive: true,
            reason,
            assignedById: req.user!.id,
          },
          include: {
            faculty: { select: { id: true, name: true, email: true } },
          },
        });

        return { previous: activeAssignments, current: newAssignment };
      });

      // Log audit
      await logAuditEvent({
        actorUserId: req.user!.id,
        actorRole: req.user!.role,
        action: 'FACULTY_REASSIGNMENT',
        entityType: 'TeachingAssignment',
        entityId: result.current.id,
        departmentId: offering.course.departmentId,
        reason,
        oldData: result.previous,
        newData: result.current,
        req,
      });

      return res.status(201).json({
        message: 'Faculty reassignment successful with effective date',
        assignment: result.current,
        previousAssignments: result.previous,
      });
    } catch (err: any) {
      console.error('Reassignment error:', err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }
);

academicRouter.get('/offerings/:offeringId/assignments', authenticateToken, async (req: Request, res: Response) => {
  const { offeringId } = req.params;
  const assignments = await prisma.teachingAssignment.findMany({
    where: { offeringId },
    include: {
      faculty: { select: { id: true, name: true, email: true } },
      assignedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return res.json({ assignments });
});

// ============================================================================
// COURSE MANAGEMENT & OFFERINGS
// ============================================================================

academicRouter.get('/courses', authenticateToken, async (req: Request, res: Response) => {
  const courses = await prisma.course.findMany({
    include: { department: true },
    orderBy: { code: 'asc' },
  });
  return res.json({ courses });
});

const createCourseSchema = z.object({
  code: z.string().min(2).max(20),
  title: z.string().min(3).max(100),
  departmentId: z.string().uuid(),
  credits: z.number().int().min(1).max(6).default(4),
  isTheory: z.boolean().default(true),
  isLab: z.boolean().default(false),
});

academicRouter.post(
  '/courses',
  authenticateToken,
  requireRole('ACADEMIC_ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const parsed = createCourseSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.format() });
      }

      const existing = await prisma.course.findUnique({ where: { code: parsed.data.code } });
      if (existing) {
        return res.status(409).json({ error: 'DUPLICATE_COURSE', message: `Course with code ${parsed.data.code} already exists` });
      }

      const course = await prisma.course.create({
        data: parsed.data,
        include: { department: true },
      });

      await logAuditEvent({
        actorUserId: req.user!.id,
        actorRole: req.user!.role,
        action: 'COURSE_CREATED',
        entityType: 'Course',
        entityId: course.id,
        departmentId: course.departmentId,
        newData: course,
        req,
      });

      return res.status(201).json({ message: 'Course created successfully', course });
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }
);

const createOfferingSchema = z.object({
  courseId: z.string().uuid(),
  batchId: z.string().uuid(),
  sectionId: z.string().uuid(),
  semester: z.number().int().min(1).max(8),
  academicYear: z.string().min(4),
});

academicRouter.post(
  '/offerings',
  authenticateToken,
  requireRole('ACADEMIC_ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const parsed = createOfferingSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.format() });
      }

      const { courseId, batchId, sectionId, semester, academicYear } = parsed.data;

      const offering = await prisma.$transaction(async (tx) => {
        const off = await tx.courseOffering.create({
          data: {
            courseId,
            batchId,
            sectionId,
            semester,
            academicYear,
            status: 'ACTIVE',
          },
          include: {
            course: { include: { department: true } },
            batch: true,
            section: true,
          },
        });

        // Seed default assessment components (Mid-1: 15, Mid-2: 15, Quiz: 10, External: 60)
        await tx.assessmentComponent.createMany({
          data: [
            { offeringId: off.id, name: 'Mid-1 Assessment', type: 'INTERNAL', maxMarks: 15, order: 1 },
            { offeringId: off.id, name: 'Mid-2 Assessment', type: 'INTERNAL', maxMarks: 15, order: 2 },
            { offeringId: off.id, name: 'Quizzes / Continuous Assessment', type: 'INTERNAL', maxMarks: 10, order: 3 },
            { offeringId: off.id, name: 'End-Semester External Exam', type: 'EXTERNAL', maxMarks: 60, order: 4 },
          ],
        });

        return off;
      });

      await logAuditEvent({
        actorUserId: req.user!.id,
        actorRole: req.user!.role,
        action: 'COURSE_OFFERING_CREATED',
        entityType: 'CourseOffering',
        entityId: offering.id,
        departmentId: offering.course.departmentId,
        newData: offering,
        req,
      });

      return res.status(201).json({ message: 'Course offering and assessment components initialized', offering });
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }
);

// ============================================================================
// STUDENT & FACULTY ACCOUNTS MANAGEMENT
// ============================================================================

academicRouter.get('/students', authenticateToken, async (req: Request, res: Response) => {
  const students = await prisma.studentProfile.findMany({
    include: {
      user: { select: { id: true, name: true, email: true, isActive: true } },
      department: true,
      batch: true,
      section: true,
      enrollments: { include: { offering: { include: { course: true } } } },
    },
    orderBy: { rollNumber: 'asc' },
  });
  return res.json({ students });
});

const createStudentSchema = z.object({
  rollNumber: z.string().min(3),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  departmentId: z.string().uuid(),
  batchId: z.string().uuid(),
  sectionId: z.string().uuid(),
  semester: z.number().int().min(1).max(8).default(1),
});

academicRouter.post(
  '/students',
  authenticateToken,
  requireRole('ACADEMIC_ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const parsed = createStudentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.format() });
      }

      const { rollNumber, name, email, password, departmentId, batchId, sectionId, semester } = parsed.data;

      const existingRoll = await prisma.studentProfile.findUnique({ where: { rollNumber } });
      if (existingRoll) {
        return res.status(409).json({ error: 'DUPLICATE_ROLL', message: `Roll number ${rollNumber} already exists` });
      }

      const existingEmail = await prisma.user.findUnique({ where: { email } });
      if (existingEmail) {
        return res.status(409).json({ error: 'DUPLICATE_EMAIL', message: `Email ${email} is already in use` });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const created = await prisma.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: {
            email,
            passwordHash,
            name,
            role: 'STUDENT',
            departmentId,
            isActive: true,
          },
        });

        const profile = await tx.studentProfile.create({
          data: {
            userId: u.id,
            rollNumber,
            departmentId,
            batchId,
            sectionId,
            currentSemester: semester,
          },
          include: {
            user: { select: { id: true, name: true, email: true } },
            department: true,
            batch: true,
            section: true,
          },
        });

        return profile;
      });

      await logAuditEvent({
        actorUserId: req.user!.id,
        actorRole: req.user!.role,
        action: 'STUDENT_ACCOUNT_CREATED',
        entityType: 'StudentProfile',
        entityId: created.id,
        departmentId,
        newData: created,
        req,
      });

      return res.status(201).json({ message: 'Student account created successfully', student: created });
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }
);

academicRouter.get('/faculty-accounts', authenticateToken, async (req: Request, res: Response) => {
  const faculty = await prisma.facultyProfile.findMany({
    include: {
      user: { select: { id: true, name: true, email: true, isActive: true } },
      department: true,
    },
    orderBy: { employeeId: 'asc' },
  });
  return res.json({ faculty });
});

const createFacultySchema = z.object({
  employeeId: z.string().min(3),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  departmentId: z.string().uuid(),
  designation: z.string().min(2),
});

academicRouter.post(
  '/faculty',
  authenticateToken,
  requireRole('ACADEMIC_ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const parsed = createFacultySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.format() });
      }

      const { employeeId, name, email, password, departmentId, designation } = parsed.data;

      const existingEmp = await prisma.facultyProfile.findUnique({ where: { employeeId } });
      if (existingEmp) {
        return res.status(409).json({ error: 'DUPLICATE_EMPLOYEE_ID', message: `Employee ID ${employeeId} already exists` });
      }

      const existingEmail = await prisma.user.findUnique({ where: { email } });
      if (existingEmail) {
        return res.status(409).json({ error: 'DUPLICATE_EMAIL', message: `Email ${email} is already in use` });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const created = await prisma.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: {
            email,
            passwordHash,
            name,
            role: 'FACULTY',
            departmentId,
            isActive: true,
          },
        });

        const profile = await tx.facultyProfile.create({
          data: {
            userId: u.id,
            employeeId,
            departmentId,
            designation,
          },
          include: {
            user: { select: { id: true, name: true, email: true } },
            department: true,
          },
        });

        return profile;
      });

      await logAuditEvent({
        actorUserId: req.user!.id,
        actorRole: req.user!.role,
        action: 'FACULTY_ACCOUNT_CREATED',
        entityType: 'FacultyProfile',
        entityId: created.id,
        departmentId,
        newData: created,
        req,
      });

      return res.status(201).json({ message: 'Faculty account created successfully', faculty: created });
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }
);

// ============================================================================
// ACCOUNT DEACTIVATION / REACTIVATION (STUDENTS & FACULTY)
// ============================================================================

const toggleUserStatusSchema = z.object({
  isActive: z.boolean(),
  reason: z.string().optional(),
});

academicRouter.put(
  '/users/:userId/status',
  authenticateToken,
  requireRole('ACADEMIC_ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const parseResult = toggleUserStatusSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.format() });
      }

      if (req.user!.id === userId) {
        return res.status(400).json({
          error: 'SELF_DEACTIVATION_PREVENTED',
          message: 'Academic Administrators cannot deactivate their own administrative account.',
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { studentProfile: true, facultyProfile: true },
      });

      if (!user) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
      }

      const { isActive, reason } = parseResult.data;

      const updatedUser = await prisma.$transaction(async (tx) => {
        const u = await tx.user.update({
          where: { id: userId },
          data: { isActive },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            departmentId: true,
          },
        });

        // If faculty is deactivated, mark active teaching assignments as terminated
        if (!isActive && user.role === 'FACULTY') {
          await tx.teachingAssignment.updateMany({
            where: { facultyId: userId, isActive: true },
            data: {
              isActive: false,
              endDate: new Date(),
            },
          });
        }

        return u;
      });

      await logAuditEvent({
        actorUserId: req.user!.id,
        actorRole: req.user!.role,
        action: isActive ? 'USER_ACCOUNT_REACTIVATED' : 'USER_ACCOUNT_DEACTIVATED',
        entityType: 'User',
        entityId: userId,
        departmentId: user.departmentId,
        reason: reason || (isActive ? 'Reactivated by Academic Administration' : 'Deactivated by Academic Administration'),
        oldData: { isActive: user.isActive },
        newData: { isActive, reason },
        req,
      });

      return res.json({
        message: `Account for ${updatedUser.name} (${updatedUser.role}) has been ${isActive ? 'reactivated' : 'deactivated'} successfully.`,
        user: updatedUser,
      });
    } catch (err: any) {
      console.error('Toggle status error:', err);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }
);

academicRouter.put(
  '/students/:studentProfileId/status',
  authenticateToken,
  requireRole('ACADEMIC_ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const student = await prisma.studentProfile.findUnique({
        where: { id: req.params.studentProfileId },
        include: { user: true },
      });
      if (!student) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Student profile not found' });
      }

      const parseResult = toggleUserStatusSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.format() });
      }

      const { isActive, reason } = parseResult.data;

      const updatedUser = await prisma.user.update({
        where: { id: student.userId },
        data: { isActive },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          departmentId: true,
        },
      });

      await logAuditEvent({
        actorUserId: req.user!.id,
        actorRole: req.user!.role,
        action: isActive ? 'STUDENT_ACCOUNT_REACTIVATED' : 'STUDENT_ACCOUNT_DEACTIVATED',
        entityType: 'StudentProfile',
        entityId: student.id,
        departmentId: student.departmentId,
        reason: reason || (isActive ? 'Student reactivated by Academic Administration' : 'Student deactivated by Academic Administration'),
        oldData: { isActive: student.user.isActive },
        newData: { isActive, reason },
        req,
      });

      return res.json({
        message: `Student account for ${student.user.name} (${student.rollNumber}) has been ${isActive ? 'reactivated' : 'deactivated'} successfully.`,
        user: updatedUser,
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }
);

academicRouter.put(
  '/faculty/:facultyProfileId/status',
  authenticateToken,
  requireRole('ACADEMIC_ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const faculty = await prisma.facultyProfile.findUnique({
        where: { id: req.params.facultyProfileId },
        include: { user: true },
      });
      if (!faculty) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Faculty profile not found' });
      }

      const parseResult = toggleUserStatusSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.format() });
      }

      const { isActive, reason } = parseResult.data;

      const updatedUser = await prisma.$transaction(async (tx) => {
        const u = await tx.user.update({
          where: { id: faculty.userId },
          data: { isActive },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            departmentId: true,
          },
        });

        if (!isActive) {
          await tx.teachingAssignment.updateMany({
            where: { facultyId: faculty.userId, isActive: true },
            data: {
              isActive: false,
              endDate: new Date(),
            },
          });
        }

        return u;
      });

      await logAuditEvent({
        actorUserId: req.user!.id,
        actorRole: req.user!.role,
        action: isActive ? 'FACULTY_ACCOUNT_REACTIVATED' : 'FACULTY_ACCOUNT_DEACTIVATED',
        entityType: 'FacultyProfile',
        entityId: faculty.id,
        departmentId: faculty.departmentId,
        reason: reason || (isActive ? 'Faculty reactivated by Academic Administration' : 'Faculty deactivated by Academic Administration'),
        oldData: { isActive: faculty.user.isActive },
        newData: { isActive, reason },
        req,
      });

      return res.json({
        message: `Faculty account for ${faculty.user.name} (${faculty.employeeId}) has been ${isActive ? 'reactivated' : 'deactivated'} successfully.`,
        user: updatedUser,
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }
);

// ============================================================================
// STUDENT ENROLLMENT
// ============================================================================

const enrollStudentSchema = z.object({
  offeringId: z.string().uuid(),
  studentId: z.string().uuid(),
});

academicRouter.post(
  '/enrollments',
  authenticateToken,
  requireRole('ACADEMIC_ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const parsed = enrollStudentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.format() });
      }

      const { offeringId, studentId } = parsed.data;

      const student = await prisma.studentProfile.findUnique({
        where: { id: studentId },
        include: { user: true },
      });

      if (!student) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Student profile not found' });
      }

      if (!student.user.isActive) {
        return res.status(400).json({
          error: 'STUDENT_ACCOUNT_DEACTIVATED',
          message: `Cannot enroll student ${student.rollNumber} (${student.user.name}) because the student account is deactivated.`,
        });
      }

      const existing = await prisma.courseEnrollment.findUnique({
        where: { offeringId_studentId: { offeringId, studentId } },
      });

      if (existing) {
        return res.status(409).json({ error: 'DUPLICATE_ENROLLMENT', message: 'Student is already enrolled in this offering' });
      }

      const enrollment = await prisma.courseEnrollment.create({
        data: { offeringId, studentId },
        include: { student: { include: { user: true } }, offering: { include: { course: true } } },
      });

      return res.status(201).json({ message: 'Student enrolled successfully', enrollment });
    } catch (err: any) {
      if (err.code === 'P2002') {
        return res.status(409).json({ error: 'DUPLICATE_ENROLLMENT', message: 'Student is already enrolled in this offering' });
      }
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }
);

// ============================================================================
// OFFICIAL TIMETABLE
// ============================================================================

academicRouter.get('/timetable', authenticateToken, async (req: Request, res: Response) => {
  const { offeringId } = req.query;
  const where: any = {};
  if (offeringId) where.offeringId = String(offeringId);

  const slots = await prisma.timetableSlot.findMany({
    where,
    include: {
      offering: {
        include: {
          course: true,
          section: true,
          batch: true,
          teachingAssignments: { where: { isActive: true }, include: { faculty: true } },
        },
      },
    },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });
  return res.json({ slots });
});

const createTimetableSlotSchema = z.object({
  offeringId: z.string().uuid(),
  dayOfWeek: z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  roomNumber: z.string().min(2),
});

academicRouter.post(
  '/timetable',
  authenticateToken,
  requireRole('ACADEMIC_ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const parsed = createTimetableSlotSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.format() });
      }

      const { offeringId, dayOfWeek, startTime, endTime, roomNumber } = parsed.data;

      // Check collision
      const collision = await prisma.timetableSlot.findFirst({
        where: { dayOfWeek, startTime, roomNumber },
      });

      if (collision) {
        return res.status(409).json({
          error: 'ROOM_CONFLICT',
          message: `Room ${roomNumber} is already occupied on ${dayOfWeek} at ${startTime}`,
        });
      }

      const slot = await prisma.timetableSlot.create({
        data: { offeringId, dayOfWeek, startTime, endTime, roomNumber },
        include: { offering: { include: { course: true } } },
      });

      return res.status(201).json({ message: 'Timetable slot created successfully', slot });
    } catch (err: any) {
      if (err.code === 'P2002') {
        return res.status(409).json({ error: 'TIMETABLE_CONFLICT', message: 'Room/Time slot conflict detected' });
      }
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }
);

// ============================================================================
// SEMESTER PROGRESSION (IDEMPOTENT & AUDITABLE)
// ============================================================================

const progressSemesterSchema = z.object({
  batchId: z.string().uuid(),
  targetSemester: z.number().int().min(2).max(8),
  academicYear: z.string(),
});

academicRouter.post(
  '/progress-semester',
  authenticateToken,
  requireRole('ACADEMIC_ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const parsed = progressSemesterSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.format() });
      }

      const { batchId, targetSemester, academicYear } = parsed.data;

      const batch = await prisma.batch.findUnique({ where: { id: batchId } });
      if (!batch) return res.status(404).json({ error: 'NOT_FOUND', message: 'Batch not found' });

      // Update eligible students who are at targetSemester - 1
      const updateResult = await prisma.studentProfile.updateMany({
        where: {
          batchId,
          currentSemester: targetSemester - 1,
        },
        data: {
          currentSemester: targetSemester,
        },
      });

      await logAuditEvent({
        actorUserId: req.user!.id,
        actorRole: req.user!.role,
        action: 'SEMESTER_PROGRESSION_EXECUTED',
        entityType: 'Batch',
        entityId: batchId,
        reason: `Progressed cohort to Semester ${targetSemester} for Academic Year ${academicYear}`,
        newData: { targetSemester, studentsProgressed: updateResult.count },
        req,
      });

      return res.json({
        message: `Successfully progressed ${updateResult.count} students to Semester ${targetSemester}`,
        studentsProgressed: updateResult.count,
        targetSemester,
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }
);

// ============================================================================
// ATTENDANCE OVERVIEW (READ-ONLY FOR ACADEMIC ADMIN)
// ============================================================================

academicRouter.get(
  '/attendance-overview',
  authenticateToken,
  requireRole('ACADEMIC_ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const offerings = await prisma.courseOffering.findMany({
        include: {
          course: { include: { department: true } },
          batch: true,
          section: true,
          teachingAssignments: { where: { isActive: true }, include: { faculty: true } },
          attendanceSessions: {
            include: { records: true },
          },
        },
      });

      const report = offerings.map((o) => {
        const totalSessions = o.attendanceSessions.length;
        let totalRecords = 0;
        let totalPresent = 0;

        o.attendanceSessions.forEach((s) => {
          s.records.forEach((r) => {
            totalRecords++;
            if (r.isPresent) totalPresent++;
          });
        });

        const avgPercentage = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 1000) / 10 : 0;

        return {
          offeringId: o.id,
          courseCode: o.course.code,
          courseTitle: o.course.title,
          department: o.course.department.code,
          batch: o.batch.name,
          section: o.section.name,
          semester: o.semester,
          assignedFaculty: o.teachingAssignments[0]?.faculty.name || 'Unassigned',
          totalSessions,
          avgPercentage,
        };
      });

      return res.json({ report });
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }
);

// ============================================================================
// INSTITUTIONAL REPORTS
// ============================================================================

academicRouter.get(
  '/reports',
  authenticateToken,
  requireRole('ACADEMIC_ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const [totalStudents, totalFaculty, totalCourses, totalOfferings, departmentsCount] = await Promise.all([
        prisma.studentProfile.count(),
        prisma.facultyProfile.count(),
        prisma.course.count(),
        prisma.courseOffering.count(),
        prisma.department.count(),
      ]);

      const deptStats = await prisma.department.findMany({
        include: {
          _count: {
            select: {
              studentProfiles: true,
              facultyProfiles: true,
              courses: true,
            },
          },
        },
      });

      return res.json({
        kpis: {
          totalStudents,
          totalFaculty,
          totalCourses,
          totalOfferings,
          departmentsCount,
        },
        departmentBreakdown: deptStats,
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }
);

// ============================================================================
// ANNOUNCEMENTS
// ============================================================================

academicRouter.get('/announcements', authenticateToken, async (req: Request, res: Response) => {
  const announcements = await prisma.announcement.findMany({
    include: {
      createdBy: { select: { id: true, name: true, role: true } },
      department: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  return res.json({ announcements });
});

const createAnnouncementSchema = z.object({
  title: z.string().min(3),
  content: z.string().min(5),
  category: z.enum(['ACADEMIC', 'EXAMINATION', 'CAMPUS', 'URGENT']),
  targetRole: z.enum(['STUDENT', 'FACULTY', 'ACADEMIC_ADMIN', 'EXAM_ADMIN', 'ALL']).optional(),
  departmentId: z.string().uuid().optional().nullable().or(z.literal('')),
});

academicRouter.post(
  '/announcements',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      // Academic Admin, Exam Admin, and Faculty can publish announcements
      if (req.user!.role === 'STUDENT') {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Students cannot publish announcements' });
      }

      const parsed = createAnnouncementSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.format() });
      }

      const { title, content, category, targetRole, departmentId } = parsed.data;
      const effectiveRole = (!targetRole || targetRole === 'ALL') ? null : targetRole;

      const announcement = await prisma.announcement.create({
        data: {
          title,
          content,
          category,
          targetRole: effectiveRole,
          departmentId: departmentId || null,
          createdById: req.user!.id,
        },
        include: { createdBy: { select: { id: true, name: true, role: true } } },
      });

      return res.status(201).json({ message: 'Announcement created successfully', announcement });
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
    }
  }
);
