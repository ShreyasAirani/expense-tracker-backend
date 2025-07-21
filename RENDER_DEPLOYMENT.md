# 🚀 Render Deployment Guide

Step-by-step guide to deploy your Expense Tracker backend on Render.

## 📋 Prerequisites

- GitHub repository with your backend code
- MongoDB Atlas database (or any MongoDB instance)
- Render account (free tier available)

## 🔧 Deployment Steps

### Step 1: Prepare Your Repository
Ensure your repository has:
- ✅ `package.json` with proper scripts
- ✅ `render.yaml` configuration file
- ✅ `.env.example` with all required variables

### Step 2: Connect to Render
1. **Sign up/Login** to [Render](https://render.com)
2. **Connect GitHub** account to Render
3. **Create New Web Service**
4. **Select Repository** - Choose your backend repository

### Step 3: Configure Service
Render will auto-detect your Node.js app, but verify:

**Build Settings:**
- **Build Command**: `npm install` (auto-detected)
- **Start Command**: `npm start` (auto-detected)
- **Node Version**: Latest (auto-detected)

**Advanced Settings:**
- **Health Check Path**: `/api/health`
- **Port**: `10000` (Render default)

### Step 4: Environment Variables
Add these in Render dashboard under "Environment":

#### Required Variables:
```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/expense-tracker
JWT_SECRET=your-super-secret-jwt-key-change-this
FRONTEND_URL=https://your-frontend-app.vercel.app
```

#### Optional Variables:
```env
GEMINI_API_KEY=your-gemini-api-key
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour-key\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your-email@project.iam.gserviceaccount.com
```

### Step 5: Deploy
1. **Click "Create Web Service"**
2. **Wait for Build** (usually 2-5 minutes)
3. **Check Logs** for any errors
4. **Test API** using the provided URL

## 🌐 Your API URL

After deployment, your API will be available at:
```
https://your-service-name.onrender.com
```

API endpoints will be:
```
https://your-service-name.onrender.com/api/auth/login
https://your-service-name.onrender.com/api/expenses
https://your-service-name.onrender.com/api/profile
```

## 🔄 Auto-Deployment

Render automatically deploys when you push to your main branch:
1. **Push code** to GitHub
2. **Render detects** changes
3. **Builds and deploys** automatically
4. **Zero downtime** deployment

## 🐛 Troubleshooting

### Common Issues:

#### Build Fails
- Check `package.json` has correct dependencies
- Ensure Node.js version compatibility
- Review build logs in Render dashboard

#### App Crashes
- Check environment variables are set correctly
- Verify MongoDB connection string
- Review application logs

#### CORS Errors
- Update `FRONTEND_URL` environment variable
- Ensure CORS middleware allows your frontend domain

#### Database Connection
- Verify MongoDB Atlas allows connections from anywhere (0.0.0.0/0)
- Check MongoDB URI format and credentials

### Debugging Commands:
```bash
# Check logs in Render dashboard
# Or use Render CLI:
render logs --service your-service-name

# Test API endpoints:
curl https://your-service-name.onrender.com/api/health
```

## 💰 Pricing

**Free Tier:**
- ✅ 750 hours/month (enough for personal projects)
- ✅ Auto-sleep after 15 minutes of inactivity
- ✅ Custom domains
- ✅ SSL certificates

**Paid Plans:**
- Always-on services (no sleep)
- More compute resources
- Priority support

## 🔒 Security Best Practices

1. **Environment Variables**: Never commit secrets to Git
2. **JWT Secret**: Use a strong, unique secret
3. **MongoDB**: Use MongoDB Atlas with proper authentication
4. **CORS**: Only allow your frontend domain
5. **Rate Limiting**: Already configured in your app

## 📊 Monitoring

Render provides:
- **Real-time logs**
- **Metrics dashboard**
- **Health checks**
- **Email alerts**

## 🚀 Next Steps

After successful deployment:
1. **Update Frontend**: Set `VITE_API_BASE_URL` to your Render URL
2. **Test Integration**: Verify frontend can connect to backend
3. **Monitor Performance**: Check logs and metrics
4. **Set up Alerts**: Configure notifications for downtime

## 📞 Support

- **Render Docs**: https://render.com/docs
- **Community**: https://community.render.com
- **Status Page**: https://status.render.com

Your backend is now live on Render! 🎉
