"use client";

import { useState } from "react";
import type { GeminiResponse } from "./lib/gemini/gemini";

export default function Home() {
  const [value, setValue] = useState<string>("");
  const [response, setResponse] = useState<GeminiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Whether there's anything on screen worth clearing — drives the
  // Clear button's disabled state in the chat bar.
  const hasOutput = response !== null || error !== null;

  function handleClear() {
    setResponse(null);
    setError(null);
    setValue("");
  }

  async function handleSubmit() {
    // Snapshot the input, then clear the textarea immediately so the user
    // can see the request was accepted. We still send the snapshot — if we
    // referenced `value` after clearing, we'd send an empty string.
    const prompt = value;
    setValue("");
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Request failed: ${res.status}`);
      }

      const data: GeminiResponse = await res.json();
      setResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    // Full-height flex column: header + scrollable results + fixed-bottom input.
    <div className="flex min-h-screen flex-col bg-zinc-50 font-sans dark:bg-black">
      {/* Scrollable results area — bottom padding reserves space so the last
          card isn't hidden behind the fixed chat bar. */}
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 p-8 pb-48">
        <Hero compact={response !== null || loading} />

        {error && (
          <div className="rounded-md border border-red-400 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        {loading && <LoadingSkeleton />}

        {response && !loading && <Results data={response} />}

        {!response && !loading && !error && (
          <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
            Your recommendations will appear here.
          </div>
        )}
      </main>

      {/* Fixed chat bar. Backdrop blur + translucent bg so results peek through
          when scrolled underneath. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-zinc-50/90 backdrop-blur dark:border-zinc-800 dark:bg-black/80">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-2 p-4">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              // Cmd/Ctrl+Enter submits — common affordance for chat inputs.
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                handleSubmit();
              }
            }}
            placeholder="e.g. something cozy with good food and no fighting"
            rows={2}
            disabled={loading}
            className="w-full resize-none rounded-lg border border-zinc-300 bg-white p-3 text-sm text-black outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">
              {value.length} / 2000 · ⌘/Ctrl + Enter to send
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleClear}
                // Disabled when there's nothing on screen to wipe, so it
                // doesn't look like a live action when it would be a no-op.
                disabled={!hasOutput && value.length === 0}
                className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-opacity hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Clear
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || value.trim().length === 0}
                className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-40 dark:bg-white dark:text-black"
              >
                {loading ? "Thinking…" : "Get recommendations"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Hero section. Shrinks to a minimal header once results are on screen so
// the recommendations get most of the viewport. `compact` is true when
// loading or when a response exists.
function Hero({ compact }: { compact: boolean }) {
  if (compact) {
    return (
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Ani-Match
        </h1>
      </header>
    );
  }

  return (
    <header className="flex flex-col items-center gap-6 rounded-2xl border border-zinc-200 bg-linear-to-br from-white via-zinc-50 to-zinc-100 px-8 py-16 text-center dark:border-zinc-800 dark:from-zinc-950 dark:via-black dark:to-zinc-900">
      <span className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium uppercase tracking-wider text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
        AI-powered · Jikan + Gemini
      </span>
      <h1 className="max-w-2xl bg-linear-to-br from-black to-zinc-500 bg-clip-text text-5xl font-bold leading-tight tracking-tight text-transparent dark:from-zinc-50 dark:to-zinc-400 sm:text-6xl">
        Find your next anime in one sentence.
      </h1>
      <p className="max-w-xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
        Tell us the mood, the tone, a show you already love — we&apos;ll match
        it against MyAnimeList and hand back five picks with reasoning.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
        {[
          "cozy slice of life",
          "mecha with good politics",
          "something like Mushishi",
        ].map((ex) => (
          <span
            key={ex}
            className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400"
          >
            &ldquo;{ex}&rdquo;
          </span>
        ))}
      </div>
    </header>
  );
}

function Results({ data }: { data: GeminiResponse }) {
  return (
    <section className="flex flex-col gap-6">
      {data.chain_of_thought && (
        <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm leading-6 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Why these picks
          </p>
          {data.chain_of_thought}
        </div>
      )}

      {data.searched?.genre_names?.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-500">Matched genres:</span>
          {data.searched.genre_names.map((name) => (
            <span
              key={name}
              className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            >
              {name}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {data.recommendations.map((anime) => (
          <AnimeCard key={anime.mal_id} anime={anime} />
        ))}
      </div>
    </section>
  );
}

function AnimeCard({ anime }: { anime: GeminiResponse["recommendations"][number] }) {
  return (
    <article className="flex gap-4 overflow-hidden rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      {/* Plain <img> to avoid needing next.config remotePatterns for Jikan's CDN.
          Swap to next/image once the domain is whitelisted. */}
      {anime.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={anime.image_url}
          alt={anime.title}
          className="h-32 w-24 flex-shrink-0 rounded object-cover"
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-base font-semibold text-black dark:text-zinc-50">
            {anime.title}
          </h3>
          {anime.score > 0 && (
            <span className="flex-shrink-0 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
              ★ {anime.score.toFixed(2)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          {anime.rank > 0 && <span>#{anime.rank}</span>}
          <span>{anime.status}</span>
        </div>
        <p className="mt-1 line-clamp-4 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
          {anime.synopsis || "No synopsis available."}
        </p>
      </div>
    </article>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-20 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800"
          />
        ))}
      </div>
    </div>
  );
}
