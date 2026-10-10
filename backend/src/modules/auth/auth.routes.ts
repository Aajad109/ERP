import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../../prisma';
import { config } from '../../config';
import { authenticateToken } from '../../middleware/auth';
import { logAuditEvent } from '../../middleware/audit';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().optional(),
  identifier: z.string().optional(),
  password: z.string().min(1),
});

authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.format() });
    }

    const { email, identifier, password } = parseResult.data;
    const loginId = identifier || email;

    if (!loginId) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Email or Roll Number / Employee ID is required' });
    }

    let user = null;

    if (loginId.includes('@')) {
      user = await prisma.user.findUnique({
        where: { email: loginId.toLowerCase() },
        include: {
          studentProfile: {
            include: { department: true, batch: true, section: true },
          },
          facultyProfile: {
            include: { department: true },
          },
          examAdminDesignation: {
            where: { isActive: true },
            include: { department: true },
          },
          department: true,
        },
      });
    } else {
      // Try Roll Number first for students
      const student = await prisma.studentProfile.findFirst({
        where: { rollNumber: { equals: loginId, mode: 'insensitive' } },
        include: {
          user: {
            include: {
              studentProfile: {
                include: { department: true, batch: true, section: true },
              },
              facultyProfile: {
                include: { department: true },
              },
              examAdminDesignation: {
                where: { isActive: true },
                include: { department: true },
              },
              department: true,
            },
          },
        },
      });

      if (student) {
        user = student.user;
      } else {
        // Try Employee ID for faculty
        const faculty = await prisma.facultyProfile.findFirst({
          where: { employeeId: { equals: loginId, mode: 'insensitive' } },
          include: {
            user: {
              include: {
                studentProfile: {
                  include: { department: true, batch: true, section: true },
                },
                facultyProfile: {
                  include: { department: true },
                },
                examAdminDesignation: {
                  where: { isActive: true },
                  include: { department: true },
                },
                department: true,
              },
            },
          },
        });
        if (faculty) {
          user = faculty.user;
        }
      }
    }

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid credentials. Please verify your roll number, email, and password.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '8h' });

    await logAuditEvent({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'USER_LOGIN',
      entityType: 'User',
      entityId: user.id,
      departmentId: user.departmentId,
      req,
    });

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department,
        studentProfile: user.studentProfile,
        facultyProfile: user.facultyProfile,
        examAdminDesignation: user.examAdminDesignation,
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

authRouter.get('/me', authenticateToken, async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: {
      studentProfile: {
        include: { department: true, batch: true, section: true },
      },
      facultyProfile: {
        include: { department: true },
      },
      examAdminDesignation: {
        where: { isActive: true },
        include: { department: true },
      },
      department: true,
    },
  });

  return res.json({ user });
});
