import express from 'express';
import {
  getExpenses,
  getExpense,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseStats,
  getExpensesGroupedByDate,
  getAllExpenses
} from '../controllers/expenseController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication to all expense routes
router.use(authenticateToken);

// Protected routes (require authentication)
router.route('/')
  .get(getExpenses)
  .post(createExpense);

router.route('/stats')
  .get(getExpenseStats);

router.route('/grouped-by-date')
  .get(getExpensesGroupedByDate);

router.route('/all')
  .get(getAllExpenses);

router.route('/:id')
  .get(getExpense)
  .put(updateExpense)
  .delete(deleteExpense);

export default router;
