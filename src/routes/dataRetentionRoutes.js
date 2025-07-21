import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticateToken } from '../middleware/auth.js';
import dataRetentionService from '../services/dataRetentionService.js';
import schedulerService from '../services/schedulerService.js';
import User from '../models/FirestoreUser.js';
import Joi from 'joi';
import {
  dataRetentionRateLimit,
  cleanupRateLimit,
  adminCleanupRateLimit,
  checkDataRetentionPermissions,
  validateRetentionChange,
  logDataRetentionOperation,
  checkAdminPermissions,
  setSecurityHeaders,
  requireCleanupConfirmation
} from '../middleware/dataRetentionSecurity.js';

const router = express.Router();

// Apply security headers to all data retention routes
router.use(setSecurityHeaders);

// Validation schemas
const retentionSettingsSchema = Joi.object({
  months: Joi.number().integer().min(1).max(12).required()
});

// @desc    Get user's data retention settings
// @route   GET /api/data-retention/settings
// @access  Private
router.get('/settings',
  authenticateToken,
  dataRetentionRateLimit,
  checkDataRetentionPermissions,
  logDataRetentionOperation('settings-view'),
  asyncHandler(async (req, res) => {
  console.log('🗂️ GET /api/data-retention/settings - User ID:', req.userId);
  
  const user = await User.findById(req.userId);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  const settings = user.dataRetention || {
    months: 3, // Default 3 months
    lastCleanup: null,
    autoCleanup: true
  };

  res.status(200).json({
    success: true,
    data: settings
  });
}));

// @desc    Update user's data retention settings
// @route   PUT /api/data-retention/settings
// @access  Private
router.put('/settings',
  authenticateToken,
  dataRetentionRateLimit,
  checkDataRetentionPermissions,
  validateRetentionChange,
  logDataRetentionOperation('settings-update'),
  asyncHandler(async (req, res) => {
  console.log('🗂️ PUT /api/data-retention/settings - User ID:', req.userId);
  console.log('🗂️ Settings update:', req.body);
  
  // Validate request body
  const { error, value } = retentionSettingsSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Invalid retention settings',
      details: error.details.map(detail => detail.message)
    });
  }

  const user = await User.findById(req.userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Update user's retention settings
  const updatedSettings = {
    months: value.months,
    lastCleanup: user.dataRetention?.lastCleanup || null,
    autoCleanup: user.dataRetention?.autoCleanup !== false, // Default true
    updatedAt: new Date().toISOString()
  };

  await User.findByIdAndUpdate(req.userId, {
    dataRetention: updatedSettings
  });

  console.log('✅ Data retention settings updated for user:', req.userId);

  res.status(200).json({
    success: true,
    message: 'Data retention settings updated successfully',
    data: updatedSettings
  });
}));

// @desc    Get cleanup preview for user
// @route   GET /api/data-retention/preview
// @access  Private
router.get('/preview', authenticateToken, asyncHandler(async (req, res) => {
  console.log('🔍 GET /api/data-retention/preview - User ID:', req.userId);
  
  const user = await User.findById(req.userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  const retentionMonths = user.dataRetention?.months || 3;
  const preview = await dataRetentionService.getCleanupPreview(req.userId, retentionMonths);

  res.status(200).json({
    success: true,
    data: preview
  });
}));

// @desc    Manually trigger cleanup for current user
// @route   POST /api/data-retention/cleanup
// @access  Private
router.post('/cleanup',
  authenticateToken,
  cleanupRateLimit,
  checkDataRetentionPermissions,
  requireCleanupConfirmation,
  logDataRetentionOperation('cleanup-trigger'),
  asyncHandler(async (req, res) => {
  console.log('🧹 POST /api/data-retention/cleanup - User ID:', req.userId);
  
  const user = await User.findById(req.userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  const retentionMonths = user.dataRetention?.months || 3;
  const result = await schedulerService.triggerUserCleanup(req.userId, retentionMonths);

  // Update last cleanup timestamp
  await User.findByIdAndUpdate(req.userId, {
    'dataRetention.lastCleanup': new Date().toISOString()
  });

  res.status(200).json({
    success: true,
    message: 'Data cleanup completed successfully',
    data: result
  });
}));

// @desc    Get cleanup history/stats for user
// @route   GET /api/data-retention/stats
// @access  Private
router.get('/stats', authenticateToken, asyncHandler(async (req, res) => {
  console.log('📊 GET /api/data-retention/stats - User ID:', req.userId);
  
  const user = await User.findById(req.userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Get current data stats
  const preview = await dataRetentionService.getCleanupPreview(req.userId, user.dataRetention?.months || 3);
  
  const stats = {
    retentionSettings: user.dataRetention || {
      months: 3,
      lastCleanup: null,
      autoCleanup: true
    },
    currentData: {
      expensesToCleanup: preview.totalExpenses,
      amountToCleanup: preview.totalAmount,
      oldestExpense: preview.oldestExpense ? new Date(preview.oldestExpense).toISOString() : null,
      cutoffDate: preview.cutoffDate
    },
    monthlyBreakdown: preview.monthlyBreakdown
  };

  res.status(200).json({
    success: true,
    data: stats
  });
}));

// @desc    Admin: Trigger global cleanup (admin only)
// @route   POST /api/data-retention/admin/cleanup
// @access  Private (Admin)
router.post('/admin/cleanup',
  authenticateToken,
  adminCleanupRateLimit,
  checkAdminPermissions,
  requireCleanupConfirmation,
  logDataRetentionOperation('admin-global-cleanup'),
  asyncHandler(async (req, res) => {
  console.log('🔧 POST /api/data-retention/admin/cleanup - User ID:', req.userId);
  
  // Note: In a real app, you'd check if user is admin
  // For now, we'll allow any authenticated user to trigger this
  
  const result = await schedulerService.triggerDataCleanup();

  res.status(200).json({
    success: true,
    message: 'Global data cleanup triggered successfully',
    data: result
  });
}));

// @desc    Get scheduler status
// @route   GET /api/data-retention/scheduler/status
// @access  Private
router.get('/scheduler/status', authenticateToken, asyncHandler(async (req, res) => {
  const status = schedulerService.getJobStatus();

  res.status(200).json({
    success: true,
    data: {
      scheduler: status,
      dataCleanupJob: status.jobs?.dataCleanup || { running: false, scheduled: false }
    }
  });
}));

// @desc    Health check for data retention service
// @route   GET /api/data-retention/health
// @access  Public
router.get('/health', asyncHandler(async (req, res) => {
  const schedulerStatus = schedulerService.getJobStatus();
  
  res.status(200).json({
    success: true,
    message: 'Data retention service is healthy',
    data: {
      scheduler: schedulerStatus,
      dataCleanupEnabled: schedulerStatus.jobs?.dataCleanup?.scheduled || false,
      timestamp: new Date().toISOString()
    }
  });
}));

export default router;
