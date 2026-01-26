# LeadrsAgents

**Agent OS** - מערכת AI מרובת סוכנים לסוכנות שיווק.

## ארכיטקטורה

```
┌─────────────────────────────────────────────────────────────────┐
│                        Control Plane                            │
│  Event Bus → Job Queue → Intent Classifier → Planner → Policy  │
│                           ↓                                     │
│                     Orchestrator                                │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                       Knowledge Plane                           │
│  Retriever → Vector Store (pgvector) → Embedder → Chunker      │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                       Execution Plane                           │
│  Base Agent → Agent Registry → Specialist Agents (Layer 2)     │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                        Quality Plane                            │
│  Validation → Evaluator → (Auto-Fix) → Response Handler        │
└─────────────────────────────────────────────────────────────────┘
```

## התקנה

```bash
# Clone
cd leadrsagents

# Install dependencies
pnpm install

# Setup environment
cp env.template .env.local
# Edit .env.local with your keys

# Run migrations (in Supabase SQL Editor)
# Copy content from src/db/migrations/*.sql
```

## הגדרת סביבה

העתק את `env.template` ל-`.env.local` ומלא את המפתחות:

| משתנה | תיאור |
|-------|-------|
| `SUPABASE_URL` | URL של פרויקט Supabase |
| `SUPABASE_ANON_KEY` | Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key |
| `OPENAI_API_KEY` | OpenAI API key (GPT-5.2) |
| `GEMINI_API_KEY` | Google AI key (Gemini 3 Pro) |

## שימוש ב-CLI

```bash
# Run a request
pnpm cli run "תבנה לי אסטרטגיית מדיה ללקוח סיקרט"

# With debug info
pnpm cli run "מה הסטטוס של הדיל עם ABC?" --debug

# Explain a job
pnpm cli explain <job-id>

# Ingest knowledge from folder
pnpm cli ingest ./knowledge-base --client abc123 --tags "briefs,strategies"

# Test intent classification
pnpm cli test --intent
```

## סוכנים זמינים

### Layer 2 - Specialists

| ID | שם | תיאור |
|----|-----|-------|
| `media/strategy` | אסטרטגיית מדיה | בונה אסטרטגיות מדיה |
| `general/assistant` | עוזר כללי | עונה על שאלות כלליות |

## Iron Rules

1. **Knowledge-First**: Orchestrator לא משגר Agent בלי `knowledgePack.ready === true`
2. **No Hallucinations**: Agent חייב לציין אם אין מספיק מידע
3. **Quality Gate**: כל תוצר עובר Validation → Evaluation
4. **Auto-Fix Limit**: מקסימום 2 retries לפני `needs_human_review`

## מבנה תיקיות

```
src/
├── cli/                 # CLI commands
├── control/             # Control Plane
│   ├── event-bus.ts
│   ├── job-queue.ts
│   ├── intent-classifier.ts
│   ├── planner.ts
│   └── orchestrator.ts
├── knowledge/           # Knowledge Plane
│   ├── retriever.ts
│   ├── embedder.ts
│   ├── indexer.ts
│   └── chunker.ts
├── execution/           # Execution Plane
│   ├── base-agent.ts
│   ├── agent-registry.ts
│   └── agents/
├── quality/             # Quality Plane
│   ├── quality-gate.ts
│   ├── validation.agent.ts
│   └── evaluator.agent.ts
├── llm/                 # LLM Providers
│   ├── gemini.provider.ts
│   ├── openai.provider.ts
│   └── manager.ts
├── db/                  # Database
│   ├── client.ts
│   ├── repositories/
│   └── migrations/
├── response/            # Response formatting
├── types/               # TypeScript types
└── utils/               # Utilities
```

## LLM Roles

| Task Type | Primary | Fallback |
|-----------|---------|----------|
| Intent Classification | Gemini | OpenAI |
| Knowledge Analysis | Gemini | OpenAI |
| Strategy/Reasoning | Gemini | OpenAI |
| Email Writing | OpenAI | Gemini |
| Proposal Content | OpenAI | Gemini |
| User Response | OpenAI | Gemini |

## פיתוח

```bash
# Development mode
pnpm dev

# Type check
pnpm typecheck

# Build
pnpm build

# Test
pnpm test
```

## רישיון

Private - Leadrs

