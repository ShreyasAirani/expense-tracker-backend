import { Expense } from '../models/index.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import Joi from 'joi';

// Validation schema for expense
const expenseValidationSchema = Joi.object({
  amount: Joi.number().positive().required()
    .messages({
      'number.positive': 'Amount must be a positive number',
      'any.required': 'Amount is required'
    }),
  description: Joi.string().trim().min(1).max(200).required()
    .messages({
      'string.empty': 'Description cannot be empty',
      'string.max': 'Description cannot exceed 200 characters',
      'any.required': 'Description is required'
    }),
  category: Joi.string().trim().max(50).allow('').optional(),
  date: Joi.alternatives().try(
    Joi.date(),
    Joi.string().isoDate()
  ).optional(),
  tags: Joi.array().items(Joi.string().trim().max(30)).optional(),
  notes: Joi.string().trim().max(500).allow('').optional(),
  paymentMethod: Joi.string().valid('cash', 'card', 'upi').optional(),
  isRecurring: Joi.boolean().optional(),
  recurringFrequency: Joi.string().valid('daily', 'weekly', 'monthly', 'yearly').when('isRecurring', {
    is: true,
    then: Joi.required(),
    otherwise: Joi.optional()
  })
});

// @desc    Get all expenses
// @route   GET /api/expenses
// @access  Public
export const getExpenses = asyncHandler(async (req, res) => {
  const { startDate, endDate, category, limit = 50, page = 1, sortBy = 'date', sortOrder = 'desc' } = req.query;
  
  // Build filters for Firestore
  const filters = {
    startDate,
    endDate,
    category,
    sortBy,
    sortOrder,
    limit: parseInt(limit),
    offset: (parseInt(page) - 1) * parseInt(limit)
  };

  const expenses = await Expense.find(filters, req.userId || null);
  const total = await Expense.countDocuments(filters);
  
  res.status(200).json({
    success: true,
    data: expenses,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
});

// @desc    Get single expense
// @route   GET /api/expenses/:id
// @access  Public
export const getExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findById(req.params.id);
  
  if (!expense) {
    return res.status(404).json({
      success: false,
      message: 'Expense not found'
    });
  }
  
  res.status(200).json({
    success: true,
    data: expense
  });
});

// @desc    Create new expense
// @route   POST /api/expenses
// @access  Public
export const createExpense = asyncHandler(async (req, res) => {
  // Validate input
  const { error, value } = expenseValidationSchema.validate(req.body);
  
  if (error) {
    console.log('Validation error details:', error.details);
    console.log('Received data:', req.body);
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }))
    });
  }
  
  const expense = await Expense.create(value, req.userId || null);
  
  res.status(201).json({
    success: true,
    data: expense,
    message: 'Expense created successfully'
  });
});

// @desc    Update expense
// @route   PUT /api/expenses/:id
// @access  Public
export const updateExpense = asyncHandler(async (req, res) => {
  // Validate input
  const { error, value } = expenseValidationSchema.validate(req.body);
  
  if (error) {
    console.log('Validation error details:', error.details);
    console.log('Received data:', req.body);
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }))
    });
  }
  
  const expense = await Expense.findByIdAndUpdate(
    req.params.id,
    value,
    {
      new: true,
      runValidators: true
    }
  );
  
  if (!expense) {
    return res.status(404).json({
      success: false,
      message: 'Expense not found'
    });
  }
  
  res.status(200).json({
    success: true,
    data: expense,
    message: 'Expense updated successfully'
  });
});

// @desc    Delete expense
// @route   DELETE /api/expenses/:id
// @access  Public
export const deleteExpense = asyncHandler(async (req, res) => {
  const expenseId = req.params.id;

  if (!expenseId || expenseId === 'undefined') {
    return res.status(400).json({
      success: false,
      message: 'Invalid expense ID provided'
    });
  }

  const expense = await Expense.findById(expenseId);

  if (!expense) {
    return res.status(404).json({
      success: false,
      message: 'Expense not found'
    });
  }

  // Use Firestore delete method
  await Expense.findByIdAndDelete(expenseId);
  
  res.status(200).json({
    success: true,
    message: 'Expense deleted successfully'
  });
});

// @desc    Get expenses grouped by date
// @route   GET /api/expenses/grouped-by-date
// @access  Public
export const getExpensesGroupedByDate = asyncHandler(async (req, res) => {
  const { startDate, endDate, limit = 100 } = req.query;

  // Build filters
  const filters = {
    startDate,
    endDate,
    sortBy: 'date',
    sortOrder: 'desc',
    limit: parseInt(limit)
  };

  // Use the new Firestore method for grouping
  const groupedExpenses = await Expense.getExpensesGroupedByDate(filters, req.userId || null);

  res.status(200).json({
    success: true,
    data: groupedExpenses,
    totalGroups: groupedExpenses.length,
    totalExpenses: groupedExpenses.reduce((sum, group) => sum + group.count, 0)
  });
});

// @desc    Get expense statistics
// @route   GET /api/expenses/stats
// @access  Public
export const getExpenseStats = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  let matchStage = {};
  if (startDate || endDate) {
    matchStage.date = {};
    if (startDate) matchStage.date.$gte = new Date(startDate);
    if (endDate) matchStage.date.$lte = new Date(endDate);
  }

  const stats = await Expense.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
        totalExpenses: { $sum: 1 },
        averageAmount: { $avg: '$amount' },
        maxAmount: { $max: '$amount' },
        minAmount: { $min: '$amount' }
      }
    }
  ]);

  const categoryStats = await Expense.getCategoryTotals(
    startDate || new Date(0),
    endDate || new Date()
  );
  
  res.status(200).json({
    success: true,
    data: {
      overview: stats[0] || {
        totalAmount: 0,
        totalExpenses: 0,
        averageAmount: 0,
        maxAmount: 0,
        minAmount: 0
      },
      categoryBreakdown: categoryStats
    }
  });
});
