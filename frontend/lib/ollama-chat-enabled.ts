/**
 * Ollama chat is off on Vercel by default (no local daemon). Set
 * OLLAMA_CHAT_ENABLED=true and OLLAMA_HOST to a reachable server to enable.
 * Locally, chat stays on unless OLLAMA_CHAT_ENABLED=false.
 */
export function isOllamaChatEnabled(): boolean {
  const v = process.env.OLLAMA_CHAT_ENABLED;
  if (v === "false" || v === "0") return false;
  if (v === "true" || v === "1") return true;
  if (process.env.VERCEL === "1") return false;
  return true;
}

export const OLLAMA_CHAT_DISABLED_MESSAGE =
  "Sorry, the AI assistant is not available in this deployment. Clone the repo, install Ollama, and run the app locally to use chat.";
