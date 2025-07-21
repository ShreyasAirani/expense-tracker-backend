import express from 'express';
import {
  getAISuggestions,
  getStoredAISuggestions
} from '../controllers/aiController.js';

const router = express.Router();

// Routes
router.route('/suggestions')
  .post(getAISuggestions);

router.route('/suggestions/:weekStartDate')
  .get(getStoredAISuggestions);

export default router;
