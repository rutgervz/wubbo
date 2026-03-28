# CLAUDE.md — Wubbo Project Context

## Wat is Wubbo

Wubbo is de persoonlijke kennisbank van Rutger van Zuidam en Annelie (mede-eigenaar), gebouwd op Schiermonnikoog. Het is een levend kennissysteem dat al hun gesprekken (Claude chats van beiden), YouTube video's, documenten, artikelen, podcasts, notities samenbrengt in één doorzoekbare, visuele, interactieve kennisbank.

Vernoemd naar Wubbo Ockels (1946–2014) — de eerste Nederlander in de ruimte, Groninger, natuur- en wiskundige, pionier van duurzaamheid, schepper van de Ecolution. Wubbo Ockels was Rutgers allereerste klant (website voor de Wubbo Ockels Prijs Junior).

## Tech Stack

- **Frontend**: Next.js 15 (App Router, Edge Runtime)
- **Database**: Supabase (PostgreSQL + pgvector + RLS)
- **Embeddings**: Voyage AI voyage-3-lite (512 dimensies)
- **LLM**: Claude (Anthropic API) voor chat/RAG
- **Hosting**: Vercel (live op wubbo.vercel.app)
- **3D Visualisatie**: Three.js (force-directed graph met mycelium/lotus metafoor)

## Huidige Status — Wat Er Draait

### API Routes (werkend, live op Vercel)
- `POST /api/ingest` — Ingestion pipeline: tekst → chunks → Voyage AI embeddings → Supabase. Auto-tagging, content hash dedup, error recovery via status machine (processing → ready / quarantined / rejected)
- `POST /api/chat` — Server-side RAG: haalt automatisch context op via `search_chunks_with_context` RPC, streamt antwoord via SSE
- `POST /api/embed` — Voyage AI embedding proxy met in-memory cache
- `POST /api/debug-rag` — Debug route voor RAG pipeline testing (kan later weg)

### Database Schema (Supabase, live)
11 tabellen: `persons`, `sources`, `chunks`, `tags`, `source_tags`, `graph_nodes`, `graph_edges`, `source_nodes`, `publications`, `publication_sources`, `events`

Kernfeatures:
- **Append-only via database triggers** (niet alleen RLS): UPDATE op content en DELETE op sources/chunks/events geblokkeerd ongeacht rol
- **HNSW vector index** op chunks.embedding (vector(512))
- **Status machine** op sources: processing → ready / quarantined → approved / rejected
- **Persons tabel** met FK (niet hardcoded 'Rutger'/'Annelie' check)
- **Unified event log** (events + agent_actions samengevoegd)
- **publication_sources** join tabel (niet uuid array)
- **source_count** auto-update via trigger op source_nodes
- **content_hash** (sha256) voor semantische dedup
- **Parent-child context** in search: haalt vorige/volgende chunk op bij elke hit
- **SECURITY DEFINER** op search functies zodat server-side RAG werkt zonder auth.uid()

### Seed Data
- 16 graph nodes (Florida, Re-Creation, Regeneratief, Coöperatie, Schiermonnikoog, School, etc.)
- 19 graph edges (bevestigde verbanden)
- 15 tags
- 2 persons (Rutger, Annelie)
- 2 test bronnen met embeddings

### Environment Variables (Vercel + .env.local)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
VOYAGE_API_KEY
WEBHOOK_SECRET=wubbo-tothemoon-2026
```

## Wat Gebouwd Moet Worden

### 1. Frontend UI (PRIORITEIT — vandaag)
Er is geen `page.tsx` — de root URL geeft een 404. De volledige UI moet gebouwd worden:

**Three.js 3D Knowledge Graph** (prototype bestaat als `wubbo.jsx` artifact):
- Donker watervlak als bodem met organische mycelium-draden (CatmullRom curves)
- Bollen als "vruchten" die zweven op basis van verbindingsdichtheid
- Force-directed positioning: verbonden nodes clusteren
- Twee lotusbloemen (Rutger teal #5ABFBF, Annelie koraal #E8795D) als persoons-objecten
- Organische wortel-verbindingen van bollen naar lotussen
- Neon glow pulse op mycelium + wortels bij hover/klik
- Glow blijft aan na klik (selected state persists)
- Camera focust smooth op aangeklikt object
- Fullscreen toggle, drag-rotatie, scroll-zoom, auto-drift bij idle

**Stream View**: masonry cards met persoons-badges, type-iconen

**Claude Floating Panel**: context-aware suggesties, chat met RAG

**Zoeken + Filters**: hybride search (vector + full-text)

De graph data moet opgehaald worden via een API route die `graph_nodes` en `graph_edges` uit Supabase leest — vervang de hardcoded demo data.

### 2. Auth (inlogscherm Rutger + Annelie)
Supabase Auth, email login. Twee users bestaan al in Supabase Auth.

### 3. Chrome Extension (later)
Automatische sync van Claude chats naar Wubbo.

### 4. Claude Export Importer (later)
Bulk import van conversations.json.

### 5. Railway Agents (later)
Vier agents: research, monitor, verbinding, schrijf. Allen autonoom in privé, nooit publiceren zonder menselijke goedkeuring.

## Code Conventies

### Taal
- UI en comments: Nederlands
- Variabele namen en code: Engels
- Gebruik "graph" niet "graaf" overal in code, UI, en documentatie

### Stijl
- Nooit dash/hyphen bullets ('-') in teksten of UI copy
- Schrijfstijl: lively, direct, droog in de Jiskefet-traditie; nooit formeel of saai
- Dark theme: zwarte achtergrond met lumineuze accenten (teal, koraal, paars, groen)
- Graph is de default view, niet stream

### Rutger & Annelie
- Annelie = altijd "mede-eigenaar", nooit "manager"
- Beiden altijd samen genoemd als gelijkwaardige partners
- Spirituele dimensie van Re-Creation is het fundament, nooit marketing

### Naamgeving
- De app heet "Wubbo" — geen "Kennisbank" meer in de UI
- Rutgers volledige naam: Rutger van Zuidam
- Hanze University of Applied Sciences Groningen (niet "Hanzehogeschool")
- Natuurmuseum Friesland (niet "Fries Natuurmuseum")

## Projectstructuur

```
~/wubbo/
├── .env.local
├── .gitignore
├── next.config.js
├── package.json
├── tsconfig.json
├── README.md
├── supabase/
│   └── migrations/
│       └── 001_schema.sql          # Volledige v0.2 schema
└── src/
    ├── lib/
    │   ├── supabase.ts             # Browser + service client, types
    │   ├── ingestion.ts            # Pipeline: chunk → embed → store → tag
    │   └── search.ts               # Semantic, hybrid, graph queries, buildRAGContext
    └── app/
        └── api/
            ├── chat/route.ts       # Server-side RAG + Claude streaming
            ├── embed/route.ts      # Voyage AI proxy met cache
            ├── ingest/route.ts     # Webhook endpoint
            └── debug-rag/route.ts  # Debug route (kan weg)
```

## Supabase Project

- Project URL: https://eugpdscalxvxvquzhmre.supabase.co
- Rutger's user UUID: 12a4211a-91fb-4a72-8cb0-74f92692fced

## Belangrijke Architectuurbeslissingen

1. **Append-only is architecturaal**, niet alleen policy — database triggers blokkeren UPDATE/DELETE ongeacht rol
2. **Server-side RAG** — de chat route haalt zelf context op, de client hoeft het niet mee te sturen
3. **Voyage AI** boven OpenAI voor embeddings — betere kwaliteit, zelfde prijs, door Anthropic aanbevolen
4. **pgvector in Supabase** i.p.v. apart Qdrant — voldoende voor <5M vectors
5. **Edge Runtime** op alle API routes — geen Node.js crypto, gebruik Web Crypto API
6. **Schaduwgraph** — agent-suggesties (is_confirmed=false) apart van menselijke verbanden
7. **7-laags RAG context**: chunk retrieval met parent-child, graph-context, temporeel, contradictions, multi-perspective, densified summaries, open vragen
8. **match_threshold 0.3** in de chat RAG — met weinig data moet de drempel laag zijn

## Gerelateerde Concepten

- **Boerderij Florida**: inverted consumer coöperatie, 30-35 Jersey koeien, food forest, mestvergisting, NSW-landgoed
- **Re-Creation**: global brand en foundation, continue zelfvernieuwing (spiritueel, fysiek, mentaal-emotioneel)
- **Us Wente**: high-end intimate meeting location op Schiermonnikoog
- **Yn de Mande**: de basisschool op Schiermonnikoog
- **Berkenplas**: outdoor climbing park van Roland Sikkema
