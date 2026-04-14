import { z } from "zod";
import {
  animeRecommendations,
  GeminiRequest,
  IntentRequest,
  MessageSchema,
  userIntent,
} from "@/app/lib/gemini/gemini";
import { fetchAnimes, fetchGenres } from "@/app/lib/jikan/jikan";

// Validate the POST body at the boundary — request.json() returns `any`, so
// without this we'd be trusting the client's shape and length.
const BodySchema = z.object({
  message: z.string().min(1).max(2000),
});

export async function POST(request: Request) {
  // Parse + validate in one step. If the body is malformed JSON, request.json()
  // throws; if the shape is wrong, Zod throws. Either way it's a 400, not a 500.
  let message: string;
  try {
    const body = BodySchema.parse(await request.json());
    message = body.message;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Everything below can fail at an upstream boundary (Jikan, Gemini). Wrap
  // the whole pipeline once so callers get a clean 502 + a logged root cause,
  // instead of Next's default opaque 500.
  try {
    const genres = await fetchGenres();

    const intentRequest: IntentRequest = {
      user_input: message,
      genres: genres,
    };

    const intentMessage: MessageSchema = {
      role: "user",
      text: intentRequest,
    };

    const intent = await userIntent(intentMessage);

    // Guard an empty genre list before calling Jikan — an empty `genres=`
    // param would return unfiltered results, which isn't what the user asked
    // for. 422 = "your input was fine, but we couldn't map it to a result".
    if (intent.genre_mal_id.length === 0) {
      return Response.json(
        { error: "Could not match your request to any genres" },
        { status: 422 },
      );
    }

    const animes = await fetchAnimes(intent.genre_mal_id);

    // No candidates means the recommender has nothing to choose from. Skip the
    // second Gemini call — it would either fabricate titles or return empty.
    if (animes.length === 0) {
      return Response.json(
        { error: "No anime found for the selected genres" },
        { status: 404 },
      );
    }

    const suggestionRequest: GeminiRequest = {
      user_input: message,
      anime_suggestions: animes,
    };

    const recommendationMessage: MessageSchema = {
      role: "user",
      text: suggestionRequest,
    };

    const recommendations = await animeRecommendations(recommendationMessage);

    return Response.json(recommendations);
  } catch (err) {
    // Log the real error server-side so we can debug; return a generic message
    // to the client so we don't leak upstream details (API keys in URLs, etc.).
    console.error("chat route failed:", err);
    return Response.json(
      { error: "Recommendation service unavailable" },
      { status: 502 },
    );
  }
}
