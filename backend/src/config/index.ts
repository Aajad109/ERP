import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  jwtSecret: process.env.JWT_SECRET || 'super-secure-dev-jwt-secret-college-erp-2024',
  nodeEnv: process.env.NODE_ENV || 'development',
  academicRules: {
    maxInternalMarks: 40,
    maxExternalMarks: 60,
    maxTotalMarks: 100,
    minInternalPassMarks: 16, // 40% of 40
    minExternalPassMarks: 24, // 40% of 60
    minTotalPassMarks: 40,    // 40% of 100
  },
};
