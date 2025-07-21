import express from 'express';
import bcrypt from 'bcryptjs';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticateToken } from '../middleware/auth.js';
import User from '../models/FirestoreUser.js';
import Joi from 'joi';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiting for security operations
const securityRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each user to 5 security operations per windowMs
  message: {
    success: false,
    message: 'Too many security requests. Please try again later.',
  },
  keyGenerator: (req) => req.userId,
});

// Stricter rate limiting for password changes
const passwordChangeRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Only 3 password changes per hour
  message: {
    success: false,
    message: 'Password changes are limited to 3 per hour for security reasons.',
  },
  keyGenerator: (req) => req.userId,
});

// Validation schemas
const passwordChangeSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).required(),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
});

const securitySettingsSchema = Joi.object({
  twoFactorEnabled: Joi.boolean(),
  loginNotifications: Joi.boolean(),
  dataRetentionAlerts: Joi.boolean(),
  securityEmails: Joi.boolean(),
  sessionTimeout: Joi.number().valid(15, 30, 60, 120, 480),
  requirePasswordForDeletion: Joi.boolean()
});

// @desc    Get user's security settings
// @route   GET /api/security/settings
// @access  Private
router.get('/settings', 
  authenticateToken, 
  securityRateLimit,
  asyncHandler(async (req, res) => {
    console.log('🔒 GET /api/security/settings - User ID:', req.userId);
    
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const securitySettings = user.securitySettings || {
      twoFactorEnabled: false,
      loginNotifications: true,
      dataRetentionAlerts: true,
      securityEmails: true,
      sessionTimeout: 30,
      requirePasswordForDeletion: true
    };

    // Don't send sensitive information
    const safeSettings = {
      ...securitySettings,
      // Remove any sensitive fields if they exist
    };

    res.status(200).json({
      success: true,
      data: safeSettings
    });
  })
);

// @desc    Update user's security settings
// @route   PUT /api/security/settings
// @access  Private
router.put('/settings', 
  authenticateToken, 
  securityRateLimit,
  asyncHandler(async (req, res) => {
    console.log('🔒 PUT /api/security/settings - User ID:', req.userId);
    console.log('🔒 Settings update:', req.body);
    
    // Validate request body
    const { error, value } = securitySettingsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid security settings',
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

    // Update user's security settings
    const updatedSettings = {
      ...user.securitySettings,
      ...value,
      updatedAt: new Date().toISOString()
    };

    await User.findByIdAndUpdate(req.userId, {
      securitySettings: updatedSettings
    });

    // Log security settings change
    console.log(`🔒 Security settings updated for user ${req.userId}:`, value);

    res.status(200).json({
      success: true,
      message: 'Security settings updated successfully',
      data: updatedSettings
    });
  })
);

// @desc    Change user password
// @route   POST /api/security/change-password
// @access  Private
router.post('/change-password', 
  authenticateToken, 
  passwordChangeRateLimit,
  asyncHandler(async (req, res) => {
    console.log('🔒 POST /api/security/change-password - User ID:', req.userId);
    
    // Validate request body
    const { error, value } = passwordChangeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid password change request',
        details: error.details.map(detail => detail.message)
      });
    }

    const { currentPassword, newPassword } = value;

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      console.log(`🚨 Invalid current password attempt for user ${req.userId}`);
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await User.findByIdAndUpdate(req.userId, {
      password: hashedNewPassword,
      passwordChangedAt: new Date().toISOString()
    });

    console.log(`✅ Password changed successfully for user ${req.userId}`);

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  })
);

// @desc    Get security activity log
// @route   GET /api/security/activity
// @access  Private
router.get('/activity', 
  authenticateToken, 
  securityRateLimit,
  asyncHandler(async (req, res) => {
    console.log('🔒 GET /api/security/activity - User ID:', req.userId);
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get security activity log (mock data for now)
    // In a real implementation, you'd fetch from a security log collection
    const mockActivityLog = [
      {
        id: 1,
        action: 'Login',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        ip: req.ip || '192.168.1.100',
        device: req.get('User-Agent') || 'Unknown',
        status: 'success'
      },
      {
        id: 2,
        action: 'Security Settings Updated',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        ip: req.ip || '192.168.1.100',
        device: req.get('User-Agent') || 'Unknown',
        status: 'success'
      }
    ];

    res.status(200).json({
      success: true,
      data: mockActivityLog
    });
  })
);

// @desc    Enable/Disable Two-Factor Authentication
// @route   POST /api/security/2fa/toggle
// @access  Private
router.post('/2fa/toggle', 
  authenticateToken, 
  securityRateLimit,
  asyncHandler(async (req, res) => {
    console.log('🔒 POST /api/security/2fa/toggle - User ID:', req.userId);
    
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Invalid request. "enabled" must be a boolean.'
      });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update 2FA setting
    const updatedSecuritySettings = {
      ...user.securitySettings,
      twoFactorEnabled: enabled,
      updatedAt: new Date().toISOString()
    };

    await User.findByIdAndUpdate(req.userId, {
      securitySettings: updatedSecuritySettings
    });

    console.log(`🔒 2FA ${enabled ? 'enabled' : 'disabled'} for user ${req.userId}`);

    res.status(200).json({
      success: true,
      message: `Two-factor authentication ${enabled ? 'enabled' : 'disabled'} successfully`,
      data: { twoFactorEnabled: enabled }
    });
  })
);

// @desc    Verify password for sensitive operations
// @route   POST /api/security/verify-password
// @access  Private
router.post('/verify-password', 
  authenticateToken, 
  securityRateLimit,
  asyncHandler(async (req, res) => {
    console.log('🔒 POST /api/security/verify-password - User ID:', req.userId);
    
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required'
      });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.log(`🚨 Invalid password verification attempt for user ${req.userId}`);
      return res.status(400).json({
        success: false,
        message: 'Password is incorrect'
      });
    }

    console.log(`✅ Password verified successfully for user ${req.userId}`);

    res.status(200).json({
      success: true,
      message: 'Password verified successfully'
    });
  })
);

// @desc    Get security health check
// @route   GET /api/security/health
// @access  Private
router.get('/health', 
  authenticateToken,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Calculate security score based on settings
    let securityScore = 0;
    const settings = user.securitySettings || {};
    
    if (settings.twoFactorEnabled) securityScore += 30;
    if (settings.requirePasswordForDeletion) securityScore += 20;
    if (settings.loginNotifications) securityScore += 15;
    if (settings.securityEmails) securityScore += 15;
    if (settings.sessionTimeout <= 60) securityScore += 20; // Shorter timeout is more secure

    const healthData = {
      securityScore,
      recommendations: [],
      lastPasswordChange: user.passwordChangedAt || user.createdAt,
      accountAge: Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (24 * 60 * 60 * 1000))
    };

    // Add recommendations based on security score
    if (!settings.twoFactorEnabled) {
      healthData.recommendations.push('Enable two-factor authentication for better security');
    }
    if (settings.sessionTimeout > 60) {
      healthData.recommendations.push('Consider reducing session timeout for better security');
    }
    if (!settings.requirePasswordForDeletion) {
      healthData.recommendations.push('Enable password requirement for data deletion operations');
    }

    res.status(200).json({
      success: true,
      data: healthData
    });
  })
);

export default router;
