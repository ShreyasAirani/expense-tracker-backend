import { db } from '../config/database.js';
import { FieldValue } from 'firebase-admin/firestore';

class ExpenseModel {
  constructor() {
    this.collection = db.collection('expenses');
  }

  // Create a new expense
  async create(expenseData, userId = null) {
    try {
      const expense = {
        ...expenseData,
        ...(userId && { userId }), // Only add userId if provided
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };

      // Auto-categorize if no category provided
      if (!expense.category || expense.category === 'Other') {
        expense.category = this.autoCategorizе(expense.description);
      }

      const docRef = await this.collection.add(expense);
      const doc = await docRef.get();
      
      return {
        id: doc.id,
        ...doc.data()
      };
    } catch (error) {
      throw new Error(`Error creating expense: ${error.message}`);
    }
  }

  // Get all expenses with optional filters (user-specific)
  async find(filters = {}, userId = null) {
    try {
      let query = this.collection;

      // Filter by user ID first (most important for multi-user)
      // If userId is provided, filter by it; otherwise get all expenses (for testing)
      if (userId) {
        query = query.where('userId', '==', userId);
      }

      // Apply other filters
      if (filters.category) {
        query = query.where('category', '==', filters.category);
      }

      if (filters.startDate && filters.endDate) {
        query = query
          .where('date', '>=', new Date(filters.startDate))
          .where('date', '<=', new Date(filters.endDate));
      }

      // Apply sorting (temporarily disabled to avoid index requirement)
      // TODO: Re-enable after Firestore composite index is created
      // const sortBy = filters.sortBy || 'date';
      // const sortOrder = filters.sortOrder === 'asc' ? 'asc' : 'desc';
      // query = query.orderBy(sortBy, sortOrder);

      // Apply pagination
      if (filters.limit) {
        query = query.limit(parseInt(filters.limit));
      }

      if (filters.offset) {
        query = query.offset(parseInt(filters.offset));
      }

      const snapshot = await query.get();
      const expenses = [];

      snapshot.forEach(doc => {
        expenses.push({
          id: doc.id,
          ...doc.data()
        });
      });

      // Apply client-side sorting (temporary until Firestore index is ready)
      const sortBy = filters.sortBy || 'date';
      const sortOrder = filters.sortOrder === 'asc' ? 'asc' : 'desc';

      expenses.sort((a, b) => {
        let aValue = a[sortBy];
        let bValue = b[sortBy];

        // Handle date sorting
        if (sortBy === 'date') {
          aValue = new Date(aValue);
          bValue = new Date(bValue);
        }

        if (sortOrder === 'asc') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });

      return expenses;
    } catch (error) {
      throw new Error(`Error fetching expenses: ${error.message}`);
    }
  }

  // Get expense by ID
  async findById(id) {
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
      throw new Error(`Error fetching expense: ${error.message}`);
    }
  }

  // Update expense
  async findByIdAndUpdate(id, updateData) {
    try {
      const updatePayload = {
        ...updateData,
        updatedAt: FieldValue.serverTimestamp()
      };

      await this.collection.doc(id).update(updatePayload);
      
      // Return updated document
      return await this.findById(id);
    } catch (error) {
      throw new Error(`Error updating expense: ${error.message}`);
    }
  }

  // Delete expense
  async findByIdAndDelete(id) {
    try {
      const expense = await this.findById(id);
      if (!expense) {
        return null;
      }

      await this.collection.doc(id).delete();
      return expense;
    } catch (error) {
      throw new Error(`Error deleting expense: ${error.message}`);
    }
  }

  // Get expenses by date range (user-specific)
  async getByDateRange(startDate, endDate, userId = null) {
    return await this.find({
      startDate,
      endDate,
      sortBy: 'date',
      sortOrder: 'desc'
    }, userId);
  }

  // Get weekly expenses
  async getWeeklyExpenses(startDate) {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    
    return await this.getByDateRange(startDate, endDate);
  }

  // Get category totals with aggregation
  async getCategoryTotals(startDate, endDate) {
    try {
      const expenses = await this.getByDateRange(startDate, endDate);

      const categoryMap = new Map();

      expenses.forEach(expense => {
        const category = expense.category || 'Other';
        if (categoryMap.has(category)) {
          const existing = categoryMap.get(category);
          categoryMap.set(category, {
            _id: category,
            total: existing.total + expense.amount,
            count: existing.count + 1,
            avgAmount: (existing.total + expense.amount) / (existing.count + 1)
          });
        } else {
          categoryMap.set(category, {
            _id: category,
            total: expense.amount,
            count: 1,
            avgAmount: expense.amount
          });
        }
      });

      return Array.from(categoryMap.values()).sort((a, b) => b.total - a.total);
    } catch (error) {
      throw new Error(`Error calculating category totals: ${error.message}`);
    }
  }

  // Get expenses grouped by date
  async getExpensesGroupedByDate(filters = {}, userId = null) {
    try {
      const expenses = await this.find(filters, userId);

      const groupedMap = new Map();

      expenses.forEach(expense => {
        // Convert Firestore timestamp to date string
        let dateKey;
        if (expense.date && expense.date._seconds) {
          dateKey = new Date(expense.date._seconds * 1000).toISOString().split('T')[0];
        } else if (expense.date) {
          dateKey = new Date(expense.date).toISOString().split('T')[0];
        } else {
          dateKey = 'unknown';
        }

        if (!groupedMap.has(dateKey)) {
          groupedMap.set(dateKey, {
            date: dateKey,
            expenses: [],
            totalAmount: 0,
            count: 0
          });
        }

        const group = groupedMap.get(dateKey);
        group.expenses.push(expense);
        group.totalAmount += expense.amount || 0;
        group.count += 1;
      });

      // Convert to array and sort by date (newest first)
      return Array.from(groupedMap.values()).sort((a, b) =>
        new Date(b.date) - new Date(a.date)
      );
    } catch (error) {
      throw new Error(`Error grouping expenses by date: ${error.message}`);
    }
  }

  // Count documents with filters
  async countDocuments(filters = {}) {
    try {
      const expenses = await this.find(filters);
      return expenses.length;
    } catch (error) {
      throw new Error(`Error counting expenses: ${error.message}`);
    }
  }

  // Auto-categorize expense based on description
  autoCategorizе(description) {
    const desc = description.toLowerCase();

    const categoryKeywords = {
      'Food': ['food', 'restaurant', 'grocery', 'coffee', 'lunch', 'dinner', 'breakfast', 'snack', 'pizza', 'burger', 'swiggy', 'zomato', 'dominos'],
      'Transportation': ['gas', 'fuel', 'uber', 'taxi', 'bus', 'train', 'parking', 'metro', 'transport', 'ola', 'auto', 'rickshaw', 'petrol'],
      'Entertainment': ['movie', 'cinema', 'game', 'concert', 'show', 'entertainment', 'netflix', 'spotify', 'amazon prime', 'hotstar'],
      'Shopping': ['shopping', 'clothes', 'amazon', 'store', 'mall', 'purchase', 'flipkart', 'myntra', 'ajio'],
      'Health': ['doctor', 'medicine', 'pharmacy', 'hospital', 'health', 'medical', 'dentist', 'apollo', 'medplus'],
      'Utilities': ['electricity', 'water', 'internet', 'phone', 'utility', 'bill', 'recharge', 'broadband', 'wifi'],
      'Education': ['book', 'course', 'school', 'education', 'tuition', 'learning', 'udemy', 'coursera']
    };

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => desc.includes(keyword))) {
        return category;
      }
    }

    return 'Other';
  }
}

// Export singleton instance
export default new ExpenseModel();
