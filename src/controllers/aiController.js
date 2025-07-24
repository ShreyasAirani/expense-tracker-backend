import { GoogleGenerativeAI } from '@google/generative-ai';
import { WeeklyAnalysis } from '../models/index.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const getAISuggestions = asyncHandler(async (req, res) => {
  const { analysisData } = req.body;

  if (!analysisData) {
    return res.status(400).json({
      success: false,
      message: 'Analysis data is required'
    });
  }
  
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      success: false,
      message: 'Gemini API key not configured'
    });
  }
  
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // Create a detailed prompt for Gemini
    const prompt = createPromptFromAnalysis(analysisData);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const suggestions = response.text();

    // Parse suggestions into array
    const suggestionsList = parseSuggestions(suggestions);
    
    // Update the weekly analysis with AI suggestions if it exists
    if (analysisData.weekStartDate) {
      await WeeklyAnalysis.findOneAndUpdate(
        { weekStartDate: new Date(analysisData.weekStartDate) },
        {
          aiSuggestions: {
            suggestions: suggestionsList,
            generatedAt: new Date(),
            prompt: prompt
          }
        }
      );
    }
    
    res.status(200).json({
      success: true,
      data: {
        suggestions: suggestionsList,
        rawResponse: suggestions,
        generatedAt: new Date()
      }
    });
    
  } catch (error) {
    console.error('❌ Gemini AI Error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });

    // Provide fallback suggestions if AI fails
    return sendFallbackSuggestions(res, analysisData);
  }
});

// Helper function to create prompt from analysis data
const createPromptFromAnalysis = (analysisData) => {
  const {
    totalAmount,
    totalExpenses,
    averageDailySpend,
    categoryBreakdown,
    insights
  } = analysisData;
  
  let prompt = `As a personal financial advisor familiar with Indian spending patterns, analyze this weekly spending data and provide 6-8 highly specific, actionable cost-cutting suggestions with exact rupee amounts and India-specific implementation steps:

WEEKLY SPENDING ANALYSIS (Indian Rupees):
- Total Amount Spent: ₹${totalAmount?.toFixed(2) || 0}
- Total Number of Expenses: ${totalExpenses || 0}
- Average Daily Spending: ₹${averageDailySpend?.toFixed(2) || 0}
- Spending Level Assessment: ${totalAmount > 8000 ? 'HIGH - Needs significant reduction' : totalAmount > 4000 ? 'MODERATE - Room for improvement' : 'CONTROLLED - Maintain or optimize'}
- Context: Indian urban/semi-urban lifestyle spending patterns
- Average Expense Amount: $${insights?.averageExpenseAmount?.toFixed(2) || 0}

SPENDING BY CATEGORY:`;

  if (categoryBreakdown && categoryBreakdown.length > 0) {
    categoryBreakdown.forEach(category => {
      prompt += `\n- ${category.category}: $${category.total.toFixed(2)} (${category.percentage.toFixed(1)}% of total, ${category.count} expenses)`;
    });
  }

  if (insights) {
    prompt += `\n\nKEY INSIGHTS:`;
    
    if (insights.highestSpendingDay) {
      prompt += `\n- Highest spending day: ${new Date(insights.highestSpendingDay.date).toLocaleDateString()} ($${insights.highestSpendingDay.amount.toFixed(2)})`;
    }
    
    if (insights.mostFrequentCategory) {
      prompt += `\n- Most frequent category: ${insights.mostFrequentCategory.category} (${insights.mostFrequentCategory.count} expenses)`;
    }
  }

  prompt += `\n\nProvide SPECIFIC, ACTIONABLE suggestions with exact rupee amounts and India-specific implementation steps. For each suggestion, include:
- Exact rupee amount that can be saved
- India-specific action steps (local alternatives, apps, services)
- Timeline for implementation
- Category-specific strategies relevant to Indian lifestyle

Focus on Indian context:
1. Immediate 20-30% reduction using Indian alternatives (local vendors, apps like Zomato/Swiggy alternatives, etc.)
2. Specific cost comparisons (street food vs restaurants, auto vs metro, local vs branded)
3. Daily spending limits in rupees with UPI/digital payment tracking
4. Indian-specific impulse purchase prevention (avoiding mall visits, online sale alerts)
5. Weekly budget allocation considering Indian salary cycles and expenses

Consider Indian lifestyle factors:
- Food: Home cooking vs ordering, local vendors vs restaurants, bulk buying from wholesale markets
- Transport: Auto/cab vs metro/bus, fuel costs, shared rides
- Entertainment: Free local events, parks, affordable alternatives to malls/movies
- Shopping: Local markets vs malls, seasonal sales, negotiation tips

Format as numbered list. Each suggestion must include specific rupee amounts, exact steps relevant to Indian context, and measurable outcomes.

Example format: "Reduce [category] spending by ₹X.XX by [India-specific action] instead of [current habit]. Implementation: [exact steps using Indian services/alternatives]. Expected weekly savings: ₹X.XX"`;

  return prompt;
};

// Helper function to parse AI suggestions into array
const parseSuggestions = (aiResponse) => {
  // Split by numbered list items and clean up
  const suggestions = aiResponse
    .split(/\d+\.\s+/)
    .filter(suggestion => suggestion.trim().length > 0)
    .map(suggestion => suggestion.trim().replace(/\n+/g, ' '))
    .slice(1); // Remove the first empty element
  
  return suggestions.length > 0 ? suggestions : [aiResponse.trim()];
};

export const getStoredAISuggestions = asyncHandler(async (req, res) => {
  const { weekStartDate } = req.params;
  
  const analysis = await WeeklyAnalysis.findByWeek(weekStartDate);
  
  if (!analysis) {
    return res.status(404).json({
      success: false,
      message: 'Weekly analysis not found'
    });
  }
  
  if (!analysis.aiSuggestions || !analysis.aiSuggestions.suggestions) {
    return res.status(404).json({
      success: false,
      message: 'AI suggestions not found for this week'
    });
  }
  
  res.status(200).json({
    success: true,
    data: analysis.aiSuggestions
  });
});

// Helper function to provide personalized suggestions when AI fails
const sendFallbackSuggestions = (res, analysisData) => {
  const { totalAmount, totalExpenses, categoryBreakdown, averageDailySpend } = analysisData;

  const suggestions = [];
  const weeklyTotal = totalAmount || 0;
  const dailyAvg = averageDailySpend || (weeklyTotal / 7);
  const expenseCount = totalExpenses || 0;

  // Analyze spending level and provide specific advice (Indian context)
  if (weeklyTotal > 8000) {
    suggestions.push(`Your weekly spending of ₹${weeklyTotal.toFixed(2)} is quite high for Indian standards. Try to reduce it by 20% (₹${(weeklyTotal * 0.2).toFixed(2)}) next week by avoiding restaurants and using local alternatives.`);
  } else if (weeklyTotal > 4000) {
    suggestions.push(`Your ₹${weeklyTotal.toFixed(2)} weekly spending is moderate. Aim to save ₹${(weeklyTotal * 0.15).toFixed(2)} (15%) by choosing street food over restaurants and using public transport.`);
  } else if (weeklyTotal > 2000) {
    suggestions.push(`Good job keeping spending to ₹${weeklyTotal.toFixed(2)} this week! Try to maintain this level or reduce by ₹${(weeklyTotal * 0.1).toFixed(2)} by cooking more at home.`);
  } else if (weeklyTotal > 500) {
    suggestions.push(`Excellent spending control at ₹${weeklyTotal.toFixed(2)} this week! This is very reasonable for Indian lifestyle. Focus on maintaining this disciplined approach.`);
  } else {
    suggestions.push(`Outstanding financial discipline at ₹${weeklyTotal.toFixed(2)} this week! You're managing expenses very well by Indian standards.`);
  }

  // Daily spending analysis (Indian context)
  if (dailyAvg > 1000) {
    suggestions.push(`Your daily average of ₹${dailyAvg.toFixed(2)} is high for Indian standards. Set a daily limit of ₹${(dailyAvg * 0.8).toFixed(2)} and use UPI apps to track each purchase.`);
  } else if (dailyAvg > 500) {
    suggestions.push(`With a ₹${dailyAvg.toFixed(2)} daily average, try implementing a ₹${(dailyAvg * 0.85).toFixed(2)} daily spending cap. Use apps like Paytm or GPay to monitor spending.`);
  } else if (dailyAvg > 200) {
    suggestions.push(`Your ₹${dailyAvg.toFixed(2)} daily average is reasonable. Consider setting aside the difference from a ₹400 daily budget for savings.`);
  } else {
    suggestions.push(`Excellent daily control at ₹${dailyAvg.toFixed(2)}! This is very good for Indian lifestyle. Focus on maintaining this discipline.`);
  }

  // Frequency analysis
  if (expenseCount > 10) {
    suggestions.push(`You made ${expenseCount} purchases this week. Try to consolidate trips and reduce to ${Math.max(7, expenseCount - 3)} purchases next week to avoid impulse buying.`);
  } else if (expenseCount > 5) {
    suggestions.push(`${expenseCount} purchases this week is reasonable. Plan your shopping to reduce this to ${expenseCount - 1} trips and save on transportation costs.`);
  } else if (expenseCount > 0) {
    suggestions.push(`Only ${expenseCount} purchases this week shows excellent planning! Maintain this disciplined approach to shopping.`);
  }

  // Category-specific detailed analysis
  if (categoryBreakdown && categoryBreakdown.length > 0) {
    categoryBreakdown.forEach((category, index) => {
      const amount = category.total || 0;
      const percentage = category.percentage || 0;
      const categoryName = category.category || 'Unknown';

      if (index === 0) { // Top spending category
        if (categoryName.toLowerCase().includes('food')) {
          suggestions.push(`Food expenses of ₹${amount.toFixed(2)} (${percentage.toFixed(1)}% of spending) can be reduced by cooking at home, buying from local vendors instead of restaurants, and shopping at wholesale markets. Target saving ₹${(amount * 0.25).toFixed(2)}.`);
        } else if (categoryName.toLowerCase().includes('transport')) {
          suggestions.push(`Transportation costs of ₹${amount.toFixed(2)} (${percentage.toFixed(1)}% of spending) could be lowered by using metro/bus instead of auto/cab, shared rides via Ola/Uber Share, or cycling for short distances. Aim to save ₹${(amount * 0.2).toFixed(2)}.`);
        } else if (categoryName.toLowerCase().includes('entertainment')) {
          suggestions.push(`Entertainment spending of ₹${amount.toFixed(2)} (${percentage.toFixed(1)}% of spending) offers easy savings. Visit free parks, local events, or use OTT platforms instead of cinema halls. Target ₹${(amount * 0.3).toFixed(2)} reduction.`);
        } else if (categoryName.toLowerCase().includes('shopping')) {
          suggestions.push(`Shopping expenses of ₹${amount.toFixed(2)} (${percentage.toFixed(1)}% of spending) suggest impulse purchases. Shop at local markets instead of malls, use price comparison apps, and avoid online sale notifications. Save ₹${(amount * 0.35).toFixed(2)}.`);
        } else {
          suggestions.push(`Your top category "${categoryName}" accounts for ₹${amount.toFixed(2)} (${percentage.toFixed(1)}% of spending). Research local alternatives, negotiate with vendors, and look for bulk discounts to save ₹${(amount * 0.2).toFixed(2)}.`);
        }
      } else if (index === 1 && amount > 500) { // Second highest category
        suggestions.push(`Your second-highest expense "${categoryName}" at ₹${amount.toFixed(2)} could be optimized. Look for local discounts, bulk buying from wholesale markets, or negotiate with regular vendors.`);
      }
    });
  }

  // Add specific actionable tips based on spending level (Indian context)
  if (weeklyTotal > 0) {
    suggestions.push(`Create a weekly budget of ₹${(weeklyTotal * 0.9).toFixed(2)} for next week and track every expense using UPI transaction history or expense tracking apps.`);
    suggestions.push(`Use the digital envelope method: Set spending limits in different UPI apps for each category (food, transport, etc.) and stop when limit is reached.`);
    suggestions.push(`Take advantage of Indian cost-saving opportunities: buy vegetables from local vendors in the evening for discounts, use BMTC/metro passes for transport, and cook in bulk to save on gas.`);
  }

  res.status(200).json({
    success: true,
    data: {
      suggestions: suggestions.slice(0, 7), // Limit to 7 most relevant suggestions
      generatedAt: new Date(),
      note: "Personalized recommendations based on your spending patterns."
    }
  });
};
