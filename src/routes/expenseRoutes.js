import express from 'express';
import {
  getExpenses,
  getExpense,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseStats,
  getExpensesGroupedByDate
} from '../controllers/expenseController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Temporarily disable authentication for testing
// TODO: Re-enable authentication after implementing frontend auth
// router.use(authenticateToken);

// Routes (temporarily unprotected for testing)
router.route('/')
  .get(getExpenses)
  .post(createExpense);

router.route('/stats')
  .get(getExpenseStats);

router.route('/grouped-by-date')
  .get(getExpensesGroupedByDate);

router.route('/:id')
  .get(getExpense)
  .put(updateExpense)
  .delete(deleteExpense);

export default router;
