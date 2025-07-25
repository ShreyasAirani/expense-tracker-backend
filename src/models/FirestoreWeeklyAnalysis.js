import { db } from '../config/database.js';
import { FieldValue } from 'firebase-admin/firestore';

class WeeklyAnalysisModel {
  constructor() {
    this.collection = db.collection('weeklyAnalyses');
  }

  // Create or update weekly analysis
  async create(analysisData) {
    try {
      const analysis = {
        ...analysisData,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };

      const docRef = await this.collection.add(analysis);
      const doc = await docRef.get();
      
      return {
        id: doc.id,
        ...doc.data()
      };
    } catch (error) {
      throw new Error(`Error creating weekly analysis: ${error.message}`);
    }
  }

  // Find analysis by week start date and user ID
  async findByWeek(weekStartDate, userId = null) {
    try {
      const startDate = new Date(weekStartDate);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(startDate);
      endDate.setHours(23, 59, 59, 999);

      console.log('🔍 WeeklyAnalysis: Looking for analysis with userId:', userId, 'and date range:', startDate, 'to', endDate);

      // First query by userId to avoid composite index requirement
      let query = this.collection;

      if (userId) {
        query = query.where('userId', '==', userId);
        console.log('🔍 WeeklyAnalysis: Filtering by userId:', userId);
      }

      const snapshot = await query.get();
      console.log('🔍 WeeklyAnalysis: Found', snapshot.size, 'analysis documents for user');

      // Filter by date range in memory to avoid composite index
      const matchingDocs = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        const docDate = data.weekStartDate?.toDate ? data.weekStartDate.toDate() : new Date(data.weekStartDate);

        console.log('🔍 WeeklyAnalysis: Checking doc', doc.id, 'with userId:', data.userId, 'and date:', docDate);

        if (docDate >= startDate && docDate <= endDate) {
          console.log('✅ WeeklyAnalysis: Date matches! Adding to results');
          matchingDocs.push({
            id: doc.id,
            ...data
          });
        } else {
          console.log('❌ WeeklyAnalysis: Date does not match');
        }
      });

      const result = matchingDocs.length > 0 ? matchingDocs[0] : null;
      console.log('🔍 WeeklyAnalysis: Final result:', result ? `Found analysis with userId: ${result.userId}, total: ${result.totalAmount}` : 'No matching analysis found');

      return result;
    } catch (error) {
      throw new Error(`Error finding weekly analysis: ${error.message}`);
    }
  }

  // Find and update or create (upsert) - user-specific
  async findOneAndUpdate(filter, updateData, options = {}) {
    try {
      // Pass userId to findByWeek for user-specific lookup
      const existing = await this.findByWeek(filter.weekStartDate, filter.userId);

      if (existing) {
        // Update existing
        const updatePayload = {
          ...updateData,
          updatedAt: FieldValue.serverTimestamp()
        };

        await this.collection.doc(existing.id).update(updatePayload);

        // Return updated document
        const updatedDoc = await this.collection.doc(existing.id).get();
        return {
          id: updatedDoc.id,
          ...updatedDoc.data()
        };
      } else if (options.upsert) {
        // Create new - ensure userId is included
        const createData = {
          ...updateData,
          userId: filter.userId || updateData.userId
        };
        return await this.create(createData);
      }

      return null;
    } catch (error) {
      throw new Error(`Error upserting weekly analysis: ${error.message}`);
    }
  }

  // Get recent analyses
  async getRecentAnalyses(limit = 10) {
    try {
      const snapshot = await this.collection
        .orderBy('weekStartDate', 'desc')
        .limit(limit)
        .get();

      const analyses = [];
      snapshot.forEach(doc => {
        analyses.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return analyses;
    } catch (error) {
      throw new Error(`Error fetching recent analyses: ${error.message}`);
    }
  }

  // Update AI suggestions for a specific analysis
  async updateAISuggestions(weekStartDate, suggestions) {
    try {
      const analysis = await this.findByWeek(weekStartDate);
      
      if (!analysis) {
        throw new Error('Weekly analysis not found');
      }

      const updateData = {
        aiSuggestions: {
          suggestions: suggestions.suggestions || suggestions,
          generatedAt: new Date(),
          prompt: suggestions.prompt || ''
        },
        updatedAt: FieldValue.serverTimestamp()
      };

      await this.collection.doc(analysis.id).update(updateData);
      
      return await this.collection.doc(analysis.id).get().then(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      throw new Error(`Error updating AI suggestions: ${error.message}`);
    }
  }

  // Delete analysis
  async findByIdAndDelete(id) {
    try {
      const doc = await this.collection.doc(id).get();
      
      if (!doc.exists) {
        return null;
      }

      const analysis = {
        id: doc.id,
        ...doc.data()
      };

      await this.collection.doc(id).delete();
      return analysis;
    } catch (error) {
      throw new Error(`Error deleting weekly analysis: ${error.message}`);
    }
  }
}

// Export singleton instance
export default new WeeklyAnalysisModel();
