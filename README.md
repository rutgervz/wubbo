# Wubbo v0.2

De kennisbank van Rutger & Annelie. Gebouwd op Schiermonnikoog, gedreven door verbinding.

Wubbo bewaart alles wat jullie weten — gesprekken met Claude, video's, documenten, artikelen, notities — en maakt het doorzoekbaar, zichtbaar en bruikbaar. Met een 3D kennisgraaf, semantisch zoeken, vier autonome agents, en een publicatiepipeline naar de buitenwereld.

## Architectuur

```
Browser (Chrome ext) → Vercel (Next.js + API) → Supabase (Postgres + pgvector + Auth + Storage + Realtime)
                                                → Railway (Agents + Ingestion worker)
```

## Stack

| Laag | Technologie | Doel |
|------|-------------|------|
| Frontend | Next.js 15 + React 19 + Three.js | 3D kennisgraaf, stream, zoeken, Claude panel |
| API | Vercel Edge Functions | Zoek-endpoints, webhook ontvangst, Claude proxy |
| Database | Supabase PostgreSQL + pgvector | Metadata, vectoren, graafstructuur, event log |
| Auth | Supabase Auth | OAuth 2.0, MFA, RLS |
| Storage | Supabase Storage | Originele bestanden (PDF, audio, docs) |
| Realtime | Supabase Realtime | WebSocket push naar UI |
| Agents | Railway (FastAPI) | Research, monitor, verbindings-, schrijf-agent |
| Ingestion | Railway (Python worker) | Parse, chunk, tag, embed, store |

## Kosten

~$65/maand (Vercel Pro $20 + Supabase Pro $25 + Railway ~$20) + Claude API gebruik

## Setup

```bash
# 1. Clone en installeer
git clone <repo>
cd wubbo
npm install

# 2. Supabase project aanmaken
npx supabase init
npx supabase db push

# 3. Environment variables
cp .env.example .env.local
# Vul in: SUPABASE_URL, SUPABASE_ANON_KEY, ANTHROPIC_API_KEY

# 4. Lokaal draaien
npm run dev
```

## Principes

Wubbo is gebouwd op zes principes:

1. **Append-only** — Wubbo voegt toe, wijzigt nooit, verwijdert nooit
2. **Privé eerst** — niets gaat naar buiten zonder menselijke goedkeuring
3. **Twee lagen** — menselijke verbanden en agent-suggesties staan apart
4. **Alles is terug te draaien** — event sourcing + dagelijkse backups
5. **Agents zijn veilig** — sandbox, rate limits, quarantine
6. **De bron is heilig** — originele content is onveranderbaar
