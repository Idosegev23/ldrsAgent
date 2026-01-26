# 🚀 Quick Start - מנוע AI אוטונומי

## צעד 1: התקן Dependencies

```bash
npm install
cd web && npm install
```

## צעד 2: הגדר Environment Variables

ודא ש-`.env.local` מכיל:
```bash
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key

# Google APIs
GEMINI_API_KEY=your_gemini_key
GOOGLE_SERVICE_ACCOUNT_KEY=your_service_account_json

# Drive
GOOGLE_DRIVE_FOLDER_ID=1Q7gKNlNXmV0jXtTbOKe2_-i4AjAGPYBd
```

ב-`web/.env.local`:
```bash
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## צעד 3: הרץ Migration

```bash
npm run db:migrate
```

או ידנית:
```bash
psql $SUPABASE_DB_URL < src/db/migrations/005_full_orchestration.sql
```

## צעד 4: הפעל שרת

```bash
cd web
npm run dev
```

## צעד 5: גש לדאשבורד

פתח דפדפן:
```
http://localhost:3000/orchestrate
```

## צעד 6: צור Execution ראשון

### דרך UI:
1. לחץ על "התחל Execution חדש"
2. הכנס בקשה: "תקרא מה עשינו בדצמבר בתבואות"
3. צפה בביצוע בזמן אמת!

### דרך API:
```bash
curl -X POST http://localhost:3000/api/orchestrate \
  -H "Content-Type: application/json" \
  -d '{
    "query": "בדיקה של המערכת",
    "userId": "demo-user"
  }'
```

התשובה:
```json
{
  "execution": {
    "id": "execution-abc123",
    "status": "PLANNING",
    "request": "בדיקה של המערכת",
    "currentStep": 0,
    "totalSteps": 0
  }
}
```

## צעד 7: עקוב אחר ההתקדמות

### דרך Dashboard:
גש ל-`http://localhost:3000/orchestrate?id=execution-abc123`

### דרך SSE:
```javascript
const eventSource = new EventSource(
  'http://localhost:3000/api/orchestrate/stream/execution-abc123'
);

eventSource.addEventListener('progress', (e) => {
  const data = JSON.parse(e.data);
  console.log('Progress:', data);
});

eventSource.addEventListener('complete', (e) => {
  const result = JSON.parse(e.data);
  console.log('Complete!', result);
});
```

---

## 🧪 בדיקות מהירות

### בדיקה 1: Dry Run
```typescript
import { executionSimulator } from '@backend/orchestration/testing/simulator';

const plan = await executionSimulator.dryRun(
  "תקרא מה עשינו בדצמבר",
  "test-user"
);

console.log('Plan:', plan.steps.length, 'steps');
```

### בדיקה 2: Tool Discovery
```typescript
import { toolDiscovery } from '@backend/orchestration/tool-discovery';

const tools = await toolDiscovery.discover();
console.log('Found', tools.length, 'tools');
```

### בדיקה 3: Context Sharing
```typescript
import { sharedContextStore } from '@backend/orchestration/shared-context';

sharedContextStore.set('exec-123', 'test', { value: 'hello' }, 'agent-1');
const value = sharedContextStore.get('exec-123', 'test');
console.log('Context value:', value);
```

---

## 🐛 פתרון בעיות

### שגיאה: "Module not found"
**פתרון:**
```bash
cd web
npm install
```

### שגיאה: "Table does not exist"
**פתרון:**
```bash
npm run db:migrate
```

### שגיאה: "npm EPERM"
**פתרון:**
```bash
sudo chown -R $(id -u):$(id -g) ~/.npm
npm install
```

### שגיאה: "Cannot find module '@backend/...'"
**פתרון:** ודא ש-`web/tsconfig.json` מכיל:
```json
{
  "compilerOptions": {
    "paths": {
      "@backend/*": ["../src/*"]
    }
  }
}
```

### SSE לא עובד
**פתרון:**
- ודא שהשרת רץ
- בדוק console ב-DevTools
- נסה לרענן את הדף

---

## 📋 Checklist להפעלה

- [ ] `npm install` בשתי התיקיות
- [ ] `.env.local` מוגדר נכון
- [ ] Migration רץ בהצלחה
- [ ] שרת רץ ב-localhost:3000
- [ ] Dashboard נטען ב-`/orchestrate`
- [ ] API מגיב ב-`/api/orchestrate`
- [ ] SSE stream עובד

---

## 🎯 דוגמאות שימוש

### דוגמה 1: חיפוש + דוח
```typescript
const execution = await fetch('/api/orchestrate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'תקרא מה עשינו בדצמבר בסיקרט ותכין דוח',
    userId: 'user-123'
  })
});
```

### דוגמה 2: פגישה עם אג'נדה
```typescript
const execution = await fetch('/api/orchestrate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'קבע פגישה עם יואב מחר ב-10 על אסטרטגיה',
    userId: 'user-123'
  })
});
```

### דוגמה 3: Webhook יומי
```typescript
const webhook = await fetch('/api/webhooks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user-123',
    name: 'Daily Report',
    trigger: {
      type: 'SCHEDULE',
      config: { schedule: 'every day at 9:00' }
    },
    action: {
      type: 'EXECUTION',
      config: { request: 'צור דוח יומי' }
    }
  })
});
```

---

## 🔥 הכל מוכן!

המערכת מלאה ופועלת. פשוט תריץ את הצעדים למעלה ותתחיל!
