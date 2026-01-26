# Autonomous AI Orchestration Engine

מערכת תזמור אוטונומית מתקדמת עם יכולות AI מלאות.

## 🚀 תכונות מרכזיות

### Core Features
- ✅ **Master Orchestrator** - מתזמר ראשי לניהול ביצועים
- ✅ **LLM Planner** - תכנון מבוסס AI מבקשות טבעיות
- ✅ **Parallel Execution** - ריצה מקבילית של צעדים עצמאיים
- ✅ **Error Recovery** - התאוששות אוטומטית מכשלים
- ✅ **State Persistence** - שמירת מצב והמשכיות

### Intelligence Layer
- ✅ **Tool Discovery** - סריקה דינמית של סוכנים ואינטגרציות
- ✅ **Agent Registry** - מרכז ידע על יכולות סוכנים
- ✅ **Learning Engine** - למידה מביצועים קודמים
- ✅ **Smart Caching** - שמירת תוצאות עם חיפוש סמנטי

### Communication
- ✅ **Shared Context** - זיכרון משותף בין סוכנים
- ✅ **Agent Messenger** - תקשורת בין-סוכנית
- ✅ **Real-time Streaming** - SSE עבור עדכונים חיים

### Safety & Control
- ✅ **HITL Gates** - נקודות אישור למשתמש
- ✅ **Conflict Resolver** - פתרון קונפליקטים
- ✅ **Rate Limiter** - ניהול מכסות API
- ✅ **Resource Locks** - נעילת משאבים

### Observability
- ✅ **Distributed Tracing** - מעקב אחר spans
- ✅ **Metrics Collection** - איסוף מטריקות
- ✅ **Log Aggregation** - ריכוז לוגים

## 📁 מבנה התיקיות

```
src/
├── orchestration/
│   ├── master-orchestrator.ts      # מתזמר ראשי
│   ├── planner.ts                   # תכנון מבוסס LLM
│   ├── executor.ts                  # מנוע ביצוע
│   ├── state-manager.ts             # ניהול מצב
│   ├── tool-discovery.ts            # גילוי כלים
│   ├── agent-registry.ts            # רישום סוכנים
│   ├── shared-context.ts            # הקשר משותף
│   ├── agent-messenger.ts           # מסנג'ר סוכנים
│   │
│   ├── execution/
│   │   ├── parallel-coordinator.ts # תיאום מקבילי
│   │   └── error-recovery.ts       # התאוששות משגיאות
│   │
│   ├── streaming/
│   │   └── stream-manager.ts       # ניהול SSE streams
│   │
│   ├── caching/
│   │   └── smart-cache.ts          # מטמון חכם
│   │
│   ├── learning/
│   │   └── feedback-loop.ts        # למידה ו-feedback
│   │
│   ├── safety/
│   │   ├── hitl-gates.ts           # שערי HITL
│   │   ├── conflict-resolver.ts    # פתרון קונפליקטים
│   │   └── rate-limiter.ts         # הגבלת קצב
│   │
│   └── monitoring/
│       ├── tracer.ts               # מעקב מבוזר
│       ├── metrics.ts              # מטריקות
│       └── log-aggregator.ts       # ריכוז לוגים
│
├── types/
│   ├── orchestration.types.ts      # טיפוסי תזמור
│   ├── execution.types.ts          # טיפוסי ביצוע
│   ├── monitoring.types.ts         # טיפוסי ניטור
│   └── plugin.types.ts             # טיפוסי תוספים
│
└── db/
    └── migrations/
        └── 005_full_orchestration.sql  # מיגרציה מלאה

web/
└── app/
    └── api/
        └── orchestrate/
            ├── route.ts                   # POST /api/orchestrate
            ├── [id]/route.ts              # GET /api/orchestrate/:id
            ├── [id]/pause/route.ts        # POST /api/orchestrate/:id/pause
            ├── [id]/resume/route.ts       # POST /api/orchestrate/:id/resume
            ├── [id]/cancel/route.ts       # POST /api/orchestrate/:id/cancel
            └── stream/[id]/route.ts       # GET /api/orchestrate/stream/:id (SSE)
```

## 🔧 שימוש

### התחלת Execution

```typescript
import { masterOrchestrator } from '@backend/orchestration/master-orchestrator';

const execution = await masterOrchestrator.start(
  "תקרא מה עשינו בדצמבר בתבואות, תבין את האסטרטגיה ותקבע פגישה עם יואב",
  userId
);

console.log('Execution ID:', execution.id);
```

### מעקב אחר Execution

```typescript
// Get status
const execution = await masterOrchestrator.getExecution(executionId);

// Pause
await masterOrchestrator.pause(executionId);

// Resume
await masterOrchestrator.resume(executionId);

// Cancel
await masterOrchestrator.cancel(executionId);
```

### Stream בזמן אמת

```typescript
// Frontend
const eventSource = new EventSource(`/api/orchestrate/stream/${executionId}`);

eventSource.addEventListener('progress', (e) => {
  const data = JSON.parse(e.data);
  console.log('Progress:', data);
});

eventSource.addEventListener('complete', (e) => {
  const result = JSON.parse(e.data);
  console.log('Complete:', result);
});
```

## 🗄️ Database Schema

הטבלאות העיקריות:

### Core
- `executions` - רשומות ביצוע
- `execution_steps` - צעדים בודדים
- `shared_context` - הקשר משותף
- `agent_messages` - הודעות בין-סוכניות

### Monitoring
- `traces` - מעקב spans
- `metrics` - מטריקות ביצועים
- `logs` - לוגים מרוכזים

### Safety
- `pending_approvals` - אישורים ממתינים
- `resource_locks` - נעילות משאבים
- `rate_limits` - הגבלות קצב

### Learning
- `execution_feedback` - משוב מבצועים
- `learned_patterns` - דפוסים נלמדים
- `prompt_versions` - גרסאות prompt

## 📊 Flow לדוגמה

```typescript
// 1. USER REQUEST
const request = "תקרא מה עשינו בדצמבר בתבואות, תבין את האסטרטגיה, תקבע פגישה עם יואב"

// 2. MASTER ORCHESTRATOR
const execution = await masterOrchestrator.start(request, userId)

// 3. PLANNER
const plan = await planner.createPlan(request, userId, context)
/*
Plan:
  Step 1: DriveSearchAgent - search "תבואות דצמבר"
  Step 2: WeeklyStatusAgent - analyze findings
  Step 3: ContactSearchAgent - find "יואב" email
  Step 4: CalendarAgent - create meeting
  Step 5: EditorAgent - write agenda
*/

// 4. DEPENDENCY ANALYSIS
const batches = parallelCoordinator.analyzeDependencies(steps, graph)
/*
Batches:
  [Step 1, Step 3] - parallel (independent)
  [Step 2] - depends on Step 1
  [Step 4, Step 5] - parallel
*/

// 5. EXECUTION with streaming
stream.emit('progress', { step: 1, status: 'running', message: 'מחפש קבצים בDrive...' })

const [driveResult, contactResult] = await Promise.all([
  executeWithCache(Step1),
  executeWithRateLimit(Step3)
])

// 6. RESULT
stream.emit('complete', {
  meeting: { id, link },
  agenda: { text },
  summary: "נוצרה פגישה..."
})
```

## 🎯 מצב הפרויקט

### ✅ הושלמו
- Core Orchestration (master, planner, executor, state manager)
- Tool Discovery + Agent Registry
- Shared Context + State Persistence
- Real-time Streaming (SSE)
- Parallel Execution Engine
- Error Recovery
- Smart Caching
- Learning & Feedback
- Human-in-the-Loop Gates
- Conflict Resolution
- API Rate Limiting
- Distributed Tracing
- Metrics Collection
- Log Aggregation
- Inter-Agent Communication
- Database Migration (30+ tables)

### 🚧 בתהליך
- Execution Dashboard UI
- Webhooks & Proactive Actions
- Calendar Actions
- Testing & Simulation
- Multi-tenancy
- Plugin System
- Plan Versioning

## 🔐 Security

- Resource locking למניעת race conditions
- Rate limiting למניעת שימוש יתר ב-APIs
- HITL gates לפעולות קריטיות
- Approval workflow למשתמש

## 📈 Performance

- Parallel execution - ריצה מקבילית של צעדים
- Smart caching - שמירת תוצאות
- Checkpointing - שמירת מצב כל 5 שניות
- Error recovery - retry עם exponential backoff

## 🤝 תרומה

הפרויקט עדיין בפיתוח פעיל. לפרטים נוספים, ראה את קובץ התוכנית המקורי.
