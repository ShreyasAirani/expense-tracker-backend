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

  // Find analysis by week start date
  async findByWeek(weekStartDate) {
    try {
      const startDate = new Date(weekStartDate);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(startDate);
      endDate.setHours(23, 59, 59, 999);

      const snapshot = await this.collection
        .where('weekStartDate', '>=', startDate)
        .where('weekStartDate', '<=', endDate)
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
      throw new Error(`Error finding weekly analysis: ${error.message}`);
    }
  }

  // Find and update or create (upsert)
  async findOneAndUpdate(filter, updateData, options = {}) {
    try {
      const existing = await this.findByWeek(filter.weekStartDate);
      
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
        // Create new
        return await this.create(updateData);
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
