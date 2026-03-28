"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faPaperPlane } from "@fortawesome/free-solid-svg-icons";
import type { RecipeWithSlug } from "@/lib/recipes";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
  rawContent?: string;
};

function stripThinkTags(raw: string): { visible: string; stillThinking: boolean } {
  let text = raw;
  text = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  const openIdx = text.indexOf("<think>");
  if (openIdx !== -1) {
    text = text.slice(0, openIdx);
  }
  const visible = text.trim();
  return { visible, stillThinking: visible.length === 0 && raw.length > 0 };
}

function normalizePromptIngredientName(raw: string): string {
  return raw
    .replace(/\([^)]*\)/g, "")
    .split(",")[0]
    .replace(/\s+/g, " ")
    .trim();
}

function buildSystemPrompt(
  recipe: RecipeWithSlug,
  context: {
    timeAvailableMinutes: number;
    experienceLevel: string;
    checkedItems: Record<string, boolean>;
    substitutions: Record<string, string[]>;
  },
): string {
  const ingredientList =
    recipe.shorts_ingredients?.join(", ") ??
    recipe.ingredients.map((i) => i.item).join(", ");

  const stepsSummary = recipe.steps
    .slice()
    .sort((a, b) => a.step_number - b.step_number)
    .map((s) => `${s.step_number}. ${s.text}`)
    .join("\n");

  const userIngredientList = Object.entries(context.checkedItems)
    .filter(([, checked]) => checked)
    .map(([key]) => key.split(":")[1] ?? key)
    .map((name) => name.trim())
    .filter(Boolean);

  const userIngredientSet = new Set(
    userIngredientList.map((name) => name.toLocaleLowerCase()),
  );

  const rawRecipeIngredients =
    recipe.shorts_ingredients?.length
      ? recipe.shorts_ingredients
      : recipe.ingredients.map((i) => i.item);
  const recipeIngredients = Array.from(
    new Set(
      rawRecipeIngredients
        .map(normalizePromptIngredientName)
        .filter(Boolean),
    ),
  );

  const recipeHave = recipeIngredients.filter((name) =>
    userIngredientSet.has(name.toLocaleLowerCase()),
  );
  const recipeMissing = recipeIngredients.filter(
    (name) => !userIngredientSet.has(name.toLocaleLowerCase()),
  );

  const substitutionsByIngredient = new Map<string, string[]>();
  for (const [ingredient, subs] of Object.entries(context.substitutions)) {
    substitutionsByIngredient.set(ingredient.toLocaleLowerCase(), subs);
  }
  const availableSubstitutionsByMissing = new Map<string, string[]>();
  for (const ingredient of recipeMissing) {
    const subs = substitutionsByIngredient.get(ingredient.toLocaleLowerCase()) ?? [];
    const availableSubs = subs.filter((sub) =>
      userIngredientSet.has(sub.toLocaleLowerCase()),
    );
    if (availableSubs.length > 0) {
      availableSubstitutionsByMissing.set(ingredient, availableSubs);
    }
  }
  const subLines = recipeMissing.flatMap((ingredient) => {
    const availableSubs = availableSubstitutionsByMissing.get(ingredient) ?? [];
    return availableSubs.length > 0
      ? [`- ${ingredient} can be substituted with: ${availableSubs.join(", ")}`]
      : [];
  });
  const missingStatusLines = recipeMissing.map((ingredient) => {
    const availableSubs = availableSubstitutionsByMissing.get(ingredient) ?? [];
    return availableSubs.length > 0
      ? `- ${ingredient}: missing; listed substitutions: ${availableSubs.join(", ")}`
      : `- ${ingredient}: missing; listed substitutions: none available from user pantry`;
  });

  return [
    `You are a friendly, concise cooking assistant helping someone decide what to cook.`,
    ``,
    `RECIPE: ${recipe.title}`,
    `Author: ${recipe.author}`,
    `Servings: ${recipe.servings}`,
    `Total time: ${recipe.total_time_minutes} minutes`,
    ``,
    `Ingredients: ${ingredientList}`,
    ``,
    `Steps:\n${stepsSummary}`,
    ``,
    `USER CONTEXT:`,
    `- Available time: ${context.timeAvailableMinutes} minutes`,
    `- Experience level: ${context.experienceLevel}`,
    `- User ingredient list: ${userIngredientList.join(", ") || "none provided"}`,
    `- Recipe ingredients they have: ${recipeHave.join(", ") || "none"}`,
    `- Recipe ingredients missing: ${recipeMissing.join(", ") || "none"}`,
    ``,
    ...(missingStatusLines.length > 0
      ? [`MISSING INGREDIENT STATUS:`, ...missingStatusLines, ``]
      : []),
    ...(subLines.length > 0
      ? [`AVAILABLE SUBSTITUTIONS:`, ...subLines, ``]
      : []),
    `Answer questions about this recipe. Be encouraging and keep answers short unless asked for detail.`,
    `When the user asks if they can make/cook this recipe, first state the missing recipe ingredients from MISSING INGREDIENT STATUS (if any), then give your recommendation.`,
    `Use only substitutions listed in AVAILABLE SUBSTITUTIONS. Do not invent substitutions that are not listed.`,
    `If a missing ingredient has no listed substitution, say that clearly.`,
    `Never imply all ingredients are available when any item is listed as missing.`,
    `If the user asks whether they can make the recipe without a missing ingredient, answer directly (yes/no/depends) and briefly explain the tradeoff in taste/texture.`,
    `IMPORTANT: Do NOT wrap your response in <think> tags or show your reasoning process. Respond directly and concisely.`,
  ].join("\n");
}

export default function ChatPanel({
  recipe,
  selectedModel,
  checkedItems,
  timeAvailableMinutes,
  experienceLevel,
  substitutions,
  onClose,
}: {
  recipe: RecipeWithSlug;
  selectedModel: string;
  checkedItems: Record<string, boolean>;
  timeAvailableMinutes: number;
  experienceLevel: string;
  substitutions: Record<string, string[]>;
  onClose?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setMessages([
      {
        role: "assistant",
        content:
          "Hi, I am your personal cooking assistant! Please ask me for any help!",
      },
    ]);
  }, [recipe.slug]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom < 80) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, isThinking]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setIsStreaming(true);
    setIsThinking(true);

    const systemPrompt = buildSystemPrompt(recipe, {
      timeAvailableMinutes,
      experienceLevel,
      checkedItems,
      substitutions,
    });

    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...updatedMessages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const assistantIdx = updatedMessages.length;

    try {
      abortRef.current = new AbortController();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: selectedModel, messages: apiMessages }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "Request failed");
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${errText}` },
        ]);
        setIsStreaming(false);
        setIsThinking(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let rawAccumulated = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "", rawContent: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const chunk = JSON.parse(line) as {
              message?: { content?: string };
              done?: boolean;
            };
            const piece = chunk.message?.content ?? "";
            if (piece) {
              rawAccumulated += piece;
              const { visible, stillThinking } = stripThinkTags(rawAccumulated);
              setIsThinking(stillThinking);
              const snapshot = visible;
              const rawSnapshot = rawAccumulated;
              setMessages((prev) => {
                const copy = [...prev];
                copy[assistantIdx] = {
                  role: "assistant",
                  content: snapshot,
                  rawContent: rawSnapshot,
                };
                return copy;
              });
            }
          } catch {
            // skip malformed chunks
          }
        }
      }

      const { visible: finalVisible } = stripThinkTags(rawAccumulated);
      setMessages((prev) => {
        const copy = [...prev];
        copy[assistantIdx] = {
          role: "assistant",
          content: finalVisible || rawAccumulated,
          rawContent: rawAccumulated,
        };
        return copy;
      });
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Sorry, something went wrong." },
        ]);
      }
    } finally {
      setIsStreaming(false);
      setIsThinking(false);
      abortRef.current = null;
    }
  }, [input, isStreaming, messages, recipe, selectedModel, checkedItems, timeAvailableMinutes, experienceLevel, substitutions]);

  return (
    <div className="flex h-full w-full flex-col bg-neutral-950 text-white">
      <div className="shrink-0 border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold truncate">{recipe.title}</div>
          <div className="text-xs text-white/60 truncate">
            Cooking Assistant &middot; {selectedModel}
          </div>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Back to video"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="text-sm" />
          </button>
        ) : null}
      </div>

      <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg, i) =>
          msg.content ? (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-white/10 text-white/90"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ) : null,
        )}
        {isThinking ? (
          <div className="flex justify-start">
            <div className="rounded-2xl px-4 py-3 bg-white/10 flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="inline-block h-2 w-2 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="inline-block h-2 w-2 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-white/10 p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this recipe..."
            disabled={isStreaming}
            className="flex-1 rounded-xl bg-white/10 px-3.5 py-2.5 text-sm text-white placeholder-white/40 outline-none ring-1 ring-white/10 focus:ring-white/30 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40"
            aria-label="Send message"
          >
            <FontAwesomeIcon icon={faPaperPlane} className="text-sm" />
          </button>
        </form>
      </div>
    </div>
  );
}
