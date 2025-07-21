import { Expense } from '../models/index.js';
import { WeeklyAnalysis } from '../models/index.js';
import User from '../models/FirestoreUser.js';

class DataRetentionService {
  constructor() {
    this.defaultRetentionMonths = 3;
  }

  // Calculate the cutoff date for data retention
  calculateCutoffDate(retentionMonths = this.defaultRetentionMonths) {
    const now = new Date();
    const cutoffDate = new Date(now.getFullYear(), now.getMonth() - retentionMonths, 1);
    console.log(`📅 Data retention cutoff date: ${cutoffDate.toISOString()} (${retentionMonths} months ago)`);
    return cutoffDate;
  }

  // Check if cleanup is needed for a user
  async shouldCleanupUser(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) return false;

      // Get user's retention settings or use default
      const retentionMonths = user.dataRetention?.months || this.defaultRetentionMonths;
      const cutoffDate = this.calculateCutoffDate(retentionMonths);

      // Check if user has expenses older than cutoff
      const oldExpenses = await Expense.getByDateRange(
        '1970-01-01', // Very old date
        cutoffDate.toISOString(),
        userId
      );

      console.log(`🔍 User ${userId}: Found ${oldExpenses.length} expenses older than ${cutoffDate.toDateString()}`);
      return oldExpenses.length > 0;
    } catch (error) {
      console.error(`❌ Error checking cleanup need for user ${userId}:`, error);
      return false;
    }
  }

  // Clean up old expenses for a specific user
  async cleanupUserExpenses(userId, retentionMonths = this.defaultRetentionMonths) {
    try {
      console.log(`🧹 Starting expense cleanup for user ${userId} (${retentionMonths} months retention)`);
      
      const cutoffDate = this.calculateCutoffDate(retentionMonths);
      
      // Get expenses to be deleted
      const expensesToDelete = await Expense.getByDateRange(
        '1970-01-01',
        cutoffDate.toISOString(),
        userId
      );

      if (expensesToDelete.length === 0) {
        console.log(`✅ No old expenses to clean up for user ${userId}`);
        return {
          success: true,
          deletedExpenses: 0,
          cutoffDate: cutoffDate.toISOString()
        };
      }

      console.log(`🗑️ Deleting ${expensesToDelete.length} old expenses for user ${userId}`);

      // Delete expenses in batches to avoid overwhelming the database
      const batchSize = 50;
      let deletedCount = 0;

      for (let i = 0; i < expensesToDelete.length; i += batchSize) {
        const batch = expensesToDelete.slice(i, i + batchSize);
        
        for (const expense of batch) {
          try {
            await Expense.delete(expense.id);
            deletedCount++;
          } catch (error) {
            console.error(`❌ Failed to delete expense ${expense.id}:`, error);
          }
        }

        // Small delay between batches
        if (i + batchSize < expensesToDelete.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`✅ Deleted ${deletedCount} old expenses for user ${userId}`);

      return {
        success: true,
        deletedExpenses: deletedCount,
        cutoffDate: cutoffDate.toISOString(),
        totalFound: expensesToDelete.length
      };
    } catch (error) {
      console.error(`❌ Error cleaning up expenses for user ${userId}:`, error);
      throw error;
    }
  }

  // Clean up old weekly analysis data
  async cleanupUserAnalysis(userId, retentionMonths = this.defaultRetentionMonths) {
    try {
      console.log(`🧹 Starting analysis cleanup for user ${userId}`);
      
      const cutoffDate = this.calculateCutoffDate(retentionMonths);
      
      // Note: This assumes you have a WeeklyAnalysis model
      // If you don't have this model yet, this will be a placeholder
      try {
        const oldAnalysis = await WeeklyAnalysis.getOlderThan(cutoffDate, userId);
        
        if (oldAnalysis.length === 0) {
          console.log(`✅ No old analysis to clean up for user ${userId}`);
          return { success: true, deletedAnalysis: 0 };
        }

        let deletedCount = 0;
        for (const analysis of oldAnalysis) {
          try {
            await WeeklyAnalysis.delete(analysis.id);
            deletedCount++;
          } catch (error) {
            console.error(`❌ Failed to delete analysis ${analysis.id}:`, error);
          }
        }

        console.log(`✅ Deleted ${deletedCount} old analysis records for user ${userId}`);
        return { success: true, deletedAnalysis: deletedCount };
      } catch (error) {
        // If WeeklyAnalysis model doesn't exist yet, just log and continue
        console.log(`ℹ️ WeeklyAnalysis cleanup skipped (model not available): ${error.message}`);
        return { success: true, deletedAnalysis: 0, skipped: true };
      }
    } catch (error) {
      console.error(`❌ Error cleaning up analysis for user ${userId}:`, error);
      throw error;
    }
  }

  // Perform complete cleanup for a user
  async cleanupUser(userId, retentionMonths = this.defaultRetentionMonths) {
    try {
      console.log(`🧹 Starting complete cleanup for user ${userId}`);
      
      const expenseResult = await this.cleanupUserExpenses(userId, retentionMonths);
      const analysisResult = await this.cleanupUserAnalysis(userId, retentionMonths);

      const result = {
        success: true,
        userId,
        retentionMonths,
        cutoffDate: expenseResult.cutoffDate,
        expenses: {
          deleted: expenseResult.deletedExpenses,
          found: expenseResult.totalFound || expenseResult.deletedExpenses
        },
        analysis: {
          deleted: analysisResult.deletedAnalysis,
          skipped: analysisResult.skipped || false
        },
        timestamp: new Date().toISOString()
      };

      console.log(`✅ Cleanup completed for user ${userId}:`, result);
      return result;
    } catch (error) {
      console.error(`❌ Error during complete cleanup for user ${userId}:`, error);
      throw error;
    }
  }

  // Clean up all users (for scheduled job)
  async cleanupAllUsers() {
    try {
      console.log('🧹 Starting cleanup for all users...');
      
      // Get all active users
      const users = await User.getAllActive();
      console.log(`👥 Found ${users.length} active users to check`);

      const results = {
        totalUsers: users.length,
        processedUsers: 0,
        cleanedUsers: 0,
        totalExpensesDeleted: 0,
        totalAnalysisDeleted: 0,
        errors: [],
        timestamp: new Date().toISOString()
      };

      for (const user of users) {
        try {
          results.processedUsers++;
          
          // Check if cleanup is needed
          const needsCleanup = await this.shouldCleanupUser(user.id);
          
          if (needsCleanup) {
            const userRetention = user.dataRetention?.months || this.defaultRetentionMonths;
            const cleanupResult = await this.cleanupUser(user.id, userRetention);
            
            results.cleanedUsers++;
            results.totalExpensesDeleted += cleanupResult.expenses.deleted;
            results.totalAnalysisDeleted += cleanupResult.analysis.deleted;
          } else {
            console.log(`✅ User ${user.id} doesn't need cleanup`);
          }
        } catch (error) {
          console.error(`❌ Error cleaning up user ${user.id}:`, error);
          results.errors.push({
            userId: user.id,
            error: error.message
          });
        }
      }

      console.log('✅ Global cleanup completed:', results);
      return results;
    } catch (error) {
      console.error('❌ Error during global cleanup:', error);
      throw error;
    }
  }

  // Get cleanup preview for a user (what would be deleted)
  async getCleanupPreview(userId, retentionMonths = this.defaultRetentionMonths) {
    try {
      const cutoffDate = this.calculateCutoffDate(retentionMonths);
      
      const expensesToDelete = await Expense.getByDateRange(
        '1970-01-01',
        cutoffDate.toISOString(),
        userId
      );

      // Calculate total amount that would be deleted
      const totalAmount = expensesToDelete.reduce((sum, expense) => sum + (expense.amount || 0), 0);

      // Group by month for preview
      const monthlyBreakdown = {};
      expensesToDelete.forEach(expense => {
        const date = new Date(expense.date._seconds ? expense.date._seconds * 1000 : expense.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyBreakdown[monthKey]) {
          monthlyBreakdown[monthKey] = { count: 0, amount: 0 };
        }
        monthlyBreakdown[monthKey].count++;
        monthlyBreakdown[monthKey].amount += expense.amount || 0;
      });

      return {
        cutoffDate: cutoffDate.toISOString(),
        retentionMonths,
        totalExpenses: expensesToDelete.length,
        totalAmount,
        monthlyBreakdown,
        oldestExpense: expensesToDelete.length > 0 ? 
          Math.min(...expensesToDelete.map(e => new Date(e.date._seconds ? e.date._seconds * 1000 : e.date).getTime())) : null,
        newestExpenseToDelete: expensesToDelete.length > 0 ?
          Math.max(...expensesToDelete.map(e => new Date(e.date._seconds ? e.date._seconds * 1000 : e.date).getTime())) : null
      };
    } catch (error) {
      console.error(`❌ Error generating cleanup preview for user ${userId}:`, error);
      throw error;
    }
  }
}

export default new DataRetentionService();
