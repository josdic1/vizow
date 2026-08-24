import { env } from "../env.js";

export type JourneySummaryAiResult = {
  summary: string;
  model: string;
};

export class JourneySummaryAiError extends Error {
  constructor(
    public readonly status: number,
    public readonly publicMessage: string,
  ) {
    super(publicMessage);
    this.name = "JourneySummaryAiError";
  }
}

function extractOpenAiOutputText(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  if (
    "output_text" in payload &&
    typeof payload.output_text === "string" &&
    payload.output_text.trim() !== ""
  ) {
    return payload.output_text.trim();
  }

  if (!("output" in payload) || !Array.isArray(payload.output)) {
    return null;
  }

  const textParts: string[] = [];

  for (const item of payload.output) {
    if (
      typeof item !== "object" ||
      item === null ||
      !("content" in item) ||
      !Array.isArray(item.content)
    ) {
      continue;
    }

    for (const part of item.content) {
      if (
        typeof part === "object" &&
        part !== null &&
        "type" in part &&
        part.type === "output_text" &&
        "text" in part &&
        typeof part.text === "string" &&
        part.text.trim() !== ""
      ) {
        textParts.push(part.text.trim());
      }
    }
  }

  return textParts.length > 0 ? textParts.join("\n").trim() : null;
}

async function generateWithOpenAi(
  prompt: string,
): Promise<JourneySummaryAiResult> {
  const apiKey = env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new JourneySummaryAiError(
      503,
      "AI summary is temporarily unavailable. Try again.",
    );
  }

  let openAiResponse: globalThis.Response;

  try {
    openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        input: prompt,
        max_output_tokens: 500,
        reasoning: {
          effort: "minimal",
        },
        text: {
          verbosity: "low",
        },
        store: false,
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    console.error("OpenAI Journey summary request failed:", error);
    throw new JourneySummaryAiError(
      503,
      "AI summary is temporarily unavailable. Try again.",
    );
  }

  if (!openAiResponse.ok) {
    const errorBody = await openAiResponse.text().catch(() => "");
    console.error(
      `OpenAI Journey summary request failed with HTTP ${openAiResponse.status}:`,
      errorBody.slice(0, 1_000),
    );
    throw new JourneySummaryAiError(
      openAiResponse.status === 429 ? 503 : 502,
      "AI summary is temporarily unavailable. Try again.",
    );
  }

  const payload: unknown = await openAiResponse.json();
  const summary = extractOpenAiOutputText(payload);

  if (!summary) {
    console.error("OpenAI Journey summary returned no output text.");
    throw new JourneySummaryAiError(
      502,
      "AI summary could not be generated. Try again.",
    );
  }

  return {
    summary,
    model: env.OPENAI_MODEL,
  };
}

async function generateWithOllama(
  prompt: string,
): Promise<JourneySummaryAiResult> {
  let ollamaResponse: globalThis.Response;

  try {
    ollamaResponse = await fetch(`${env.OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: env.OLLAMA_MODEL,
        prompt,
        think: false,
        stream: false,
        keep_alive: "10m",
        options: {
          num_predict: 220,
          temperature: 0.2,
        },
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new JourneySummaryAiError(
      503,
      "Local AI is unavailable. Make sure Ollama is running.",
    );
  }

  if (!ollamaResponse.ok) {
    throw new JourneySummaryAiError(
      503,
      "Local AI could not generate the Journey summary.",
    );
  }

  const payload: unknown = await ollamaResponse.json();

  if (
    typeof payload !== "object" ||
    payload === null ||
    !("response" in payload) ||
    typeof payload.response !== "string" ||
    payload.response.trim() === ""
  ) {
    throw new JourneySummaryAiError(
      502,
      "Local AI returned an invalid response.",
    );
  }

  return {
    summary: payload.response.trim(),
    model: env.OLLAMA_MODEL,
  };
}

export async function generateJourneySummary(
  prompt: string,
): Promise<JourneySummaryAiResult> {
  if (env.OPENAI_API_KEY) {
    return generateWithOpenAi(prompt);
  }

  return generateWithOllama(prompt);
}
