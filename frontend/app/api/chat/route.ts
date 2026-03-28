import { NextRequest } from "next/server";
import { appendFile, mkdir } from "fs/promises";
import { join } from "path";
import {
  isOllamaChatEnabled,
  OLLAMA_CHAT_DISABLED_MESSAGE,
} from "@/lib/ollama-chat-enabled";

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";
const PROMPT_LOG_DIR = join(process.cwd(), "logs");
const PROMPT_LOG_FILE = join(PROMPT_LOG_DIR, "chat-prompts.log");

async function logPrompt(model: string, messages: { role: string; content: string }[]) {
  const entry = {
    timestamp: new Date().toISOString(),
    model,
    messages,
  };

  try {
    await mkdir(PROMPT_LOG_DIR, { recursive: true });
    await appendFile(PROMPT_LOG_FILE, `${JSON.stringify(entry)}\n`, "utf8");
  } catch (error) {
    console.error("Failed to write prompt log:", error);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { model, messages } = body as {
    model: string;
    messages: { role: string; content: string }[];
  };

  if (!isOllamaChatEnabled()) {
    const encoder = new TextEncoder();
    const line =
      JSON.stringify({
        model: "unavailable",
        message: { role: "assistant", content: OLLAMA_CHAT_DISABLED_MESSAGE },
        done: true,
      }) + "\n";
    return new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(line));
        controller.close();
      },
    }), {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  await logPrompt(model, messages);

  const upstream = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: true }),
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "Ollama unreachable");
    return new Response(JSON.stringify({ error: text }), {
      status: upstream.status || 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
