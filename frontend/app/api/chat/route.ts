import { NextRequest } from "next/server";

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { model, messages } = body as {
    model: string;
    messages: { role: string; content: string }[];
  };

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
