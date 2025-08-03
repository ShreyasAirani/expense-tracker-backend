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
      console.log('🔍 FirestoreExpense.find called with:', { filters, userId });
      
      let query = this.collection;

      // First, let's get ALL expenses to see what's in the database
      const allSnapshot = await this.collection.get();
      console.log('🔍 Total expenses in collection:', allSnapshot.size);
      
      // Log first few expenses to check their structure and count by user
      const sampleExpenses = [];
      const userCounts = {};
      allSnapshot.forEach((doc, index) => {
        const data = doc.data();

        // Count expenses per user
        if (data.userId) {
          userCounts[data.userId] = (userCounts[data.userId] || 0) + 1;
        }

        if (index < 5) {
          sampleExpenses.push({
            id: doc.id,
            userId: data.userId,
            description: data.description,
            amount: data.amount,
            date: data.date
          });
        }
      });
      console.log('🔍 Sample expenses from DB:', sampleExpenses);
      console.log('🔍 Expenses count by user:', userCounts);

      // Filter by user ID first (most important for multi-user)
      if (userId) {
        query = query.where('userId', '==', userId);
        console.log('🔍 Filtering by userId:', userId);
      }

      // Apply other filters
      if (filters.category) {
        query = query.where('category', '==', filters.category);
      }

      // Apply pagination at Firestore level for better performance
      if (filters.limit) {
        query = query.limit(parseInt(filters.limit));
      }

      if (filters.offset) {
        query = query.offset(parseInt(filters.offset));
      }

      const snapshot = await query.get();
      const expenses = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        const expenseData = {
          id: doc.id,
          ...data,
          // Ensure date is properly formatted
          date: data.date?.toDate ? data.date.toDate() : new Date(data.date),
          // Ensure amount is a number
          amount: typeof data.amount === 'number' ? data.amount : parseFloat(data.amount) || 0
        };
        expenses.push(expenseData);
      });

      console.log(`📊 Raw expenses from Firestore after userId filter (${expenses.length} items)`);

      // Apply client-side filtering
      let filteredExpenses = expenses;

      // Apply date range filter (client-side)
      if (filters.startDate && filters.endDate) {
        const startDate = new Date(filters.startDate);
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        
        filteredExpenses = filteredExpenses.filter(expense => {
          const expenseDate = new Date(expense.date);
          return expenseDate >= startDate && expenseDate <= endDate;
        });
        
        console.log(`📊 After date filter: ${filteredExpenses.length} items`);
      }

      // Apply client-side sorting
      const sortBy = filters.sortBy || 'date';
      const sortOrder = filters.sortOrder === 'asc' ? 'asc' : 'desc';

      filteredExpenses.sort((a, b) => {
        let aValue = a[sortBy];
        let bValue = b[sortBy];

        if (sortBy === 'date') {
          aValue = new Date(aValue);
          bValue = new Date(bValue);
        }

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
        }

        if (sortOrder === 'asc') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });

      console.log(`📊 Final filtered expenses: ${filteredExpenses.length} items`);

      return filteredExpenses;
    } catch (error) {
      console.error('Error in find method:', error);
      throw new Error(`Error fetching expenses: ${error.message}`);
    }
  }

  // Get expense by ID (with optional user verification)
  async findById(id, userId = null) {
    try {
      const doc = await this.collection.doc(id).get();

      if (!doc.exists) {
        return null;
      }

      const expense = {
        id: doc.id,
        ...doc.data()
      };

      // If userId is provided, verify ownership
      if (userId && expense.userId !== userId) {
        return null; // Return null if expense doesn't belong to user
      }

      return expense;
    } catch (error) {
      throw new Error(`Error fetching expense: ${error.message}`);
    }
  }

  // Update expense (with user verification)
  async findByIdAndUpdate(id, updateData, userId = null) {
    try {
      // First verify the expense exists and belongs to user
      const existingExpense = await this.findById(id, userId);
      if (!existingExpense) {
        return null; // Expense not found or doesn't belong to user
      }

      const updatePayload = {
        ...updateData,
        updatedAt: FieldValue.serverTimestamp()
      };

      await this.collection.doc(id).update(updatePayload);

      // Return updated document
      return await this.findById(id, userId);
    } catch (error) {
      throw new Error(`Error updating expense: ${error.message}`);
    }
  }

  // Delete expense (with user verification)
  async findByIdAndDelete(id, userId = null) {
    try {
      const expense = await this.findById(id, userId);
      if (!expense) {
        return null; // Expense not found or doesn't belong to user
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

  // Get category totals with aggregation (user-specific)
  async getCategoryTotals(startDate, endDate, userId = null) {
    try {
      const expenses = await this.getByDateRange(startDate, endDate, userId);

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
        let dateKey;
        try {
          const expenseDate = expense.date instanceof Date ? expense.date : new Date(expense.date);
          dateKey = expenseDate.toISOString().split('T')[0];
        } catch (error) {
          console.warn('Invalid date for expense:', expense.id, expense.date);
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
      console.error('Error in getExpensesGroupedByDate:', error);
      throw new Error(`Error grouping expenses by date: ${error.message}`);
    }
  }

  // Count documents with filters
  async countDocuments(filters = {}, userId = null) {
    try {
      const expenses = await this.find(filters, userId);
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
