import express from 'express';
import {
  getWeeklyAnalysis,
  generateWeeklyAnalysis,
  getRecentAnalyses
} from '../controllers/analysisController.js';

const router = express.Router();

// Routes
router.route('/weekly')
  .get(getWeeklyAnalysis);

router.route('/weekly/generate')
  .post(generateWeeklyAnalysis);

router.route('/recent')
  .get(getRecentAnalyses);

export default router;
