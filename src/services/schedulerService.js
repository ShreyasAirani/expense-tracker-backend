import cron from 'node-cron';
import User from '../models/FirestoreUser.js';
import notificationService from './notificationService.js';
import dataRetentionService from './dataRetentionService.js';

class SchedulerService {
  constructor() {
    this.jobs = new Map();
    this.isInitialized = false;
  }

  // Initialize all scheduled jobs
  initialize() {
    if (this.isInitialized) {
      console.log('⏰ Scheduler already initialized');
      return;
    }

    try {
      this.setupDailySummaryJob();
      this.setupWeeklyReportJob();
      this.setupDataCleanupJob();
      this.isInitialized = true;
      console.log('⏰ Scheduler service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize scheduler service:', error);
    }
  }

  // Setup daily summary job - runs every day at 6 PM
  setupDailySummaryJob() {
    // Run every day at 6:00 PM (18:00)
    const dailyJob = cron.schedule('0 18 * * *', async () => {
      console.log('📧 Starting daily summary job...');
      await this.sendDailySummaries();
    }, {
      scheduled: false, // Don't start immediately
      timezone: 'America/New_York'
    });

    this.jobs.set('dailySummary', dailyJob);
    dailyJob.start();
    console.log('⏰ Daily summary job scheduled for 6:00 PM daily');
  }

  // Setup weekly report job - runs every Sunday at 9 AM
  setupWeeklyReportJob() {
    // Run every Sunday at 9:00 AM
    const weeklyJob = cron.schedule('0 9 * * 0', async () => {
      console.log('📊 Starting weekly report job...');
      await this.sendWeeklyReports();
    }, {
      scheduled: false,
      timezone: 'America/New_York'
    });

    this.jobs.set('weeklyReport', weeklyJob);
    weeklyJob.start();
    console.log('⏰ Weekly report job scheduled for Sundays at 9:00 AM');
  }

  // Setup data cleanup job - runs on the 1st of every month at 2 AM
  setupDataCleanupJob() {
    // Run on the 1st day of every month at 2:00 AM
    const cleanupJob = cron.schedule('0 2 1 * *', async () => {
      console.log('🧹 Starting monthly data cleanup job...');
      await this.performDataCleanup();
    }, {
      scheduled: false,
      timezone: 'America/New_York'
    });

    this.jobs.set('dataCleanup', cleanupJob);
    cleanupJob.start();
    console.log('⏰ Data cleanup job scheduled for 1st of every month at 2:00 AM');
  }

  // Send daily summaries to all eligible users
  async sendDailySummaries() {
    try {
      const users = await User.getUsersWithDailySummaryEnabled();
      console.log(`📧 Found ${users.length} users with daily summary enabled`);

      if (users.length === 0) {
        console.log('📧 No users to send daily summaries to');
        return;
      }

      const results = {
        sent: 0,
        skipped: 0,
        failed: 0,
        errors: []
      };

      // Process users in batches to avoid overwhelming the email service
      const batchSize = 10;
      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);
        
        await Promise.allSettled(
          batch.map(async (user) => {
            try {
              const result = await notificationService.sendDailySummary(
                user.email,
                user.name,
                user.id
              );

              if (result.skipped) {
                results.skipped++;
                console.log(`📧 Skipped daily summary for ${user.email}: ${result.reason}`);
              } else {
                results.sent++;
                console.log(`📧 Daily summary sent to ${user.email}`);
              }
            } catch (error) {
              results.failed++;
              results.errors.push({
                user: user.email,
                error: error.message
              });
              console.error(`❌ Failed to send daily summary to ${user.email}:`, error.message);
            }
          })
        );

        // Add a small delay between batches
        if (i + batchSize < users.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`📧 Daily summary job completed:`, results);
      return results;
    } catch (error) {
      console.error('❌ Error in daily summary job:', error);
      throw error;
    }
  }

  // Send weekly reports to all eligible users
  async sendWeeklyReports() {
    try {
      const users = await User.getUsersWithWeeklyReportEnabled();
      console.log(`📊 Found ${users.length} users with weekly report enabled`);

      if (users.length === 0) {
        console.log('📊 No users to send weekly reports to');
        return;
      }

      const results = {
        sent: 0,
        failed: 0,
        errors: []
      };

      // For now, we'll just log that weekly reports would be sent
      // You can implement the actual weekly report generation later
      for (const user of users) {
        try {
          console.log(`📊 Would send weekly report to ${user.email}`);
          results.sent++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            user: user.email,
            error: error.message
          });
        }
      }

      console.log(`📊 Weekly report job completed:`, results);
      return results;
    } catch (error) {
      console.error('❌ Error in weekly report job:', error);
      throw error;
    }
  }

  // Perform monthly data cleanup
  async performDataCleanup() {
    try {
      console.log('🧹 Starting monthly data cleanup...');

      const results = await dataRetentionService.cleanupAllUsers();

      console.log('✅ Monthly data cleanup completed:', {
        totalUsers: results.totalUsers,
        cleanedUsers: results.cleanedUsers,
        totalExpensesDeleted: results.totalExpensesDeleted,
        totalAnalysisDeleted: results.totalAnalysisDeleted,
        errors: results.errors.length
      });

      // Log any errors
      if (results.errors.length > 0) {
        console.error('❌ Data cleanup errors:', results.errors);
      }

      return results;
    } catch (error) {
      console.error('❌ Error in monthly data cleanup job:', error);
      throw error;
    }
  }

  // Manually trigger daily summary for testing
  async triggerDailySummary() {
    console.log('🔧 Manually triggering daily summary job...');
    return await this.sendDailySummaries();
  }

  // Manually trigger weekly report for testing
  async triggerWeeklyReport() {
    console.log('🔧 Manually triggering weekly report job...');
    return await this.sendWeeklyReports();
  }

  // Manually trigger data cleanup for testing
  async triggerDataCleanup() {
    console.log('🔧 Manually triggering data cleanup job...');
    return await this.performDataCleanup();
  }

  // Manually trigger data cleanup for specific user
  async triggerUserCleanup(userId, retentionMonths) {
    console.log(`🔧 Manually triggering cleanup for user ${userId}...`);
    return await dataRetentionService.cleanupUser(userId, retentionMonths);
  }

  // Send daily summary to a specific user (for testing)
  async sendDailySummaryToUser(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const result = await notificationService.sendDailySummary(
        user.email,
        user.name,
        user.id
      );

      console.log(`📧 Daily summary sent to ${user.email}:`, result);
      return result;
    } catch (error) {
      console.error(`❌ Failed to send daily summary to user ${userId}:`, error);
      throw error;
    }
  }

  // Get job status
  getJobStatus() {
    const status = {};
    
    for (const [jobName, job] of this.jobs) {
      status[jobName] = {
        running: job.running,
        scheduled: job.scheduled
      };
    }

    return {
      initialized: this.isInitialized,
      jobs: status
    };
  }

  // Stop all jobs
  stopAllJobs() {
    for (const [jobName, job] of this.jobs) {
      job.stop();
      console.log(`⏰ Stopped job: ${jobName}`);
    }
    this.isInitialized = false;
  }

  // Start all jobs
  startAllJobs() {
    for (const [jobName, job] of this.jobs) {
      job.start();
      console.log(`⏰ Started job: ${jobName}`);
    }
  }

  // Restart a specific job
  restartJob(jobName) {
    const job = this.jobs.get(jobName);
    if (job) {
      job.stop();
      job.start();
      console.log(`⏰ Restarted job: ${jobName}`);
    } else {
      console.error(`❌ Job not found: ${jobName}`);
    }
  }
}

export default new SchedulerService();
