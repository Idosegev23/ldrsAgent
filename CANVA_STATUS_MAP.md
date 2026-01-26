# 🗺️ מפת Canva Integration - סטטוס מלא

תאריך: 25.01.2026

---

## ✅ מה עשינו היום (הושלם):

### 1. Backend - Core Components

| רכיב | קובץ | סטטוס | פרטים |
|------|------|--------|--------|
| **Database Migration** | `src/db/migrations/007_add_canva_oauth.sql` | ✅ הושלם | 6 עמודות חדשות + אינדקס |
| | **הרצת מיגרציה** | ✅ רץ דרך MCP | עמודות נוצרו ב-Supabase |
| **OAuth Manager** | `src/integrations/auth/canva-oauth.ts` | ✅ הושלם | OAuth 2.0 + PKCE, refresh tokens |
| **Connector** | `src/integrations/connectors/canva.connector.ts` | ✅ הושלם | 12 פונקציות API מלאות |
| **Agent** | `src/execution/agents/canva.agent.ts` | ✅ הושלם | AI-powered intent parsing |

**פונקציות Connector:**
- ✅ listDesigns, searchDesigns, getDesign
- ✅ createDesign (from template)
- ✅ exportDesign (PNG/PDF/JPG/GIF/MP4)
- ✅ uploadAsset, getAsset, updateAsset, deleteAsset
- ✅ listBrandTemplates, getBrandTemplate
- ✅ listFolders

---

### 2. API Routes

| Endpoint | קובץ | סטטוס | מטרה |
|----------|------|--------|------|
| **GET /api/auth/canva** | `web/app/api/auth/canva/route.ts` | ✅ הושלם | התחלת OAuth flow |
| **GET /api/auth/canva/callback** | `web/app/api/auth/canva/callback/route.ts` | ✅ הושלם | קבלת tokens |
| **GET /api/auth/canva/status** | `web/app/api/auth/canva/status/route.ts` | ✅ הושלם | בדיקת חיבור |

---

### 3. Orchestration Integration

| רכיב | קובץ | סטטוס | שינויים |
|------|------|--------|---------|
| **Planner** | `src/orchestration/planner.ts` | ✅ עודכן | + Canva Agent ברשימה<br>+ Keyword detection<br>+ Prompt enforcement |
| **Executor** | `src/orchestration/executor.ts` | ✅ עודכן | + Import CanvaAgent<br>+ Instance בconструctor<br>+ Execution logic |

**Keyword Detection:**
```javascript
['canva', 'קנבה', 'בקנבה', 'ב-canva', 
 'דיזיין', 'עיצוב', 'מעוצב', 
 'פרזנטציה', 'מצגת', 
 'הצעת מחיר רזה', 'הצעת מחיר מעוצבת']
```

---

### 4. UI Integration

| רכיב | קובץ | סטטוס | שינויים |
|------|------|--------|---------|
| **Dashboard** | `web/app/dashboard/page.tsx` | ✅ עודכן | + canvaConnected state<br>+ checkCanvaStatus()<br>+ connectCanva()<br>+ Status UI<br>+ Quick action |

**UI Features:**
- ✅ כפתור "התחבר ל-Canva"
- ✅ אינדיקטור סטטוס (מחובר/לא מחובר)
- ✅ Quick action: "צור דיזיין Canva"
- ✅ התראה כשלא מחובר

---

### 5. Configuration

| הגדרה | סטטוס | הערות |
|-------|--------|-------|
| **127.0.0.1 support** | ✅ הושלם | canva-oauth.ts משתמש ב-127.0.0.1 |
| **Environment variables** | ⚠️ חלקי | CLIENT_ID יש, CLIENT_SECRET חסר |

---

### 6. תיעוד

| מסמך | תוכן | סטטוס |
|------|------|--------|
| `CANVA_INTEGRATION_PLAN.md` | תכנית מפורטת | ✅ |
| `docs/CANVA_FEASIBILITY_REPORT.md` | דוח היתכנות | ✅ |
| `CANVA_SETUP_COMPLETE.md` | מדריך שלם | ✅ |
| `CANVA_QUICK_START.md` | התחלה מהירה | ✅ |
| `CANVA_FIXED.md` | תיקון Planner | ✅ |
| `test-canva-proposal.ts` | סימולציה | ✅ |

---

## ❌ מה לא עובד (בעיות):

### 1. OAuth Connection נכשל

**תסמינים:**
```
"זה לא התחבר"
```

**סיבות אפשריות:**

#### A. Environment Variables חסרים

**מה יש:**
```bash
CANVA_CLIENT_ID=OC-AZtCHaOIFq-7
```

**מה חסר:**
```bash
CANVA_CLIENT_SECRET=<????>
CANVA_REDIRECT_URI=http://127.0.0.1:3000/api/auth/canva/callback
```

#### B. Canva Developer Console לא מוגדר

צריך להגדיר ב-https://www.canva.com/developers/apps:
- ✅ Client ID: `OC-AZtCHaOIFq-7`
- ❓ Redirect URI: `http://127.0.0.1:3000/api/auth/canva/callback`
- ❓ Scopes מאושרים

#### C. השרת לא רץ / רץ על פורט שגוי

```bash
# צריך לרוץ על:
http://127.0.0.1:3000
```

---

## 🔴 מה נותר לעשות (TODO):

### Priority 1: תיקון OAuth Connection

#### שלב 1: השלמת Environment Variables

```bash
# פתח .env.local והוסף:

# יש כבר:
CANVA_CLIENT_ID=OC-AZtCHaOIFq-7

# צריך להוסיף:
CANVA_CLIENT_SECRET=<קבל מ-Canva Developer Console>
CANVA_REDIRECT_URI=http://127.0.0.1:3000/api/auth/canva/callback

# וודא שיש גם:
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
```

#### שלב 2: הגדרת Canva Developer Console

1. גש ל-https://www.canva.com/developers/apps
2. בחר את ה-App (Client ID: `OC-AZtCHaOIFq-7`)
3. הוסף Redirect URI:
   ```
   http://127.0.0.1:3000/api/auth/canva/callback
   ```
4. וודא Scopes:
   - ✅ profile:read
   - ✅ design:meta:read, design:content:read, design:content:write
   - ✅ design:permission:read, design:permission:write
   - ✅ asset:read, asset:write
   - ✅ folder:read, folder:write
   - ✅ brandtemplate:meta:read, brandtemplate:content:read
   - ✅ comment:read, comment:write
   - ✅ app:read, app:write

#### שלב 3: הפעלת השרת

```bash
cd /Users/idosegev/Downloads/TriRoars/Leaders/leadrsagents/web
pnpm dev
```

ודא שרץ על: `http://127.0.0.1:3000`

#### שלב 4: ניסיון התחברות

1. פתח: http://127.0.0.1:3000/dashboard
2. לחץ **"התחבר ל-Canva"**
3. תועבר ל-Canva → אשר הרשאות
4. תחזור לדשבורד → אמור לראות "✓ Canva מחובר"

---

### Priority 2: בדיקת Integration

#### טסט 1: OAuth Status

```bash
# בדוק ב-terminal הלוגים:
[INFO] Initiating Canva OAuth flow
[INFO] Canva OAuth URL generated
[INFO] Handling Canva OAuth callback
[INFO] Canva tokens saved successfully
```

#### טסט 2: בקשה פשוטה

בצ'אט:
```
"הראה לי את הדיזיינים שלי ב-Canva"
```

**ציפייה:**
```
[INFO] Canva keywords detected: true
[INFO] Multi-agent plan created { "agents": ["canva_agent"] }
[INFO] Starting Canva execution
[INFO] Listing Canva designs
```

#### טסט 3: בקשה מורכבת

```
"צור לי הצעת מחיר רזה ב-Canva למותג X עם כל התכנים"
```

**ציפייה:**
```
[INFO] Canva keywords detected: true
[INFO] Intent parsed { "action": "CREATE_DESIGN" }
[INFO] Creating design
✅ דיזיין נוצר: "הצעת מחיר - מותג X"
🔗 לחץ לעריכה: https://...
```

---

### Priority 3: Debugging (אם עדיין לא עובד)

#### Option A: בדיקה ידנית של OAuth

```typescript
// test-canva-oauth.ts
import { initiateCanvaOAuthFlow } from './src/integrations/auth/canva-oauth.js';

const testUserId = 'test-user-id';
const authUrl = await initiateCanvaOAuthFlow(testUserId);
console.log('Auth URL:', authUrl);
// גש ל-URL, אשר, והעתק את הקוד
```

#### Option B: בדיקת Connector ישירה

```typescript
// test-canva-connector.ts
import * as canva from './src/integrations/connectors/canva.connector.js';

// נדרש userId מחובר
const designs = await canva.listDesigns('user-id-here');
console.log('Designs:', designs);
```

#### Option C: בדיקת Database

```sql
-- בדוק אם columns קיימים:
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name LIKE 'canva%';

-- אמור להחזיר:
-- canva_access_token | text
-- canva_refresh_token | text
-- canva_token_expires_at | timestamp with time zone
-- canva_user_id | text
-- canva_scopes | ARRAY
-- canva_connected_at | timestamp with time zone
```

---

## 📋 Checklist מלא:

### Setup (חובה)

- [ ] **CANVA_CLIENT_SECRET** ב-.env.local
- [ ] **CANVA_REDIRECT_URI** ב-.env.local
- [ ] **Redirect URI** מוגדר ב-Canva Console
- [ ] **Scopes** מאושרים ב-Canva Console
- [ ] השרת רץ על `127.0.0.1:3000`

### Testing (בדיקה)

- [ ] כפתור "התחבר ל-Canva" מופיע
- [ ] OAuth redirect עובד
- [ ] Tokens נשמרים ב-DB
- [ ] Status מראה "מחובר"
- [ ] Planner בוחר canva_agent
- [ ] Agent מריץ Canva API calls
- [ ] תוצאות מגיעות מ-Canva

---

## 🎯 הצעד הבא:

### אופציה 1: Debug OAuth

```bash
# הרץ בטרמינל:
cd web
pnpm dev

# בדוק בלוגים אם רואה:
[Auth Middleware] Checking auth
```

### אופציה 2: Manual Canva Test

```bash
# נסה ישירות:
npx tsx test-canva-proposal.ts

# זה יראה את הסימולציה
```

### אופציה 3: כדור הבדולח - SQL ישיר

```sql
-- בדוק אם יש משתמשים:
SELECT id, email, canva_access_token IS NOT NULL as has_canva
FROM users
LIMIT 5;
```

---

## 💡 מה הכי חשוב עכשיו:

**הבעיה המרכזית: OAuth Connection**

צריך:
1. ✅ `CANVA_CLIENT_SECRET` ב-.env.local
2. ✅ Redirect URI ב-Canva Console
3. ✅ השרת רץ
4. ✅ ללחוץ "התחבר ל-Canva"

**ברגע שזה יעבוד - הכל האחר יעבוד!**

כל הקוד מוכן, פשוט צריך את ה-OAuth connection.

---

## 📞 איך להמשיך:

תגיד לי:
1. **האם יש לך CANVA_CLIENT_SECRET?**
2. **האם הגדרת Redirect URI ב-Canva Console?**
3. **האם השרת רץ?**
4. **מה הלוגים אומרים כשלוחץ "התחבר ל-Canva"?**

ואני אדע בדיוק מה צריך לתקן! 🔧
