import rateLimit from 'express-rate-limit';
import User from '../models/FirestoreUser.js';

// Rate limiting for data retention operations
export const dataRetentionRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each user to 5 data retention operations per windowMs
  message: {
    success: false,
    message: 'Too many data retention requests. Please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId, // Rate limit per user
});

// Stricter rate limiting for cleanup operations
export const cleanupRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 2, // Only 2 cleanup operations per hour per user
  message: {
    success: false,
    message: 'Cleanup operations are limited to 2 per hour for security reasons.',
    retryAfter: '1 hour'
  },
  keyGenerator: (req) => req.userId,
});

// Admin rate limiting for global operations
export const adminCleanupRateLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 1, // Only 1 global cleanup per day
  message: {
    success: false,
    message: 'Global cleanup is limited to once per day.',
    retryAfter: '24 hours'
  },
  keyGenerator: () => 'global-cleanup', // Global key for all admin operations
});

// Middleware to check if user can perform data retention operations
export const checkDataRetentionPermissions = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user account is active
    if (user.status === 'suspended' || user.status === 'banned') {
      return res.status(403).json({
        success: false,
        message: 'Account suspended. Data retention operations not allowed.'
      });
    }

    // Check if user has been recently created (prevent immediate data deletion)
    const accountAge = Date.now() - new Date(user.createdAt).getTime();
    const minAccountAge = 7 * 24 * 60 * 60 * 1000; // 7 days

    if (accountAge < minAccountAge) {
      return res.status(403).json({
        success: false,
        message: 'Account must be at least 7 days old to perform data retention operations.'
      });
    }

    // Add user info to request for logging
    req.userInfo = {
      id: user.id,
      email: user.email,
      accountAge: Math.floor(accountAge / (24 * 60 * 60 * 1000)), // days
      lastLogin: user.lastLogin
    };

    next();
  } catch (error) {
    console.error('❌ Error checking data retention permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Middleware to validate retention period changes
export const validateRetentionChange = (req, res, next) => {
  const { months } = req.body;
  
  // Security checks for retention period
  if (months < 1) {
    return res.status(400).json({
      success: false,
      message: 'Minimum retention period is 1 month for data protection compliance.'
    });
  }

  if (months > 12) {
    return res.status(400).json({
      success: false,
      message: 'Maximum retention period is 12 months for storage efficiency.'
    });
  }

  // Log retention period changes for audit
  console.log(`🔒 User ${req.userId} changing retention period to ${months} months`);
  
  next();
};

// Middleware to log data retention operations
export const logDataRetentionOperation = (operation) => {
  return (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Log the operation after response is sent
      const logData = {
        operation,
        userId: req.userId,
        userInfo: req.userInfo,
        timestamp: new Date().toISOString(),
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        success: res.statusCode < 400,
        statusCode: res.statusCode
      };

      // Add request body for certain operations (excluding sensitive data)
      if (['settings-update', 'cleanup-trigger'].includes(operation)) {
        logData.requestData = {
          ...req.body,
          // Remove any sensitive fields if they exist
        };
      }

      console.log(`🔒 Data Retention Audit Log:`, JSON.stringify(logData, null, 2));
      
      // In production, you might want to send this to a dedicated audit log service
      // auditLogger.log(logData);
      
      originalSend.call(this, data);
    };
    
    next();
  };
};

// Middleware to check admin permissions
export const checkAdminPermissions = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user has admin role
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      console.log(`🚨 Unauthorized admin access attempt by user ${req.userId} (${user.email})`);
      return res.status(403).json({
        success: false,
        message: 'Admin privileges required for this operation.'
      });
    }

    // Log admin operations
    console.log(`🔒 Admin operation by ${user.email} (${user.id}): ${req.method} ${req.path}`);
    
    req.adminInfo = {
      id: user.id,
      email: user.email,
      role: user.role
    };

    next();
  } catch (error) {
    console.error('❌ Error checking admin permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Security headers for data retention endpoints
export const setSecurityHeaders = (req, res, next) => {
  // Prevent caching of sensitive data retention information
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store',
    // Prevent embedding in frames
    'X-Frame-Options': 'DENY',
    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',
    // Enable XSS protection
    'X-XSS-Protection': '1; mode=block'
  });
  
  next();
};

// Middleware to validate cleanup confirmation
export const requireCleanupConfirmation = (req, res, next) => {
  const { confirmation } = req.body;
  
  // Require explicit confirmation for destructive operations
  if (confirmation !== 'DELETE_MY_DATA') {
    return res.status(400).json({
      success: false,
      message: 'Explicit confirmation required. Send "confirmation": "DELETE_MY_DATA" in request body.'
    });
  }
  
  next();
};

export default {
  dataRetentionRateLimit,
  cleanupRateLimit,
  adminCleanupRateLimit,
  checkDataRetentionPermissions,
  validateRetentionChange,
  logDataRetentionOperation,
  checkAdminPermissions,
  setSecurityHeaders,
  requireCleanupConfirmation
};
