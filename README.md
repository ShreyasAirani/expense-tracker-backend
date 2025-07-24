# Expense Tracker Backend API

A secure, production-ready Node.js backend for expense tracking with Firebase Firestore, JWT authentication, and AI-powered insights.

## 🚀 Live Deployment

- **Backend API**: `https://expense-tracker-api.onrender.com`
- **Frontend**: `https://ezspend.vercel.app`
- **Database**: Firebase Firestore
- **Environment**: Production

## 🔒 Security Features

- **JWT Authentication**: All routes require valid authentication tokens
- **User Data Isolation**: Users can only access their own data
- **Input Validation**: Comprehensive validation with Joi
- **Rate Limiting**: Protection against API abuse
- **CORS Protection**: Configured for specific frontend domains
- **Environment Variables**: Secure credential management

## 📋 Prerequisites

- Node.js 18+ 
- Firebase project with Firestore enabled
- Gmail account for SMTP (optional)
- Gemini AI API key (optional)

## 🛠️ Installation & Setup

### 1. Clone Repository
```bash
git clone https://github.com/ShreyasAirani/expense-tracker-backend.git
cd expense-tracker-backend
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create `.env` file:
```env
# Server Configuration
NODE_ENV=development
PORT=5000
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# Frontend Configuration
FRONTEND_URL=http://localhost:3000

# Firebase Configuration
FIREBASE_PROJECT_ID=expense-tracker-7ca1a
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
# OR use individual keys:
# FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
# FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@expense-tracker-7ca1a.iam.gserviceaccount.com

# Optional: AI Service
GEMINI_API_KEY=your-gemini-api-key

# Optional: Email Service
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=your-email@gmail.com
```

### 4. Start Development Server
```bash
npm run dev
```

## 📁 Project Structure

```
src/
├── controllers/       # Request handlers
│   ├── authController.js
│   ├── expenseController.js
│   └── analysisController.js
├── models/            # Firestore models
│   ├── FirestoreUser.js
│   ├── FirestoreExpense.js
│   ├── FirestoreWeeklyAnalysis.js
│   └── index.js
├── routes/            # API routes (ALL PROTECTED)
│   ├── auth.js
│   ├── expenseRoutes.js
│   └── analysisRoutes.js
├── middleware/        # Custom middleware
│   ├── auth.js        # JWT authentication
│   ├── rateLimiter.js
│   └── validation.js
├── services/          # Business logic
│   ├── aiService.js
│   ├── emailService.js
│   └── schedulerService.js
├── utils/             # Utility functions
│   ├── asyncHandler.js
│   └── validators.js
└── config/            # Configuration files
    └── database.js    # Firestore configuration
```

## 🔐 Authentication System

### JWT Token Requirements
All API endpoints (except auth routes) require a valid JWT token in the Authorization header:

```javascript
headers: {
  'Authorization': 'Bearer YOUR_JWT_TOKEN',
  'Content-Type': 'application/json'
}
```

### Token Lifecycle
- **Expires**: 7 days
- **Refresh**: Login again to get new token
- **Storage**: Store securely in frontend (localStorage/sessionStorage)

## 📚 API Documentation

### Base URL
```
Production: https://expense-tracker-api.onrender.com
Development: http://localhost:5000
```

### Response Format
All API responses follow this structure:
```json
{
  "success": true|false,
  "data": {...},
  "message": "Success/Error message",
  "pagination": {...} // For paginated responses
}
```

### Error Responses
```json
{
  "success": false,
  "message": "Error description",
  "errors": [...] // Validation errors if applicable
}
```

## 🔓 Authentication Endpoints

### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_id",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "token": "jwt_token_here"
  },
  "message": "User registered successfully"
}
```

### Login User
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_id",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "token": "jwt_token_here"
  },
  "message": "Login successful"
}
```

## 💰 Expense Endpoints

> **🔒 All expense endpoints require authentication**

### Get All Expenses
```http
GET /api/expenses?page=1&limit=50&category=Food&startDate=2025-01-01&endDate=2025-01-31
Authorization: Bearer YOUR_JWT_TOKEN
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50)
- `category` (optional): Filter by category
- `startDate` (optional): Filter from date (YYYY-MM-DD)
- `endDate` (optional): Filter to date (YYYY-MM-DD)
- `sortBy` (optional): Sort field (default: 'date')
- `sortOrder` (optional): 'asc' or 'desc' (default: 'desc')

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "expense_id",
      "description": "Grocery shopping",
      "amount": 150.50,
      "category": "Food",
      "date": "2025-01-20T00:00:00.000Z",
      "userId": "user_id",
      "createdAt": "2025-01-20T10:30:00.000Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 250,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Get Single Expense
```http
GET /api/expenses/:id
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "expense_id",
    "description": "Grocery shopping",
    "amount": 150.50,
    "category": "Food",
    "date": "2025-01-20T00:00:00.000Z",
    "userId": "user_id",
    "createdAt": "2025-01-20T10:30:00.000Z"
  }
}
```

### Create Expense
```http
POST /api/expenses
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "description": "Grocery shopping",
  "amount": 150.50,
  "category": "Food",
  "date": "2025-01-20"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "new_expense_id",
    "description": "Grocery shopping",
    "amount": 150.50,
    "category": "Food",
    "date": "2025-01-20T00:00:00.000Z",
    "userId": "user_id",
    "createdAt": "2025-01-20T10:30:00.000Z"
  },
  "message": "Expense created successfully"
}
```

### Update Expense
```http
PUT /api/expenses/:id
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "description": "Updated description",
  "amount": 175.00,
  "category": "Food",
  "date": "2025-01-20"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "expense_id",
    "description": "Updated description",
    "amount": 175.00,
    "category": "Food",
    "date": "2025-01-20T00:00:00.000Z",
    "userId": "user_id",
    "updatedAt": "2025-01-20T11:00:00.000Z"
  },
  "message": "Expense updated successfully"
}
```

### Delete Expense
```http
DELETE /api/expenses/:id
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "success": true,
  "message": "Expense deleted successfully"
}
```

### Get Expenses Grouped by Date
```http
GET /api/expenses/grouped-by-date?startDate=2025-01-01&endDate=2025-01-31
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "success": true,
  "data": {
    "2025-01-20": [
      {
        "id": "expense_id",
        "description": "Grocery shopping",
        "amount": 150.50,
        "category": "Food"
      }
    ],
    "2025-01-19": [...]
  }
}
```

## 📊 Analysis Endpoints

> **🔒 All analysis endpoints require authentication**

### Get Weekly Analysis
```http
GET /api/analysis/weekly?startDate=2025-01-20
Authorization: Bearer YOUR_JWT_TOKEN
```

**Query Parameters:**
- `startDate` (required): Week start date (YYYY-MM-DD)

**Response:**
```json
{
  "success": true,
  "data": {
    "weekStartDate": "2025-01-20T00:00:00.000Z",
    "weekEndDate": "2025-01-26T23:59:59.999Z",
    "totalAmount": 1234.56,
    "totalExpenses": 15,
    "averageDailySpend": 176.37,
    "categoryBreakdown": [
      {
        "category": "Food",
        "amount": 450.00,
        "count": 8,
        "percentage": 36.5
      }
    ],
    "dailyTotals": [
      {
        "date": "2025-01-20",
        "amount": 150.50,
        "count": 3
      }
    ],
    "topExpenses": [
      {
        "id": "expense_id",
        "description": "Grocery shopping",
        "amount": 150.50,
        "category": "Food",
        "date": "2025-01-20"
      }
    ],
    "insights": {
      "spendingTrend": "increasing",
      "topCategory": "Food",
      "recommendations": [...]
    }
  }
}
```

### Generate Weekly Analysis
```http
POST /api/analysis/weekly/generate
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "startDate": "2025-01-20"
}
```

### Get Recent Analyses
```http
GET /api/analysis/recent?limit=10
Authorization: Bearer YOUR_JWT_TOKEN
```

## 🔧 Frontend Integration Guide

### 1. Authentication Setup

#### Store JWT Token
```javascript
// After successful login/register
const { token, user } = response.data;
localStorage.setItem('authToken', token);
localStorage.setItem('user', JSON.stringify(user));
```

#### Create API Client
```javascript
const API_BASE_URL = 'https://expense-tracker-api.onrender.com';

const apiClient = {
  get: async (endpoint, params = {}) => {
    const token = localStorage.getItem('authToken');
    const url = new URL(`${API_BASE_URL}${endpoint}`);
    Object.keys(params).forEach(key =>
      url.searchParams.append(key, params[key])
    );

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  post: async (endpoint, data) => {
    const token = localStorage.getItem('authToken');

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  put: async (endpoint, data) => {
    const token = localStorage.getItem('authToken');

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  delete: async (endpoint) => {
    const token = localStorage.getItem('authToken');

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }
};
```

#### Authentication Service
```javascript
const authService = {
  login: async (email, password) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (data.success) {
      localStorage.setItem('authToken', data.data.token);
      localStorage.setItem('user', JSON.stringify(data.data.user));
    }

    return data;
  },

  register: async (name, email, password) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await response.json();

    if (data.success) {
      localStorage.setItem('authToken', data.data.token);
      localStorage.setItem('user', JSON.stringify(data.data.user));
    }

    return data;
  },

  logout: () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  },

  isAuthenticated: () => {
    return !!localStorage.getItem('authToken');
  },

  getUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }
};
```

### 2. Expense Service
```javascript
const expenseService = {
  getExpenses: async (filters = {}) => {
    return apiClient.get('/api/expenses', filters);
  },

  getExpense: async (id) => {
    return apiClient.get(`/api/expenses/${id}`);
  },

  createExpense: async (expenseData) => {
    return apiClient.post('/api/expenses', expenseData);
  },

  updateExpense: async (id, expenseData) => {
    return apiClient.put(`/api/expenses/${id}`, expenseData);
  },

  deleteExpense: async (id) => {
    return apiClient.delete(`/api/expenses/${id}`);
  },

  getExpensesGroupedByDate: async (filters = {}) => {
    return apiClient.get('/api/expenses/grouped-by-date', filters);
  }
};
```

### 3. Analysis Service
```javascript
const analysisService = {
  getWeeklyAnalysis: async (startDate) => {
    return apiClient.get('/api/analysis/weekly', { startDate });
  },

  generateWeeklyAnalysis: async (startDate) => {
    return apiClient.post('/api/analysis/weekly/generate', { startDate });
  },

  getRecentAnalyses: async (limit = 10) => {
    return apiClient.get('/api/analysis/recent', { limit });
  }
};
```

### 4. Error Handling
```javascript
const handleApiError = (error) => {
  if (error.message.includes('401')) {
    // Token expired or invalid
    authService.logout();
    window.location.href = '/login';
  } else if (error.message.includes('403')) {
    // Access denied
    alert('Access denied. You can only access your own data.');
  } else if (error.message.includes('404')) {
    // Not found
    alert('Resource not found.');
  } else {
    // Other errors
    console.error('API Error:', error);
    alert('An error occurred. Please try again.');
  }
};

// Usage in components
try {
  const expenses = await expenseService.getExpenses();
} catch (error) {
  handleApiError(error);
}
```

### 5. Route Protection
```javascript
// React Router example
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
  const isAuthenticated = authService.isAuthenticated();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Usage
<Route path="/dashboard" element={
  <ProtectedRoute>
    <Dashboard />
  </ProtectedRoute>
} />
```

## 🚨 Important Security Notes

### For Frontend Developers

1. **Authentication Required**: All API calls (except login/register) must include JWT token
2. **Token Storage**: Store JWT securely, consider token expiration
3. **Error Handling**: Handle 401 (unauthorized) and 403 (forbidden) responses
4. **Data Isolation**: Users can only access their own data
5. **HTTPS Only**: Use HTTPS in production
6. **Input Validation**: Validate data on frontend before sending to API

### Breaking Changes from Previous Version

1. **Authentication Now Required**: All expense and analysis endpoints require authentication
2. **User Data Isolation**: API now filters all data by authenticated user
3. **New Error Responses**: 401/403 errors for authentication/authorization issues
4. **Token Required**: Must include `Authorization: Bearer TOKEN` header

## 📦 Key Dependencies

- `express` - Web framework
- `firebase-admin` - Firebase Admin SDK for Firestore
- `jsonwebtoken` - JWT implementation
- `bcryptjs` - Password hashing
- `joi` - Data validation
- `cors` - CORS middleware
- `dotenv` - Environment variables
- `nodemailer` - Email service
- `node-cron` - Scheduled tasks

## 🚀 Deployment

### Render Deployment
1. Connect GitHub repository
2. Set environment variables
3. Deploy automatically on push

### Environment Variables for Production
```env
NODE_ENV=production
JWT_SECRET=your-production-jwt-secret
FRONTEND_URL=https://ezspend.vercel.app
FIREBASE_PROJECT_ID=expense-tracker-7ca1a
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
GEMINI_API_KEY=your-gemini-api-key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=your-email@gmail.com
```

## 📞 Support

For issues or questions:
- Create an issue on GitHub
- Check the API logs in Render dashboard
- Verify authentication tokens are being sent correctly

## 📄 License

MIT License - see LICENSE file for details.
