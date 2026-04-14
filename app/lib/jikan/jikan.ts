import { z } from "zod";
import { cache } from "react";

export const AnimeGenreSchema = z.object({
  mal_id: z.number(),
  name: z.string(),
});

export type AnimeGenre = z.infer<typeof AnimeGenreSchema>;

// Flat shape used everywhere in the app: UI components, the Gemini response
// schema, and z.toJSONSchema() for Gemini's structured-output config.
// Must stay a plain ZodObject — transforms can't be represented in JSON Schema.
export const AnimeSchema = z.object({
  mal_id: z.number(),
  image_url: z.string(),
  title: z.string(),
  synopsis: z.string(),
  score: z.number(),
  rank: z.number(),
  status: z.string(),
});

export type Anime = z.infer<typeof AnimeSchema>;

// Jikan's raw /anime shape nests the image under images.jpg.image_url and
// leaves synopsis/score/rank nullable. Local to this module — we parse the
// real API shape, then .transform() into the flat Anime used elsewhere.
const JikanAnimeSchema = z
  .object({
    mal_id: z.number(),
    title: z.string(),
    synopsis: z.string().nullable(),
    score: z.number().nullable(),
    rank: z.number().nullable(),
    status: z.string(),
    images: z.object({
      jpg: z.object({
        image_url: z.string(),
      }),
    }),
  })
  .transform<Anime>((a) => ({
    mal_id: a.mal_id,
    title: a.title,
    synopsis: a.synopsis ?? "",
    score: a.score ?? 0,
    rank: a.rank ?? 0,
    status: a.status,
    image_url: a.images.jpg.image_url,
  }));

const JikanGenresSchema = z.object({
  data: z.array(AnimeGenreSchema),
});

const JikanAnimeListSchema = z.object({
  data: z.array(JikanAnimeSchema),
});

const BASE_URL = "https://api.jikan.moe/v4";

export const fetchGenres = cache(async (): Promise<AnimeGenre[]> => {
  const res = await fetch(`${BASE_URL}/genres/anime`);

  if (!res.ok) throw new Error(`Jikan /genres/anime failed: ${res.status}`);

  const data = await res.json();

  const result = JikanGenresSchema.safeParse(data);

  if (!result.success)
    throw new Error(`Invalid Jikan response: ${result.error.message}`);

  return result.data.data;
});

export async function fetchAnimes(genres: number[]): Promise<Anime[]> {
  const genreParam = [...genres].sort((a, b) => a - b).join(",");
  const params = new URLSearchParams({
    genres: genreParam,
    limit: "20",
    order_by: "score",
    sort: "desc",
  });

  const res = await fetch(`${BASE_URL}/anime?${params}`);

  if (!res.ok) throw new Error(`Jikan /anime?${params} failed: ${res.status}`);

  const data = await res.json();

  const result = JikanAnimeListSchema.safeParse(data);

  if (!result.success)
    throw new Error(`Invalid Jikan response: ${result.error.message}`);

  return result.data.data;
}
