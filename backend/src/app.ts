import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { authRouter } from './modules/auth/auth.routes';
import { academicRouter } from './modules/academic/academic.routes';
import { marksRouter } from './modules/marks/marks.routes';
import { resultsRouter } from './modules/results/results.routes';
import { attendanceRouter } from './modules/attendance/attendance.routes';
import { auditRouter } from './modules/audit/audit.routes';
import { campusHubRouter } from './modules/campushub/campushub.routes';
import path from 'path';

export const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));

import fs from 'fs';

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));
app.use('/api/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Serve frontend static files if built
const frontendDist = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
}

// Health Check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    institution: 'Engineering College ERP',
    phase: 'Phase 2 - Complete ERP & Campus Hub',
  });
});

// Mount modular monolith routes
app.use('/api/auth', authRouter);
app.use('/api/academic', academicRouter);
app.use('/api/marks', marksRouter);
app.use('/api/results', resultsRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/audit', auditRouter);
app.use('/api/hub', campusHubRouter);

// Fallback to frontend index.html for SPA routes
if (fs.existsSync(frontendDist)) {
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Central error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    error: err.code || 'INTERNAL_SERVER_ERROR',
    message: err.message || 'An unexpected internal error occurred',
  });
});
