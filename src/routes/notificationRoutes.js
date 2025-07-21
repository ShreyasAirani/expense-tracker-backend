import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import User from '../models/FirestoreUser.js';
import notificationService from '../services/notificationService.js';
import schedulerService from '../services/schedulerService.js';
import Joi from 'joi';

const router = express.Router();

// Validation schemas
const notificationPreferencesSchema = Joi.object({
  email: Joi.object({
    enabled: Joi.boolean(),
    dailySummary: Joi.boolean(),
    weeklyReport: Joi.boolean(),
    budgetAlerts: Joi.boolean(),
    unusualSpending: Joi.boolean()
  }),
  preferences: Joi.object({
    dailySummaryTime: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    timezone: Joi.string(),
    minimumDailyAmount: Joi.number().min(0),
    weeklyReportDay: Joi.string().valid('sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday')
  })
});

// @desc    Get user notification preferences
// @route   GET /api/notifications/preferences
// @access  Private
router.get('/preferences', authenticateToken, asyncHandler(async (req, res) => {
  console.log('🔔 GET /api/notifications/preferences - User ID:', req.userId);

  const user = await User.findById(req.userId);
  console.log('🔔 Found user:', user ? 'Yes' : 'No');
  console.log('🔔 User notifications field:', user?.notifications);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  const defaultNotifications = {
    email: {
      enabled: false,
      dailySummary: false,
      weeklyReport: false,
      budgetAlerts: false,
      unusualSpending: false
    },
    preferences: {
      dailySummaryTime: '18:00',
      timezone: 'America/New_York',
      minimumDailyAmount: 0,
      weeklyReportDay: 'sunday'
    }
  };

  const notificationData = user.notifications || defaultNotifications;
  console.log('🔔 Sending notification data:', notificationData);

  res.status(200).json({
    success: true,
    data: notificationData
  });
}));

// @desc    Update user notification preferences
// @route   PUT /api/notifications/preferences
// @access  Private
router.put('/preferences', authenticateToken, asyncHandler(async (req, res) => {
  // Validate request body
  const { error, value } = notificationPreferencesSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Invalid notification preferences',
      details: error.details.map(detail => detail.message)
    });
  }

  const updatedUser = await User.updateNotificationPreferences(req.userId, value);

  res.status(200).json({
    success: true,
    message: 'Notification preferences updated successfully',
    data: updatedUser.notifications
  });
}));

// @desc    Send test notification
// @route   POST /api/notifications/test
// @access  Private
router.post('/test', authenticateToken, asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  const result = await notificationService.sendTestNotification(user.email, user.name);

  res.status(200).json({
    success: true,
    message: 'Test notification sent successfully',
    data: {
      messageId: result.messageId,
      sentTo: user.email
    }
  });
}));

// @desc    Send daily summary to current user
// @route   POST /api/notifications/daily-summary
// @access  Private
router.post('/daily-summary', authenticateToken, asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  const result = await notificationService.sendDailySummary(
    user.email,
    user.name,
    user.id
  );

  if (result.skipped) {
    return res.status(200).json({
      success: true,
      message: 'Daily summary skipped',
      data: {
        reason: result.reason,
        skipped: true
      }
    });
  }

  res.status(200).json({
    success: true,
    message: 'Daily summary sent successfully',
    data: {
      messageId: result.messageId,
      sentTo: user.email,
      summary: result.summary
    }
  });
}));

// @desc    Get scheduler status (admin only for now)
// @route   GET /api/notifications/scheduler/status
// @access  Private
router.get('/scheduler/status', authenticateToken, asyncHandler(async (req, res) => {
  const status = schedulerService.getJobStatus();

  res.status(200).json({
    success: true,
    data: status
  });
}));

// @desc    Manually trigger daily summary job (admin/testing)
// @route   POST /api/notifications/scheduler/trigger-daily
// @access  Private
router.post('/scheduler/trigger-daily', authenticateToken, asyncHandler(async (req, res) => {
  const result = await schedulerService.triggerDailySummary();

  res.status(200).json({
    success: true,
    message: 'Daily summary job triggered successfully',
    data: result
  });
}));

// @desc    Manually trigger weekly report job (admin/testing)
// @route   POST /api/notifications/scheduler/trigger-weekly
// @access  Private
router.post('/scheduler/trigger-weekly', authenticateToken, asyncHandler(async (req, res) => {
  const result = await schedulerService.triggerWeeklyReport();

  res.status(200).json({
    success: true,
    message: 'Weekly report job triggered successfully',
    data: result
  });
}));

// @desc    Get notification statistics
// @route   GET /api/notifications/stats
// @access  Private
router.get('/stats', authenticateToken, asyncHandler(async (req, res) => {
  // Get basic stats about notifications
  const user = await User.findById(req.userId);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  const stats = {
    emailEnabled: user.notifications?.email?.enabled || false,
    dailySummaryEnabled: user.notifications?.email?.dailySummary || false,
    weeklyReportEnabled: user.notifications?.email?.weeklyReport || false,
    budgetAlertsEnabled: user.notifications?.email?.budgetAlerts || false,
    unusualSpendingEnabled: user.notifications?.email?.unusualSpending || false,
    preferredTime: user.notifications?.preferences?.dailySummaryTime || '18:00',
    timezone: user.notifications?.preferences?.timezone || 'America/New_York'
  };

  res.status(200).json({
    success: true,
    data: stats
  });
}));

// @desc    Health check for notification service
// @route   GET /api/notifications/health
// @access  Public
router.get('/health', asyncHandler(async (req, res) => {
  const schedulerStatus = schedulerService.getJobStatus();
  
  res.status(200).json({
    success: true,
    message: 'Notification service is healthy',
    data: {
      scheduler: schedulerStatus,
      timestamp: new Date().toISOString()
    }
  });
}));

export default router;
