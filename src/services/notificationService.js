import nodemailer from 'nodemailer';
import { Expense } from '../models/index.js';

class NotificationService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
    this.initializationPromise = null;
  }

  async ensureInitialized() {
    if (!this.initialized && !this.initializationPromise) {
      this.initializationPromise = this.initializeTransporter();
    }
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
  }

  // Initialize email transporter
  async initializeTransporter() {
    try {
      // Check if we have Gmail credentials
      if (process.env.SMTP_HOST === 'smtp.gmail.com' && process.env.SMTP_USER && process.env.SMTP_PASS) {
        console.log('📧 Configuring Gmail SMTP...');
        this.transporter = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 587,
          secure: false, // true for 465, false for other ports
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });
        console.log('📧 Gmail SMTP configured for:', process.env.SMTP_USER);
      } else if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        // Use provided SMTP credentials
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT || 587,
          secure: process.env.SMTP_PORT == 465, // true for 465, false for other ports
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });
        console.log('📧 Custom SMTP configured for:', process.env.SMTP_USER);
      } else {
        // Fallback to Ethereal Email for testing
        console.log('📧 Creating test email account with Ethereal...');
        const testAccount = await nodemailer.createTestAccount();

        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass
          }
        });

        console.log('📧 Test email account created:', testAccount.user);
        console.log('📧 Preview emails at: https://ethereal.email');
      }

      console.log('📧 Email transporter initialized successfully');
      this.initialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize email transporter:', error);
      this.initialized = false;
    } finally {
      this.initializationPromise = null;
    }
  }

  // Generate daily expense summary for a user
  async generateDailySummary(userId, date = new Date()) {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Get today's expenses
      const todayExpenses = await Expense.getByDateRange(
        startOfDay.toISOString(),
        endOfDay.toISOString(),
        userId
      );

      // Calculate totals
      const totalAmount = todayExpenses.reduce((sum, expense) => sum + expense.amount, 0);
      const expenseCount = todayExpenses.length;

      // Group by category
      const categoryTotals = {};
      todayExpenses.forEach(expense => {
        const category = expense.category || 'Other';
        categoryTotals[category] = (categoryTotals[category] || 0) + expense.amount;
      });

      // Get top categories
      const topCategories = Object.entries(categoryTotals)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);

      // Get week comparison
      const weekStart = new Date(date);
      weekStart.setDate(weekStart.getDate() - 6);
      weekStart.setHours(0, 0, 0, 0);

      const weekExpenses = await Expense.getByDateRange(
        weekStart.toISOString(),
        endOfDay.toISOString(),
        userId
      );

      const weekTotal = weekExpenses.reduce((sum, expense) => sum + expense.amount, 0);
      const dailyAverage = weekTotal / 7;

      return {
        date: date.toDateString(),
        totalAmount,
        expenseCount,
        categoryTotals,
        topCategories,
        weekTotal,
        dailyAverage,
        expenses: todayExpenses,
        comparisonToAverage: totalAmount - dailyAverage
      };
    } catch (error) {
      console.error('Error generating daily summary:', error);
      throw error;
    }
  }

  // Generate HTML email template for daily summary
  generateDailySummaryHTML(summary, userName) {
    const formatCurrency = (amount) => `$${amount.toFixed(2)}`;
    const comparisonText = summary.comparisonToAverage > 0 
      ? `$${summary.comparisonToAverage.toFixed(2)} above` 
      : `$${Math.abs(summary.comparisonToAverage).toFixed(2)} below`;
    const comparisonColor = summary.comparisonToAverage > 0 ? '#ef4444' : '#10b981';

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Daily Expense Summary</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; }
        .content { padding: 30px 20px; }
        .summary-card { background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #667eea; }
        .amount { font-size: 2em; font-weight: bold; color: #667eea; }
        .category-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
        .comparison { padding: 15px; border-radius: 6px; margin: 15px 0; }
        .footer { background: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 0.9em; }
        .expense-item { background: white; border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>💰 Daily Expense Summary</h1>
          <p>Hello ${userName}! Here's your spending summary for ${summary.date}</p>
        </div>
        
        <div class="content">
          <div class="summary-card">
            <h2>📊 Today's Overview</h2>
            <div class="amount">${formatCurrency(summary.totalAmount)}</div>
            <p>${summary.expenseCount} expense${summary.expenseCount !== 1 ? 's' : ''} recorded</p>
            
            <div class="comparison" style="background-color: ${comparisonColor}15; border-left: 4px solid ${comparisonColor};">
              <strong style="color: ${comparisonColor};">${comparisonText}</strong> your 7-day average of ${formatCurrency(summary.dailyAverage)}
            </div>
          </div>

          ${summary.topCategories.length > 0 ? `
          <div class="summary-card">
            <h3>🏷️ Top Categories</h3>
            ${summary.topCategories.map(([category, amount]) => `
              <div class="category-item">
                <span>${category}</span>
                <strong>${formatCurrency(amount)}</strong>
              </div>
            `).join('')}
          </div>
          ` : ''}

          ${summary.expenses.length > 0 ? `
          <div class="summary-card">
            <h3>📝 Today's Expenses</h3>
            ${summary.expenses.slice(0, 5).map(expense => `
              <div class="expense-item">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <strong>${expense.description}</strong>
                    <div style="color: #64748b; font-size: 0.9em;">${expense.category || 'Other'}</div>
                  </div>
                  <div style="font-weight: bold; color: #667eea;">${formatCurrency(expense.amount)}</div>
                </div>
              </div>
            `).join('')}
            ${summary.expenses.length > 5 ? `<p style="text-align: center; color: #64748b;">... and ${summary.expenses.length - 5} more expenses</p>` : ''}
          </div>
          ` : ''}

          <div class="summary-card">
            <h3>📈 Weekly Context</h3>
            <p>This week's total: <strong>${formatCurrency(summary.weekTotal)}</strong></p>
            <p>Daily average: <strong>${formatCurrency(summary.dailyAverage)}</strong></p>
          </div>
        </div>

        <div class="footer">
          <p>This summary was generated by your Expense Tracker app</p>
          <p>To manage your notification preferences, visit your account settings</p>
        </div>
      </div>
    </body>
    </html>
    `;
  }

  // Send daily summary email
  async sendDailySummary(userEmail, userName, userId, date = new Date()) {
    try {
      await this.ensureInitialized();
      if (!this.transporter) {
        throw new Error('Email transporter not initialized');
      }

      const summary = await this.generateDailySummary(userId, date);
      
      // Skip sending if no expenses for the day
      if (summary.expenseCount === 0) {
        console.log(`📧 Skipping daily summary for ${userEmail} - no expenses today`);
        return { success: true, skipped: true, reason: 'No expenses today' };
      }

      const htmlContent = this.generateDailySummaryHTML(summary, userName);
      
      const mailOptions = {
        from: process.env.FROM_EMAIL || 'noreply@expensetracker.com',
        to: userEmail,
        subject: `💰 Daily Expense Summary - ${summary.date}`,
        html: htmlContent,
        text: `Daily Expense Summary for ${summary.date}\n\nTotal spent: $${summary.totalAmount.toFixed(2)}\nNumber of expenses: ${summary.expenseCount}\n\nTop categories:\n${summary.topCategories.map(([cat, amt]) => `${cat}: $${amt.toFixed(2)}`).join('\n')}`
      };

      const info = await this.transporter.sendMail(mailOptions);

      console.log(`📧 Daily summary sent to ${userEmail}:`, info.messageId);

      // Generate preview URL for Ethereal Email
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log(`📧 Preview URL: ${previewUrl}`);
      }

      return {
        success: true,
        messageId: info.messageId,
        previewUrl: previewUrl || null,
        summary
      };
    } catch (error) {
      console.error(`❌ Failed to send daily summary to ${userEmail}:`, error);
      throw error;
    }
  }

  // Send test notification
  async sendTestNotification(userEmail, userName) {
    try {
      await this.ensureInitialized();
      if (!this.transporter) {
        throw new Error('Email transporter not initialized');
      }

      const mailOptions = {
        from: process.env.FROM_EMAIL || 'noreply@expensetracker.com',
        to: userEmail,
        subject: '✅ Test Notification - Expense Tracker',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #667eea;">🎉 Test Notification Successful!</h2>
            <p>Hello ${userName},</p>
            <p>This is a test notification from your Expense Tracker app. If you're receiving this email, your notification settings are working correctly!</p>
            <p>You'll receive daily expense summaries at your preferred time when you have expenses to report.</p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #e2e8f0;">
            <p style="color: #64748b; font-size: 0.9em;">This is an automated message from Expense Tracker.</p>
          </div>
        `,
        text: `Test Notification - Hello ${userName}, this is a test notification from your Expense Tracker app. Your notification settings are working correctly!`
      };

      const info = await this.transporter.sendMail(mailOptions);

      console.log(`📧 Test notification sent to ${userEmail}:`, info.messageId);

      // Generate preview URL for Ethereal Email
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log(`📧 Preview URL: ${previewUrl}`);
      }

      return {
        success: true,
        messageId: info.messageId,
        previewUrl: previewUrl || null
      };
    } catch (error) {
      console.error(`❌ Failed to send test notification to ${userEmail}:`, error);
      throw error;
    }
  }
}

export default new NotificationService();
