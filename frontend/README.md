# CS6750 Final Prototype — NYT Cooking Inspiration Feed

A short-form video feed prototype inspired by NYT Cooking, built with **Next.js**, **Tailwind CSS**, and **Ollama** for local AI chat assistance.

## Features

- **Short-form video feed** with vertical (9:16) auto-playing recipe videos
- **Two overlay modes**: Overlay 1 (NYT-style ingredient peek) and Overlay 2 (ingredient checklist with color-coded availability)
- **Compatibility sorting**: recipes are ranked by time fit, difficulty, and ingredient availability
- **Per-recipe AI chatbot**: swipe right on any video in Overlay 2 to chat with a local LLM about the recipe
- **Model selector**: choose from any locally installed Ollama model via the left panel dropdown

## Prerequisites

- **Node.js** 18+ and npm
- **Ollama** (for AI chat features)

## Getting Started

```bash
# 1. Clone the repository
git clone https://github.com/rafaelgan0/CS6750FinalProject.git
cd CS6750FinalProject

# 2. Install dependencies
cd frontend
npm install

# 3. Start the dev server
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

## Ollama Setup (AI Chat)

The AI chatbot uses [Ollama](https://ollama.ai) running locally on your machine.

### 1. Install Ollama

```bash
# macOS (Homebrew)
brew install ollama

# Or download from https://ollama.ai/download
```

### 2. Pull one or more models

```bash
ollama pull deepseek-r1
ollama pull llama3.2
ollama pull mistral
```

### 3. Start the Ollama server

```bash
ollama serve
```

Ollama listens on `http://127.0.0.1:11434` by default. The app proxies all chat requests through Next.js API routes, so no CORS configuration is needed.

### 4. Select your model

In the app's left panel, the **LLM Model** dropdown auto-detects all models available in your local Ollama installation. Pick any model to use for chat.

### Tested Models

| Model | Size | Notes |
|-------|------|-------|
| `deepseek-r1:latest` | 4.7 GB | Default; good reasoning for recipe questions |
| `deepseek-r1:1.5b` | 1.1 GB | Lighter variant |
| `llama3.2:latest` | 2.0 GB | Fast, general-purpose |
| `mistral:latest` | 4.1 GB | Strong conversational ability |
| `deepseek-coder-v2:latest` | 8.9 GB | Overkill for cooking, but works |
| `qwen2.5-coder:14b` | 9.0 GB | Large; not recommended unless you have plenty of RAM |

### Custom Ollama Host

If Ollama runs on a different host or port, set the `OLLAMA_HOST` environment variable:

```bash
OLLAMA_HOST=http://192.168.1.50:11434 npm run dev
```

## Project Structure

```
CS6750FinalProject/
├── recipes/                  # Recipe JSON files
├── frontend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/route.ts     # POST proxy → Ollama /api/chat (streaming)
│   │   │   └── models/route.ts   # GET proxy → Ollama /api/tags
│   │   ├── page.tsx              # Home page (loads feed)
│   │   └── recipe/[slug]/        # Individual recipe page
│   ├── components/inspiration/
│   │   ├── PrototypeShell.tsx    # Two-column layout, controls, sorting
│   │   ├── ShortsFeedItem.tsx    # Video card with overlays + swipe-to-chat
│   │   ├── ChatPanel.tsx         # Per-recipe AI chat UI
│   │   ├── SoundContext.tsx      # Global mute state
│   │   └── overlay2ChecklistData.ts
│   ├── lib/
│   │   ├── recipes.ts           # Recipe JSON loader
│   │   └── media.ts             # Media file mapping
│   └── public/
│       ├── images/              # Recipe thumbnail images
│       └── videos/              # Recipe video files
└── README.md
```

## Scripts

```bash
npm run dev       # Start development server
npm run build     # Production build
npm run lint      # Run ESLint
```
