import { Expense, WeeklyAnalysis } from '../models/index.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import moment from 'moment';

// @desc    Get weekly analysis
// @route   GET /api/analysis/weekly
// @access  Public
export const getWeeklyAnalysis = asyncHandler(async (req, res) => {
  console.log('🔍 GET /api/analysis/weekly called with query:', req.query);

  const { startDate } = req.query;

  if (!startDate) {
    console.log('❌ No startDate provided');
    return res.status(400).json({
      success: false,
      message: 'Start date is required'
    });
  }

  const weekStart = moment(startDate).startOf('day').toDate();
  const weekEnd = moment(weekStart).add(6, 'days').endOf('day').toDate();

  console.log('📅 Week range:', { weekStart, weekEnd, startDate });

  // Check if analysis already exists
  console.log('🔍 Checking for existing analysis...');
  let analysis = await WeeklyAnalysis.findByWeek(weekStart);

  if (!analysis) {
    console.log('❌ No existing analysis found, generating new one...');
    // Generate new analysis
    analysis = await createWeeklyAnalysis(weekStart, weekEnd);
    console.log('✅ New analysis created:', analysis);
  } else {
    console.log('✅ Found existing analysis:', analysis);
  }

  // Ensure analysis has all required fields
  if (!analysis) {
    console.log('❌ Analysis is null, creating empty analysis');
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

  // Ensure topExpenses exists
  if (!analysis.topExpenses) {
    console.log('⚠️ topExpenses missing, adding empty array');
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

// @desc    Generate weekly analysis
// @route   POST /api/analysis/weekly/generate
// @access  Public
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
const createWeeklyAnalysis = async (weekStart, weekEnd) => {
  console.log('🏗️ Creating weekly analysis for range:', { weekStart, weekEnd });

  // Get all expenses for the week
  console.log('📊 Fetching expenses from database...');
  console.log('📅 Date range for query:', { weekStart, weekEnd });

  // Get all expenses without user filtering for now
  const expenses = await Expense.find({
    startDate: weekStart,
    endDate: weekEnd,
    sortBy: 'date',
    sortOrder: 'desc'
  });

  console.log('💰 Found expenses:', expenses.length);
  console.log('💰 Expense details:', expenses.map(e => ({
    id: e.id,
    description: e.description,
    amount: e.amount,
    category: e.category,
    date: e.date
  })));

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
  
  console.log('💾 Saving analysis data:', analysisData);

  const analysis = await WeeklyAnalysis.findOneAndUpdate(
    { weekStartDate: weekStart },
    analysisData,
    { upsert: true, new: true }
  );

  console.log('✅ Analysis saved successfully:', {
    id: analysis?.id,
    hasTopExpenses: !!analysis?.topExpenses,
    topExpensesCount: analysis?.topExpenses?.length || 0
  });

  return analysis;
};

// @desc    Get recent analyses
// @route   GET /api/analysis/recent
// @access  Public
export const getRecentAnalyses = asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;
  
  const analyses = await WeeklyAnalysis.getRecentAnalyses(parseInt(limit));
  
  res.status(200).json({
    success: true,
    data: analyses
  });
});
