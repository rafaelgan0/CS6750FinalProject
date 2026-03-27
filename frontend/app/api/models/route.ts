const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";

type OllamaModel = { name: string; model: string; size: number };

export async function GET() {
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, { cache: "no-store" });
    if (!res.ok) {
      return Response.json({ models: [] }, { status: 200 });
    }
    const data = (await res.json()) as { models?: OllamaModel[] };
    const names = (data.models ?? []).map((m) => m.name);
    return Response.json({ models: names });
  } catch {
    return Response.json({ models: [] }, { status: 200 });
  }
}
