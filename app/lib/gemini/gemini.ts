import { array, z } from "zod";
import { AnimeGenreSchema, AnimeSchema } from "../jikan/jikan";
import { GoogleGenAI } from "@google/genai";
import {
  INTENT_SYSTEM_INSTRUCTION,
  RECOMMEND_SYSTEM_INSTRUCTION,
} from "./prompts";

export const GeminiUserIntentSchema = z.object({
  genre_mal_id: z.array(z.number()),
  genre_names: z.array(z.string()),
});

export type GeminiUserIntent = z.infer<typeof GeminiUserIntentSchema>;

export const GeminiResponseSchema = z.object({
  searched: GeminiUserIntentSchema,
  recommendations: z.array(AnimeSchema).max(5),
  chain_of_thought: z.string(),
});

export type GeminiResponse = z.infer<typeof GeminiResponseSchema>;

export const GeminiRequestSchema = z.object({
  user_input: z.string(),
  anime_suggestions: z.array(AnimeSchema).max(20),
});

export type GeminiRequest = z.infer<typeof GeminiRequestSchema>;

export const IntentRequestSchema = z.object({
  user_input: z.string(),
  genres: z.array(AnimeGenreSchema),
});

export type IntentRequest = z.infer<typeof IntentRequestSchema>;

export interface MessageSchema {
  role: "user" | "model";
  text:
    | GeminiUserIntent
    | GeminiResponse
    | string
    | GeminiRequest
    | IntentRequest;
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Gemini's `contents` field takes a string, Part[], or Content[] — not our
// MessageSchema shape. Structured payloads (IntentRequest, GeminiRequest)
// get stringified so they arrive as a single scalar text part, which the
// system instruction already tells the model to parse as JSON.
function serializeMessage(message: MessageSchema): string {
  return typeof message.text === "string"
    ? message.text
    : JSON.stringify(message.text);
}

export async function userIntent(message: MessageSchema) {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: serializeMessage(message),
    config: {
      systemInstruction: INTENT_SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseJsonSchema: z.toJSONSchema(GeminiUserIntentSchema),
    },
  });

  // 1. Model returned nothing usable (safety filter, empty candidate, etc.)
  const raw = response.text;
  if (!raw) {
    throw new Error("Gemini returned no text for userIntent");
  }

  // 2. Model ignored JSON mode and returned something unparseable
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(
      `Gemini returned non-JSON for userIntent: ${raw.slice(0, 200)}`,
    );
  }

  // 3. JSON parsed but doesn't match your Zod schema
  const result = GeminiUserIntentSchema.safeParse(json);
  if (!result.success) {
    throw new Error(`Invalid Gemini userIntent shape: ${result.error.message}`);
  }

  return result.data;
}

export async function animeRecommendations(message: MessageSchema) {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: serializeMessage(message),
    config: {
      systemInstruction: RECOMMEND_SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseJsonSchema: z.toJSONSchema(GeminiResponseSchema),
    },
  });

  // 1. Model returned nothing usable (safety filter, empty candidate, etc.)
  const raw = response.text;
  if (!raw) {
    throw new Error("Gemini returned no text for userIntent");
  }

  // 2. Model ignored JSON mode and returned something unparseable
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(
      `Gemini returned non-JSON for userIntent: ${raw.slice(0, 200)}`,
    );
  }

  // 3. JSON parsed but doesn't match your Zod schema
  const result = GeminiResponseSchema.safeParse(json);
  if (!result.success) {
    throw new Error(`Invalid Gemini userIntent shape: ${result.error.message}`);
  }

  return result.data;
}
