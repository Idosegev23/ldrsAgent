# 🗄️ הוראות להרצת המיגרציה

## אופציה 1: דרך Supabase SQL Editor (מומלץ!)

הדרך הכי פשוטה וישירה:

### צעדים:

1. **פתח את Supabase SQL Editor:**
   ```
   https://supabase.com/dashboard/project/fhgggqnaplshwbrzgima/sql
   ```

2. **העתק את כל תוכן הקובץ:**
   ```
   src/db/migrations/005_full_orchestration.sql
   ```

3. **הדבק ב-SQL Editor**

4. **לחץ על "Run"** (או Ctrl/Cmd + Enter)

5. **המתן כ-10 שניות**

6. **תראה הודעת הצלחה!** ✅

---

## אופציה 2: דרך Node.js Script

```bash
# הרץ את הscript
node run-migration.js
```

**אם זה לא עובד** - חזור לאופציה 1 (SQL Editor)

---

## אופציה 3: דרך psql (אם יש לך גישה)

```bash
# אם יש לך connection string ל-Postgres
psql "postgresql://postgres:[PASSWORD]@db.fhgggqnaplshwbrzgima.supabase.co:5432/postgres" \
  -f src/db/migrations/005_full_orchestration.sql
```

---

## ✅ איך לדעת שזה עבד?

אחרי הרצת המיגרציה, בדוק ב-Supabase Table Editor:

```
https://supabase.com/dashboard/project/fhgggqnaplshwbrzgima/editor
```

**צריך לראות 30+ טבלאות חדשות:**
- executions
- execution_steps
- shared_context
- agent_messages
- execution_checkpoints
- cache_entries
- execution_feedback
- learned_patterns
- traces
- metrics
- logs
- pending_approvals
- resource_locks
- rate_limits
- webhooks
- webhook_executions
- workspaces
- workspace_members
- workspace_permissions
- plugins
- plugin_hooks
- plan_versions
- ab_tests
- tool_catalog

---

## 🚀 אחרי המיגרציה

```bash
# 1. התקן dependencies (אם עוד לא)
npm install
cd web && npm install

# 2. הרץ את השרת
cd web && npm run dev

# 3. פתח דפדפן
http://localhost:3000/orchestrate
```

---

## 🐛 פתרון בעיות

### שגיאה: "permission denied"
**פתרון:** השתמש באופציה 1 (SQL Editor) - יש לך הרשאות מלאות שם

### שגיאה: "relation already exists"
**פתרון:** הטבלאות כבר קיימות! אתה יכול להמשיך

### שגיאה: "cannot execute"
**פתרון:** השתמש באופציה 1 (SQL Editor)

---

## 💡 טיפ

אם אתה רוצה לוודא שהכל עובד, אחרי המיגרציה הרץ:

```sql
-- ב-SQL Editor
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE '%execution%'
ORDER BY table_name;
```

צריך לראות:
- executions
- execution_checkpoints
- execution_feedback
- execution_steps

**אם רואה את זה - הכל עבד! 🎉**
