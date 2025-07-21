import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticateToken } from '../middleware/auth.js';
import User from '../models/FirestoreUser.js';
import Joi from 'joi';
import bcrypt from 'bcryptjs';

const router = express.Router();

// Validation schemas
const profileUpdateSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  email: Joi.string().email().required(),
  preferences: Joi.object({
    currency: Joi.string().valid('USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'INR'),
    dateFormat: Joi.string().valid('MM/dd/yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd', 'dd-MM-yyyy'),
    categories: Joi.array().items(Joi.string().min(1).max(50))
  })
});

const passwordChangeSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).required(),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
});

// @desc    Get user profile
// @route   GET /api/profile
// @access  Private
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  console.log('📋 GET /api/profile - User ID:', req.userId);
  
  const user = await User.findById(req.userId);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Return user profile without password
  const { password, ...userProfile } = user;
  
  res.status(200).json({
    success: true,
    data: userProfile
  });
}));

// @desc    Update user profile
// @route   PUT /api/profile
// @access  Private
router.put('/', authenticateToken, asyncHandler(async (req, res) => {
  console.log('📋 PUT /api/profile - User ID:', req.userId);
  console.log('📋 Profile update data:', req.body);
  
  // Validate request body
  const { error, value } = profileUpdateSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Invalid profile data',
      details: error.details.map(detail => detail.message)
    });
  }

  // Check if email is already taken by another user
  const existingUser = await User.findByEmail(value.email);
  if (existingUser && existingUser.id !== req.userId) {
    return res.status(400).json({
      success: false,
      message: 'Email is already taken by another user'
    });
  }

  // Update user profile
  const updatedUser = await User.findByIdAndUpdate(req.userId, value);
  
  if (!updatedUser) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  console.log('📋 Profile updated successfully for user:', req.userId);

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: updatedUser
  });
}));

// @desc    Change user password
// @route   PUT /api/profile/password
// @access  Private
router.put('/password', authenticateToken, asyncHandler(async (req, res) => {
  console.log('🔒 PUT /api/profile/password - User ID:', req.userId);
  
  // Validate request body
  const { error, value } = passwordChangeSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Invalid password data',
      details: error.details.map(detail => detail.message)
    });
  }

  const { currentPassword, newPassword } = value;

  // Get user with password
  const user = await User.findByIdWithPassword(req.userId);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Verify current password
  const isCurrentPasswordValid = await User.verifyPassword(currentPassword, user.password);
  if (!isCurrentPasswordValid) {
    return res.status(400).json({
      success: false,
      message: 'Current password is incorrect'
    });
  }

  // Hash new password
  const saltRounds = 12;
  const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

  // Update password
  await User.updatePassword(req.userId, hashedNewPassword);

  console.log('🔒 Password changed successfully for user:', req.userId);

  res.status(200).json({
    success: true,
    message: 'Password changed successfully'
  });
}));

// @desc    Get user statistics
// @route   GET /api/profile/stats
// @access  Private
router.get('/stats', authenticateToken, asyncHandler(async (req, res) => {
  console.log('📊 GET /api/profile/stats - User ID:', req.userId);
  
  const stats = await User.getUserStats(req.userId);
  
  if (!stats) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  res.status(200).json({
    success: true,
    data: stats
  });
}));

// @desc    Delete user account
// @route   DELETE /api/profile
// @access  Private
router.delete('/', authenticateToken, asyncHandler(async (req, res) => {
  console.log('🗑️ DELETE /api/profile - User ID:', req.userId);
  
  // In a real application, you might want to:
  // 1. Require password confirmation
  // 2. Soft delete instead of hard delete
  // 3. Clean up related data (expenses, etc.)
  
  const deletedUser = await User.findByIdAndDelete(req.userId);
  
  if (!deletedUser) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  console.log('🗑️ User account deleted:', req.userId);

  res.status(200).json({
    success: true,
    message: 'Account deleted successfully'
  });
}));

export default router;
