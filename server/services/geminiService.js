const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Try these in order. "gemini-flash-latest" is Google's maintained alias for
// their current flash model, so this stays correct as they retire specific
// dated versions. The others are backups in case the primary is briefly
// overloaded (503) or unavailable in a given account/region.
const MODEL_CANDIDATES = ["gemini-flash-latest", "gemini-2.0-flash", "gemini-1.5-flash"];

const SYSTEM_INSTRUCTION =
  "You are FitTrack AI's in-app fitness assistant. Answer questions about workouts, " +
  "nutrition, recovery, and motivation clearly and concisely. Keep replies short and " +
  "practical (a few sentences or a short list), and add a brief safety note only when " +
  "genuinely relevant (e.g. injury, medical, or extreme diet questions). You are not a " +
  "doctor — for medical concerns, suggest seeing a professional.";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Matches Google's "temporarily overloaded / rate limited" style errors, which are worth retrying. */
const isRetryable = (err) => /503|overloaded|high demand|429|rate limit|unavailable/i.test(err?.message || "");

/**
 * Runs `task(modelName)` against each candidate model in order. Within a
 * model, retries once on a transient (503/429-style) error before moving on
 * to the next model. Throws the last error if every candidate fails.
 */
const withFallback = async (task) => {
  let lastError;
  for (const modelName of MODEL_CANDIDATES) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        return await task(modelName);
      } catch (err) {
        lastError = err;
        if (isRetryable(err) && attempt < 2) {
          await sleep(700 * attempt);
          continue;
        }
        break; // try the next model
      }
    }
  }
  console.error("Gemini request failed after trying all models:", lastError);
  throw new Error("The AI assistant is temporarily busy. Please try again in a moment.");
};

/**
 * Sends a one-shot prompt to Gemini and returns the raw text response,
 * automatically retrying/falling back across models on transient errors.
 */
const generateContent = (prompt) =>
  withFallback(async (modelName) => {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  });

/**
 * Builds a workout recommendation based on age, fitness goal, and experience level,
 * then returns Gemini's generated plan.
 */
const getWorkoutRecommendation = async ({ age, fitnessGoal, experienceLevel }) => {
  const prompt = `
You are a certified fitness coach AI. Based on the following user profile, generate a
personalized workout recommendation.

Age: ${age}
Fitness Goal: ${fitnessGoal}
Experience Level: ${experienceLevel}

Respond ONLY with a valid JSON object (no markdown, no code fences) in this exact shape:
{
  "weeklyPlan": ["Day 1: ...", "Day 2: ..."],
  "suggestedExercises": ["...", "..."],
  "trainingTips": ["...", "..."],
  "safetyRecommendations": ["...", "..."],
  "motivationalMessage": "..."
}
`;

  const raw = await generateContent(prompt);
  return safeParseJSON(raw);
};

/**
 * Builds a fitness insight summary based on aggregated workout statistics.
 */
const getFitnessInsights = async ({ totalWorkouts, averageDuration, totalCaloriesBurned }) => {
  const prompt = `
You are a fitness data analyst AI. Analyze the following workout statistics for a user
and generate a personalized fitness insight summary.

Total Workouts: ${totalWorkouts}
Average Workout Duration (minutes): ${averageDuration}
Total Calories Burned: ${totalCaloriesBurned}

Respond ONLY with a valid JSON object (no markdown, no code fences) in this exact shape:
{
  "performanceAnalysis": "...",
  "improvementSuggestions": ["...", "..."],
  "motivationalAdvice": "...",
  "fitnessProgressSummary": "..."
}
`;

  const raw = await generateContent(prompt);
  return safeParseJSON(raw);
};

/**
 * Gemini sometimes wraps JSON in markdown code fences; strip them before parsing.
 * Falls back to returning the raw text if parsing fails.
 */
const safeParseJSON = (text) => {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    return { raw: cleaned };
  }
};

/**
 * Conversational fitness chatbot. Keeps a short rolling history so replies
 * stay on-topic across turns, and returns plain text (not JSON).
 * `history` is an array of { role: "user" | "assistant", content: string }.
 * Also retries/falls back across models on transient errors.
 */
const chatWithCoach = ({ message, history = [] }) =>
  withFallback(async (modelName) => {
    const model = genAI.getGenerativeModel({ model: modelName, systemInstruction: SYSTEM_INSTRUCTION });

    // Gemini's chat API expects alternating user/model turns
    const chatHistory = history
      .slice(-10) // keep the last few turns so prompts stay small
      .map((turn) => ({
        role: turn.role === "assistant" ? "model" : "user",
        parts: [{ text: turn.content }],
      }));

    const chat = model.startChat({ history: chatHistory });
    const result = await chat.sendMessage(message);
    const response = await result.response;
    return response.text();
  });

module.exports = { getWorkoutRecommendation, getFitnessInsights, chatWithCoach };
