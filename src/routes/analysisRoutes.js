import express from 'express';
import {
  getWeeklyAnalysis,
  generateWeeklyAnalysis,
  getRecentAnalyses
} from '../controllers/analysisController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication to all analysis routes
router.use(authenticateToken);

// Routes
router.route('/weekly')
  .get(getWeeklyAnalysis);

router.route('/weekly/generate')
  .post(generateWeeklyAnalysis);

router.route('/recent')
  .get(getRecentAnalyses);

export default router;
