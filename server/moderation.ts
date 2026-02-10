import OpenAI from "openai";

const directOpenAI = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// Also try Replit AI integration as fallback
const replitOpenAI = (process.env.AI_INTEGRATIONS_OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL)
  ? new OpenAI({ apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY, baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL })
  : null;

export interface ModerationResult {
  flagged: boolean;
  categories: string[];
  message: string;
}

const SUPPORTIVE_MESSAGES: Record<string, string> = {
  hate: "This content contains language that may be hurtful to others. Retuned is about lifting yourself up — let's keep it positive.",
  "hate/threatening": "This content contains threatening language. Affirmations work best when they focus on growth and empowerment.",
  harassment: "This content could be seen as harassment. Let's redirect toward self-compassion and personal growth.",
  "harassment/threatening": "This content contains threatening language. Retuned is designed for positive self-empowerment.",
  "self-harm": "We care about your well-being. If you're struggling, please reach out to a crisis helpline. Affirmations should nurture and support you.",
  "self-harm/intent": "We care about your well-being. If you're struggling, please reach out to a crisis helpline (988 Suicide & Crisis Lifeline). Affirmations should nurture and support you.",
  "self-harm/instructions": "This content isn't appropriate for affirmations. If you're struggling, please reach out to a crisis helpline (988 Suicide & Crisis Lifeline).",
  sexual: "This content isn't aligned with Retuned's purpose. Let's focus on affirmations that empower your mind, body, and spirit.",
  "sexual/minors": "This content is not permitted. Retuned is designed for positive self-empowerment only.",
  violence: "This content contains violent language. Affirmations are most powerful when they focus on peace, strength, and growth.",
  "violence/graphic": "This content contains graphic violence and isn't appropriate for affirmations. Let's focus on healing and empowerment.",
};

const POLITICAL_MESSAGE = "Retuned is a space for personal growth, not politics. Affirmations work best when they focus on you — your mindset, your goals, your well-being.";

const DEFAULT_MESSAGE = "This content doesn't align with Retuned's purpose of positive self-empowerment. Please revise your text to focus on growth, healing, or well-being.";

export async function moderateContent(text: string): Promise<ModerationResult> {
  if (!text || text.trim().length === 0) {
    return { flagged: false, categories: [], message: "" };
  }

  const client = directOpenAI || replitOpenAI;
  if (!client) {
    console.warn("No OpenAI client available for content moderation — skipping check");
    return { flagged: false, categories: [], message: "" };
  }

  try {
    const response = await client.moderations.create({
      input: text,
      model: "omni-moderation-latest",
    });

    const result = response.results[0];
    if (!result.flagged) {
      return { flagged: false, categories: [], message: "" };
    }

    const flaggedCategories: string[] = [];
    const cats = result.categories as unknown as Record<string, boolean>;
    for (const [category, isFlagged] of Object.entries(cats)) {
      if (isFlagged) {
        flaggedCategories.push(category);
      }
    }

    // Pick the most relevant message for the first flagged category
    let message = DEFAULT_MESSAGE;
    for (const cat of flaggedCategories) {
      if (SUPPORTIVE_MESSAGES[cat]) {
        message = SUPPORTIVE_MESSAGES[cat];
        break;
      }
    }

    return { flagged: true, categories: flaggedCategories, message };
  } catch (error) {
    console.error("Content moderation API error:", error);
    // Fail open — don't block users if the API is down
    return { flagged: false, categories: [], message: "" };
  }
}

export async function moderateMultipleTexts(texts: string[]): Promise<ModerationResult> {
  const combined = texts.filter(t => t && t.trim()).join(" | ");
  return moderateContent(combined);
}

export async function validateAffirmationContent(text: string): Promise<ModerationResult> {
  if (!text || text.trim().length === 0) {
    return { flagged: false, categories: [], message: "" };
  }

  const moderationResult = await moderateContent(text);
  if (moderationResult.flagged) {
    return moderationResult;
  }

  const client = directOpenAI || replitOpenAI;
  if (!client) {
    console.warn("No OpenAI client available for affirmation validation — skipping check");
    return { flagged: false, categories: [], message: "" };
  }

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a content validator for a self-affirmation app called Retuned. Your job is to determine if user-written text is appropriate as a personal affirmation or goal.

ALLOW content that is:
- Positive self-talk, personal growth, or wellness goals
- Statements about health, confidence, relationships, career, spirituality
- Even if imperfect or casual in tone, as long as intent is self-improvement

REJECT content that is:
- Political in any way — mentions of politicians, political parties, elections, political movements, government policies, or political figures (e.g. "I love [any politician]", "I support [any party]"). This applies uniformly regardless of political affiliation or viewpoint.
- Harmful intentions toward others (robbery, violence, revenge, manipulation)
- Sexually explicit or crude/vulgar language
- Promoting illegal activities or substance abuse
- Nonsensical or trolling input with no self-improvement intent
- Negative self-talk disguised as affirmations (e.g. "I am worthless")

Respond with ONLY valid JSON: {"allowed": true} or {"allowed": false, "reason": "brief explanation"}`
        },
        {
          role: "user",
          content: text
        }
      ],
      temperature: 0,
      max_tokens: 80,
    });

    const content = response.choices[0]?.message?.content?.trim() || "";
    const jsonMatch = content.match(/\{.*\}/s);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.allowed === false) {
        const isPolitical = parsed.reason && /politic|politician|party|election|government/i.test(parsed.reason);
        return {
          flagged: true,
          categories: [isPolitical ? "political_content" : "affirmation_policy"],
          message: isPolitical
            ? POLITICAL_MESSAGE
            : parsed.reason
              ? `This doesn't seem like a positive affirmation. ${parsed.reason}. Try rephrasing to focus on what you want to attract into your life.`
              : DEFAULT_MESSAGE,
        };
      }
    }

    return { flagged: false, categories: [], message: "" };
  } catch (error) {
    console.error("Affirmation validation error:", error);
    return { flagged: false, categories: [], message: "" };
  }
}
