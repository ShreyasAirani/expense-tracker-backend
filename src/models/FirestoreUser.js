import { db } from '../config/database.js';
import { FieldValue } from 'firebase-admin/firestore';
import bcrypt from 'bcryptjs';

class UserModel {
  constructor() {
    this.collection = db.collection('users');
  }

  // Create a new user
  async create(userData) {
    try {
      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

      const user = {
        email: userData.email.toLowerCase(),
        name: userData.name,
        password: hashedPassword,
        income: userData.income || null, // Add income field
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        isActive: true,
        preferences: {
          currency: 'USD',
          dateFormat: 'MM/dd/yyyy',
          categories: [
            'Food', 'Transportation', 'Entertainment', 'Shopping',
            'Health', 'Utilities', 'Education', 'Other'
          ]
        },
        notifications: {
          email: {
            enabled: false,
            dailySummary: false,
            weeklyReport: false,
            budgetAlerts: false,
            unusualSpending: false
          },
          preferences: {
            dailySummaryTime: '18:00', // 6 PM default
            timezone: 'America/New_York',
            minimumDailyAmount: 0, // Send summary even if $0 spent
            weeklyReportDay: 'sunday' // sunday, monday, etc.
          }
        }
      };

      const docRef = await this.collection.add(user);
      const doc = await docRef.get();
      
      // Return user without password
      const { password, ...userWithoutPassword } = doc.data();
      return {
        id: doc.id,
        ...userWithoutPassword
      };
    } catch (error) {
      throw new Error(`Error creating user: ${error.message}`);
    }
  }

  // Find user by email
  async findByEmail(email) {
    try {
      const snapshot = await this.collection
        .where('email', '==', email.toLowerCase())
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data()
      };
    } catch (error) {
      throw new Error(`Error finding user: ${error.message}`);
    }
  }

  // Find user by ID
  async findById(id) {
    try {
      const doc = await this.collection.doc(id).get();
      
      if (!doc.exists) {
        return null;
      }

      const { password, ...userWithoutPassword } = doc.data();
      return {
        id: doc.id,
        ...userWithoutPassword
      };
    } catch (error) {
      throw new Error(`Error fetching user: ${error.message}`);
    }
  }

  // Update user
  async findByIdAndUpdate(id, updateData) {
    try {
      const updatePayload = {
        ...updateData,
        updatedAt: FieldValue.serverTimestamp()
      };

      // Don't allow password updates through this method
      delete updatePayload.password;

      await this.collection.doc(id).update(updatePayload);
      
      // Return updated user
      return await this.findById(id);
    } catch (error) {
      throw new Error(`Error updating user: ${error.message}`);
    }
  }

  // Verify password
  async verifyPassword(plainPassword, hashedPassword) {
    try {
      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
      throw new Error(`Error verifying password: ${error.message}`);
    }
  }

  // Update password
  async updatePassword(id, newPassword) {
    try {
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      await this.collection.doc(id).update({
        password: hashedPassword,
        updatedAt: FieldValue.serverTimestamp()
      });

      return true;
    } catch (error) {
      throw new Error(`Error updating password: ${error.message}`);
    }
  }

  // Check if email exists
  async emailExists(email) {
    try {
      const user = await this.findByEmail(email);
      return !!user;
    } catch (error) {
      return false;
    }
  }

  // Get user stats
  async getUserStats(userId) {
    try {
      // This would typically involve aggregating data from expenses collection
      // For now, return basic user info
      const user = await this.findById(userId);
      if (!user) return null;

      return {
        userId: user.id,
        name: user.name,
        email: user.email,
        memberSince: user.createdAt,
        preferences: user.preferences,
        notifications: user.notifications
      };
    } catch (error) {
      throw new Error(`Error getting user stats: ${error.message}`);
    }
  }

  // Update notification preferences
  async updateNotificationPreferences(userId, notificationData) {
    try {
      const user = await this.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const updatePayload = {
        notifications: {
          ...user.notifications,
          ...notificationData
        },
        updatedAt: FieldValue.serverTimestamp()
      };

      await this.collection.doc(userId).update(updatePayload);

      return await this.findById(userId);
    } catch (error) {
      throw new Error(`Error updating notification preferences: ${error.message}`);
    }
  }

  // Get users with daily summary notifications enabled
  async getUsersWithDailySummaryEnabled() {
    try {
      const snapshot = await this.collection
        .where('notifications.email.enabled', '==', true)
        .where('notifications.email.dailySummary', '==', true)
        .where('isActive', '==', true)
        .get();

      if (snapshot.empty) {
        return [];
      }

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      throw new Error(`Error fetching users with daily summary enabled: ${error.message}`);
    }
  }

  // Get users with weekly report notifications enabled
  async getUsersWithWeeklyReportEnabled() {
    try {
      const snapshot = await this.collection
        .where('notifications.email.enabled', '==', true)
        .where('notifications.email.weeklyReport', '==', true)
        .where('isActive', '==', true)
        .get();

      if (snapshot.empty) {
        return [];
      }

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      throw new Error(`Error fetching users with weekly report enabled: ${error.message}`);
    }
  }

  // Find user by ID with password (for password verification)
  async findByIdWithPassword(id) {
    try {
      const doc = await this.collection.doc(id).get();

      if (!doc.exists) {
        return null;
      }

      return {
        id: doc.id,
        ...doc.data()
      };
    } catch (error) {
      throw new Error(`Error fetching user with password: ${error.message}`);
    }
  }

  // Update user password
  async updatePassword(id, hashedPassword) {
    try {
      await this.collection.doc(id).update({
        password: hashedPassword,
        updatedAt: FieldValue.serverTimestamp()
      });

      return true;
    } catch (error) {
      throw new Error(`Error updating password: ${error.message}`);
    }
  }

  // Delete user account
  async findByIdAndDelete(id) {
    try {
      const user = await this.findById(id);
      if (!user) {
        return null;
      }

      await this.collection.doc(id).delete();
      return user;
    } catch (error) {
      throw new Error(`Error deleting user: ${error.message}`);
    }
  }

  // Get all active users (for data cleanup)
  async getAllActive() {
    try {
      const snapshot = await this.collection
        .where('isActive', '==', true)
        .get();

      if (snapshot.empty) {
        return [];
      }

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      throw new Error(`Error fetching active users: ${error.message}`);
    }
  }
}

// Export singleton instance
export default new UserModel();
