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

// @desc    Get all expenses with filters
// @route   GET /api/expenses
// @access  Private
export const getExpenses = asyncHandler(async (req, res) => {
  // Ensure user is authenticated
  if (!req.userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  const userId = req.userId;
  console.log('🔍 Getting expenses for user:', userId);
  console.log('🔍 Query params:', req.query);

  const {
    page = 1,
    limit = 1000,
    category,
    startDate,
    endDate
  } = req.query;

  const sortBy = 'date';
  const sortOrder = 'desc';

  const filters = {
    limit: parseInt(limit),
    offset: (parseInt(page) - 1) * parseInt(limit),
    sortBy,
    sortOrder
  };

  if (category) filters.category = category;
  if (startDate && endDate) {
    filters.startDate = startDate;
    filters.endDate = endDate;
  }

  console.log('🔍 Applied filters:', filters);

  try {
    // Use Expense instead of ExpenseModel
    const expenses = await Expense.find(filters, userId);
    const totalExpenses = await Expense.countDocuments(filters, userId);

    console.log('🔍 Found expenses:', expenses.length);
    console.log('🔍 Total expenses in DB:', totalExpenses);

    res.status(200).json({
      success: true,
      data: expenses,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalExpenses / parseInt(limit)),
        totalExpenses,
        hasNextPage: parseInt(page) < Math.ceil(totalExpenses / parseInt(limit)),
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Error in getExpenses:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching expenses',
      error: error.message
    });
  }
});

// @desc    Get single expense
// @route   GET /api/expenses/:id
// @access  Private
export const getExpense = asyncHandler(async (req, res) => {
  // Ensure user is authenticated
  if (!req.userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // Use findById with userId to automatically verify ownership
  const expense = await Expense.findById(req.params.id, req.userId);

  if (!expense) {
    return res.status(404).json({
      success: false,
      message: 'Expense not found or access denied'
    });
  }
  
  res.status(200).json({
    success: true,
    data: expense
  });
});

// @desc    Create new expense
// @route   POST /api/expenses
// @access  Private
export const createExpense = asyncHandler(async (req, res) => {
  // Ensure user is authenticated
  if (!req.userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  const { description, amount, category, date } = req.body;

  // Validate required fields
  if (!description || !amount || !category || !date) {
    return res.status(400).json({
      success: false,
      message: 'Please provide description, amount, category, and date'
    });
  }

  try {
    const expenseData = {
      description,
      amount: parseFloat(amount),
      category,
      date: new Date(date),
      userId: req.userId,
      createdAt: new Date()
    };

    // Use Expense instead of ExpenseModel
    const expense = await Expense.create(expenseData);

    res.status(201).json({
      success: true,
      data: expense,
      message: 'Expense created successfully'
    });
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating expense',
      error: error.message
    });
  }
});

// @desc    Update expense
// @route   PUT /api/expenses/:id
// @access  Private
export const updateExpense = asyncHandler(async (req, res) => {
  // Ensure user is authenticated
  if (!req.userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // Validate input first
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

  // Update expense with user verification
  const expense = await Expense.findByIdAndUpdate(req.params.id, value, req.userId);

  if (!expense) {
    return res.status(404).json({
      success: false,
      message: 'Expense not found or access denied'
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
// @access  Private
export const deleteExpense = asyncHandler(async (req, res) => {
  // Ensure user is authenticated
  if (!req.userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  const expenseId = req.params.id;

  if (!expenseId || expenseId === 'undefined') {
    return res.status(400).json({
      success: false,
      message: 'Invalid expense ID provided'
    });
  }

  // Delete expense with user verification
  const expense = await Expense.findByIdAndDelete(expenseId, req.userId);

  if (!expense) {
    return res.status(404).json({
      success: false,
      message: 'Expense not found or access denied'
    });
  }
  
  res.status(200).json({
    success: true,
    message: 'Expense deleted successfully'
  });
});

// @desc    Get expenses grouped by date
// @route   GET /api/expenses/grouped-by-date
// @access  Private
export const getExpensesGroupedByDate = asyncHandler(async (req, res) => {
  // Ensure user is authenticated
  if (!req.userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  const { startDate, endDate, limit = 100 } = req.query;

  // Build filters
  const filters = {
    startDate,
    endDate,
    sortBy: 'date',
    sortOrder: 'desc',
    limit: parseInt(limit)
  };

  // CRITICAL: Always filter by authenticated user's ID
  const groupedExpenses = await Expense.getExpensesGroupedByDate(filters, req.userId);

  res.status(200).json({
    success: true,
    data: groupedExpenses,
    totalGroups: groupedExpenses.length,
    totalExpenses: groupedExpenses.reduce((sum, group) => sum + group.count, 0)
  });
});

// @desc    Get expense statistics
// @route   GET /api/expenses/stats
// @access  Private
export const getExpenseStats = asyncHandler(async (req, res) => {
  // Ensure user is authenticated
  if (!req.userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  const { startDate, endDate } = req.query;

  // Build filters for user-specific expenses
  const filters = {
    startDate,
    endDate,
    sortBy: 'date',
    sortOrder: 'desc'
  };

  // Get user's expenses
  const expenses = await Expense.find(filters, req.userId);

  // Calculate statistics
  const totalExpenses = expenses.length;
  const totalAmount = expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
  const averageAmount = totalExpenses > 0 ? totalAmount / totalExpenses : 0;
  const maxAmount = totalExpenses > 0 ? Math.max(...expenses.map(e => e.amount || 0)) : 0;
  const minAmount = totalExpenses > 0 ? Math.min(...expenses.map(e => e.amount || 0)) : 0;

  // Get category statistics for the user
  const categoryStats = await Expense.getCategoryTotals(
    startDate ? new Date(startDate) : new Date(0),
    endDate ? new Date(endDate) : new Date(),
    req.userId
  );

  res.status(200).json({
    success: true,
    data: {
      overview: {
        totalAmount,
        totalExpenses,
        averageAmount,
        maxAmount,
        minAmount
      },
      categoryBreakdown: categoryStats
    }
  });
});
