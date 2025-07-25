import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import initializeFirestore from './config/database.js';
import authRoutes from './routes/auth.js';
import expenseRoutes from './routes/expenseRoutes.js';
import analysisRoutes from './routes/analysisRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import dataRetentionRoutes from './routes/dataRetentionRoutes.js';
import securityRoutes from './routes/securityRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import schedulerService from './services/schedulerService.js';

// Load environment variables
dotenv.config({ path: '.env' });

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Firestore
initializeFirestore();

// Initialize scheduler service
schedulerService.initialize();

// Security middleware
app.use(helmet());

// CORS configuration - Simplified and more permissive for debugging
console.log('🌐 NODE_ENV:', process.env.NODE_ENV);
console.log('🌐 FRONTEND_URL environment variable:', process.env.FRONTEND_URL);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  console.log('🌐 Request from origin:', origin);
  console.log('🌐 Request method:', req.method);
  console.log('🌐 Request headers:', req.headers);

  // Set CORS headers for all requests
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    console.log('🌐 Handling OPTIONS preflight request');
    return res.sendStatus(200);
  }

  next();
});

// Rate limiting (disabled for development)
if (process.env.NODE_ENV !== 'development') {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Production limit
    message: {
      success: false,
      message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use(limiter);
  console.log('Rate limiting enabled for production');
} else {
  console.log('Rate limiting disabled for development');
}

// Handle preflight requests
app.options('*', cors());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/data-retention', dataRetentionRoutes);
app.use('/api/security', securityRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Expense Tracker API is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware (should be last)
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL}`);
});

// Set timeout values for Render deployment
server.keepAliveTimeout = 120000; // 120 seconds
server.headersTimeout = 120000; // 120 seconds

export default app;
