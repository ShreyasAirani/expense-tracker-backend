# Expense Tracker Backend

Node.js/Express API backend for the Expense Tracker application.

## 🚀 Tech Stack

- **Node.js** - Runtime Environment
- **Express.js** - Web Framework
- **MongoDB** - Database
- **Mongoose** - ODM
- **JWT** - Authentication
- **Bcrypt** - Password Hashing
- **Joi** - Validation
- **CORS** - Cross-Origin Resource Sharing

## 📁 Project Structure

```
src/
├── controllers/        # Route handlers
│   ├── authController.js
│   ├── expenseController.js
│   ├── profileController.js
│   └── analysisController.js
├── models/            # Firestore models
│   ├── FirestoreUser.js
│   ├── FirestoreExpense.js
│   ├── FirestoreWeeklyAnalysis.js
│   └── index.js
├── routes/            # API routes
│   ├── authRoutes.js
│   ├── expenseRoutes.js
│   ├── profileRoutes.js
│   └── analysisRoutes.js
├── middleware/        # Custom middleware
│   ├── auth.js
│   ├── errorHandler.js
│   └── validation.js
├── services/          # Business logic
│   ├── authService.js
│   ├── expenseService.js
│   └── aiService.js
└── config/            # Configuration files
    └── database.js        # Firestore configuration
```

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+
- MongoDB Atlas account (or local MongoDB)
- npm or yarn

### Installation
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start production server
npm start
```

## 🌐 Environment Variables

Create a `.env` file in the root directory:

```env
# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/expense-tracker

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# Server
PORT=5000
NODE_ENV=development

# CORS
FRONTEND_URL=http://localhost:3000

# AI Service (Optional)
GEMINI_API_KEY=your-gemini-api-key

# Firebase (if using Firestore)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email
```

## 🚀 Deployment

### Render (Recommended)
1. **Connect Repository**: Link your GitHub repository to Render
2. **Auto-Detection**: Render will automatically detect Node.js
3. **Configuration**: Uses `render.yaml` for deployment settings
4. **Environment Variables**: Add in Render dashboard:
   - `MONGODB_URI` - Your MongoDB connection string
   - `JWT_SECRET` - Your JWT secret key
   - `FRONTEND_URL` - Your frontend URL
   - `GEMINI_API_KEY` - Your Gemini API key (optional)
5. **Auto-Deploy**: Automatic deployments from main branch

### Alternative Options

#### Railway
1. Connect your GitHub repository to Railway
2. Add environment variables in Railway dashboard
3. Railway will automatically detect Node.js and deploy

#### Heroku
1. Connect your GitHub repository to Heroku
2. Add environment variables in Heroku dashboard
3. Heroku will automatically detect Node.js and deploy

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Expenses
- `GET /api/expenses` - Get all expenses
- `POST /api/expenses` - Create new expense
- `GET /api/expenses/:id` - Get expense by ID
- `PUT /api/expenses/:id` - Update expense
- `DELETE /api/expenses/:id` - Delete expense

### Profile
- `GET /api/profile` - Get user profile
- `PUT /api/profile` - Update user profile

### Analysis
- `GET /api/analysis/weekly` - Get weekly analysis
- `POST /api/ai/suggestions` - Get AI suggestions

## 🔧 Available Scripts

- `npm run dev` - Start development server with nodemon
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm test` - Run tests

## 📦 Key Dependencies

- `express` - Web framework
- `mongoose` - MongoDB ODM
- `jsonwebtoken` - JWT implementation
- `bcryptjs` - Password hashing
- `joi` - Data validation
- `cors` - CORS middleware
- `dotenv` - Environment variables

## 🔒 Security Features

- **JWT Authentication** - Secure token-based auth
- **Password Hashing** - Bcrypt for password security
- **Input Validation** - Joi schema validation
- **CORS Protection** - Configured for specific origins
- **Error Handling** - Comprehensive error middleware

## 🗄️ Database Schema

### User Model
```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  preferences: {
    currency: String,
    dateFormat: String,
    categories: [String]
  },
  createdAt: Date,
  updatedAt: Date
}
```

### Expense Model
```javascript
{
  userId: ObjectId,
  amount: Number,
  description: String,
  category: String,
  date: Date,
  notes: String,
  paymentMethod: String,
  createdAt: Date,
  updatedAt: Date
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.
