# Jarvis — Second Brain

Personal multimodal AI second brain. One search bar across all your life data.

## what this is

Semantic search over personal data (Notion, Gmail, Photos, Audio) using Google's
multimodal embedding model. Everything lands in the same vector space so you can
search across modalities with one query. Claude synthesizes an answer from retrieved
chunks. Eventually voice in + ElevenLabs voice out = Jarvis from Iron Man.

## stack

- React + TypeScript + Tailwind CSS (frontend)
- Electron (desktop app shell)
- FastAPI + Python (backend, runs on localhost:8000)
- Google Vertex AI multimodalembedding@001 (1408-dim vectors)
- Supabase pgvector (vector storage + search)
- Claude Sonnet (answer synthesis)

## running locally

```bash
# Terminal 1 — backend
cd ~/jarvis && uvicorn search:app --reload

# Terminal 2 — frontend + electron
npm run electron:dev
```

## current state

- Notion ingestion working (36 pages embedded)
- Search + synthesis working via FastAPI
- React UI running in browser, Electron not yet wired up
- Tailwind classes in place but glass effect not fully rendering yet

## next priorities

1. Get Electron working as a proper desktop app
2. Liquid glass UI — the key visual goal is macOS-native frosted glass that blurs
   whatever is behind the window (wallpaper, other apps). Like the screenshot in
   the repo. Use backdrop-filter: blur on panels over a transparent/vibrancy window.
3. Background gradient blobs so backdrop-blur has something to work with
4. Typography plugin for markdown rendering in answers
5. Then: Gmail, Calendar, Apple Notes ingestion
6. Then: macOS Photos (real multimodal)
7. Then: Voice I/O with ElevenLabs

## design direction

- Dark liquid glass — deep blacks, frosted panels, subtle borders
- Apple-coded aesthetic, not generic AI aesthetic
- The Electron window should use macOS vibrancy (NSVisualEffectView equivalent)
  so the glass effect blurs actual desktop content behind the window
- Reference: the first screenshot in our conversation (dark spotlight-style search
  with photo grid results and similarity scores)
- Simplicity is the ultimate sophistication

## key files

- src/App.tsx — root component, state management
- src/components/Sidebar.tsx — source filter sidebar
- src/components/SearchBar.tsx — search input + mic button
- src/components/AnswerPanel.tsx — synthesized answer + source cards
- src/components/SourceCard.tsx — individual result card
- src/components/RecentPanel.tsx — recent query history
- app/main.js — Electron main process
- search.py — FastAPI search endpoint
- ingest.py — data ingestion pipeline

## important notes

- Keep code simple with descriptive inline comments
- Never over-engineer
- The multimodal embedding model has a 1024 character limit per chunk
- Supabase RPC function match_memories handles cosine similarity search
- .env is gitignored — never commit it
- GCP auth via gcloud application-default login (no key file)

## Workflow Orchestration

### 1. Plan Node Default

- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately — don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Self-Improvement Loop

- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 3. Verification Before Done

- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 4. Demand Elegance (Balanced)

- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes — don't over-engineer
- Challenge your own work before presenting it

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.
