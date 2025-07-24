import { Expense, WeeklyAnalysis } from '../models/index.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import moment from 'moment';

export const getWeeklyAnalysis = asyncHandler(async (req, res) => {
  if (!req.userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  const { startDate } = req.query;

  if (!startDate) {
    return res.status(400).json({
      success: false,
      message: 'Start date is required'
    });
  }

  const weekStart = moment(startDate).startOf('day').toDate();
  const weekEnd = moment(weekStart).add(6, 'days').endOf('day').toDate();

  let analysis = await WeeklyAnalysis.findByWeek(weekStart);

  if (!analysis) {
    // Generate new analysis with user ID
    analysis = await createWeeklyAnalysis(weekStart, weekEnd, req.userId);
  } else {
  }

  if (!analysis) {
    analysis = {
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      totalAmount: 0,
      totalExpenses: 0,
      averageDailySpend: 0,
      categoryBreakdown: [],
      dailyTotals: [],
      topExpenses: [],
      insights: {}
    };
  }

  if (!analysis.topExpenses) {
    analysis.topExpenses = [];
  }

  console.log('📊 Final analysis data:', {
    hasTopExpenses: !!analysis.topExpenses,
    topExpensesLength: analysis.topExpenses?.length || 0,
    totalAmount: analysis.totalAmount,
    totalExpenses: analysis.totalExpenses
  });

  res.status(200).json({
    success: true,
    data: analysis
  });
});

export const generateWeeklyAnalysis = asyncHandler(async (req, res) => {
  const { startDate } = req.body;
  
  if (!startDate) {
    return res.status(400).json({
      success: false,
      message: 'Start date is required'
    });
  }
  
  const weekStart = moment(startDate).startOf('day').toDate();
  const weekEnd = moment(weekStart).add(6, 'days').endOf('day').toDate();
  
  const analysis = await createWeeklyAnalysis(weekStart, weekEnd);
  
  res.status(201).json({
    success: true,
    data: analysis,
    message: 'Weekly analysis generated successfully'
  });
});

// Helper function to create weekly analysis
const createWeeklyAnalysis = async (weekStart, weekEnd, userId) => {
  if (!userId) {
    throw new Error('User ID is required for creating weekly analysis');
  }

  // Get all expenses for the week for the specific user
  // CRITICAL: Always filter by user ID
  const expenses = await Expense.find({
    startDate: weekStart,
    endDate: weekEnd,
    sortBy: 'date',
    sortOrder: 'desc'
  }, userId);

  if (expenses.length === 0) {
    console.log('❌ No expenses found for this week');
    return {
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      totalAmount: 0,
      totalExpenses: 0,
      averageDailySpend: 0,
      categoryBreakdown: [],
      dailyTotals: [],
      topExpenses: [],
      insights: {}
    };
  }
  
  // Calculate totals
  const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const totalExpenses = expenses.length;
  const averageDailySpend = totalAmount / 7;

  console.log('🧮 Calculated totals:', {
    totalAmount,
    totalExpenses,
    averageDailySpend,
    individualAmounts: expenses.map(e => e.amount)
  });
  
  // Category breakdown
  const categoryMap = new Map();
  expenses.forEach(expense => {
    const category = expense.category || 'Other';
    if (categoryMap.has(category)) {
      categoryMap.get(category).total += expense.amount;
      categoryMap.get(category).count += 1;
    } else {
      categoryMap.set(category, { total: expense.amount, count: 1 });
    }
  });
  
  const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, data]) => ({
    category,
    total: data.total,
    count: data.count,
    percentage: (data.total / totalAmount) * 100
  })).sort((a, b) => b.total - a.total);
  
  // Daily totals
  const dailyMap = new Map();
  for (let i = 0; i < 7; i++) {
    const date = moment(weekStart).add(i, 'days').format('YYYY-MM-DD');
    dailyMap.set(date, { total: 0, expenseCount: 0 });
  }
  
  expenses.forEach(expense => {
    const dateKey = moment(expense.date).format('YYYY-MM-DD');
    if (dailyMap.has(dateKey)) {
      dailyMap.get(dateKey).total += expense.amount;
      dailyMap.get(dateKey).expenseCount += 1;
    }
  });
  
  const dailyTotals = Array.from(dailyMap.entries()).map(([date, data]) => ({
    date: new Date(date),
    total: data.total,
    expenseCount: data.expenseCount
  }));
  
  // Top expenses (top 5)
  const topExpenses = expenses
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map(expense => ({
      amount: expense.amount,
      description: expense.description,
      category: expense.category,
      date: expense.date
    }));
  
  // Insights
  const dailyAmounts = dailyTotals.filter(day => day.total > 0);
  const highestSpendingDay = dailyAmounts.reduce((max, day) => 
    day.total > max.total ? day : max, { total: 0 });
  const lowestSpendingDay = dailyAmounts.reduce((min, day) => 
    day.total < min.total ? day : min, { total: Infinity });
  
  const mostFrequentCategory = categoryBreakdown[0];
  const averageExpenseAmount = totalAmount / totalExpenses;
  
  const insights = {
    highestSpendingDay: highestSpendingDay.total > 0 ? {
      date: highestSpendingDay.date,
      amount: highestSpendingDay.total
    } : null,
    lowestSpendingDay: lowestSpendingDay.total !== Infinity ? {
      date: lowestSpendingDay.date,
      amount: lowestSpendingDay.total
    } : null,
    mostFrequentCategory: mostFrequentCategory ? {
      category: mostFrequentCategory.category,
      count: mostFrequentCategory.count
    } : null,
    averageExpenseAmount
  };
  
  // Create or update analysis
  const analysisData = {
    weekStartDate: weekStart,
    weekEndDate: weekEnd,
    totalAmount,
    totalExpenses,
    averageDailySpend,
    categoryBreakdown,
    dailyTotals,
    topExpenses,
    insights
  };
  
  const analysis = await WeeklyAnalysis.findOneAndUpdate(
    { weekStartDate: weekStart },
    analysisData,
    { upsert: true, new: true }
  );

  return analysis;
};

export const getRecentAnalyses = asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;
  
  const analyses = await WeeklyAnalysis.getRecentAnalyses(parseInt(limit));
  
  res.status(200).json({
    success: true,
    data: analyses
  });
});
