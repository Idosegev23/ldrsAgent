# ✅ Canva Integration - הושלם!

## מה נוצר:

### 1. Database Migration ✅
- **קובץ:** `src/db/migrations/007_add_canva_oauth.sql`
- **עמודות חדשות:** canva_access_token, canva_refresh_token, canva_token_expires_at, canva_user_id, canva_scopes, canva_connected_at
- **הערה:** המיגרציה צריכה להיר manual ב-Supabase Dashboard

### 2. OAuth Manager ✅
- **קובץ:** `src/integrations/auth/canva-oauth.ts`
- **פונקציות:**
  - `initiateCanvaOAuthFlow()` - התחלת flow
  - `handleCanvaOAuthCallback()` - טיפול ב-callback
  - `saveCanvaTokens()` - שמירת tokens
  - `getValidCanvaToken()` - קבלת token תקף (עם refresh)
  - `isCanvaConnected()` - בדיקת סטטוס
  - `getUserCanvaInfo()` - מידע על החיבור

### 3. Connector ✅
- **קובץ:** `src/integrations/connectors/canva.connector.ts`
- **פונקציות:**
  - `listDesigns()` - רשימת דיזיינים
  - `getDesign()` - קבלת דיזיין
  - `createDesign()` - יצירת דיזיין
  - `exportDesign()` - ייצוא (PNG/PDF/JPG/GIF/MP4)
  - `uploadAsset()` - העלאת תמונה/וידאו
  - `getAsset()` - קבלת asset
  - `updateAsset()` - עדכון metadata
  - `deleteAsset()` - מחיקה
  - `listBrandTemplates()` - תבניות מותג
  - `searchDesigns()` - חיפוש

### 4. Agent ✅
- **קובץ:** `src/execution/agents/canva.agent.ts`
- **יכולות:**
  - ניתוח בקשות בשפה טבעית עם AI
  - זיהוי אוטומטי של פעולות (LIST, SEARCH, CREATE, EXPORT, UPLOAD)
  - ביצוע פעולות והחזרת תוצאות

### 5. API Endpoints ✅
- **GET /api/auth/canva** - התחלת OAuth
- **GET /api/auth/canva/callback** - קבלת tokens
- **GET /api/auth/canva/status** - בדיקת סטטוס

### 6. Orchestrator Integration ✅
- ✅ `planner.ts` - canva_agent נוסף לרשימת agents
- ✅ `executor.ts` - CanvaAgent משולב ופועל

### 7. UI ✅
- ✅ כפתור "התחבר ל-Canva" בדשבורד
- ✅ אינדיקטור סטטוס (מחובר/לא מחובר)
- ✅ Quick action חדש: "צור דיזיין Canva"

---

## איך להשתמש:

### שלב 1: הגדרות ב-Canva Developer Portal

1. גש ל-https://www.canva.com/developers
2. צור integration חדש או השתמש בקיים
3. קבל:
   - Client ID
   - Client Secret
4. הגדר Redirect URI:
   ```
   Development: http://localhost:3000/api/auth/canva/callback
   Production: https://yourdomain.com/api/auth/canva/callback
   ```
5. בחר Scopes:
   - design:meta:read
   - design:content:read
   - design:content:write
   - asset:read
   - asset:write
   - brandtemplate:meta:read
   - brandtemplate:content:read
   - folder:read
   - folder:write
   - profile:read

### שלב 2: Environment Variables

הוסף ל-`.env.local`:

```bash
# Canva OAuth
CANVA_CLIENT_ID=your_client_id_here
CANVA_CLIENT_SECRET=your_client_secret_here
CANVA_REDIRECT_URI=http://localhost:3000/api/auth/canva/callback

# Production
# CANVA_REDIRECT_URI=https://yourdomain.com/api/auth/canva/callback
```

### שלב 3: הרץ מיגרציה

בSupabase Dashboard → SQL Editor:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS canva_access_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS canva_refresh_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS canva_token_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS canva_user_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS canva_scopes TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS canva_connected_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_users_canva_user_id ON users(canva_user_id);
```

### שלב 4: הפעל את השרת

```bash
cd web
pnpm dev
```

### שלב 5: התחבר ל-Canva

1. פתח http://localhost:3000/dashboard
2. לחץ "התחבר ל-Canva"
3. אשר הרשאות ב-Canva
4. תועבר חזרה לדשבורד

### שלב 6: השתמש!

**דוגמאות בצ'אט:**

```
"הראה לי את כל הדיזיינים שלי ב-Canva"
"חפש דיזיינים של מותג X"
"צור לי פוסט אינסטגרם חדש"
"ייצא את הדיזיין האחרון ל-PDF"
"העלה את הלוגו החדש ל-Canva"
```

---

## מה המערכת יכולה לעשות:

### 🔍 שליפה וחיפוש
- ✅ הצגת כל הדיזיינים
- ✅ חיפוש לפי מילות מפתח
- ✅ סינון לפי ownership (שלי/משותף)
- ✅ מיון (רלוונטיות/תאריך/שם)

### ✨ יצירה
- ✅ יצירת דיזיין חדש (ריק או מtemplate)
- ✅ העלאת תמונות ווידאו
- ✅ תיוג assets

### 📤 ייצוא
- ✅ PNG
- ✅ JPG
- ✅ PDF
- ✅ GIF
- ✅ MP4 (וידאו)
- ✅ PPTX

### 🎨 ניהול
- ✅ עריכת metadata
- ✅ מחיקת assets
- ✅ ניהול תבניות מותג
- ✅ ניהול folders

---

## זרימות עבודה מתקדמות:

### 1. Drive → Canva → Export
```
"קח את הלוגו מהתיקייה של לקוח X,
 העלה אותו ל-Canva,
 צור ממנו פוסט אינסטגרם,
 וייצא ל-PNG"
```

### 2. Data → AI → Canva
```
"תוציא נתונים מהדוח,
 בנה מהם infographic ב-Canva,
 וייצא ל-PDF"
```

### 3. Canva → Drive → Email
```
"הראה את הדיזיינים של השבוע,
 ייצא אותם,
 שמור ב-Drive,
 ושלח למייל ללקוח"
```

---

## Rate Limits

- **100 requests/minute** per user (רוב הפעולות)
- **30 requests/minute** per user (מחיקות)

**הטיפול:** המערכת כוללת retry logic ומטפלת אוטומטית ב-rate limits.

---

## Troubleshooting

### "Canva not connected"
**פתרון:** לחץ "התחבר ל-Canva" בדשבורד

### "Token expired"
**פתרון:** המערכת תרענן אוטומטית. אם לא עובד - התנתק והתחבר מחדש

### "Failed to create design"
**בדוק:**
- Client ID/Secret נכונים?
- Scopes מאושרים?
- Integration active ב-Canva?

### "Upload failed"
**סיבות אפשריות:**
- קובץ גדול מדי
- פורמט לא נתמך
- Rate limit

---

## מה הלאה?

### אופציונלי - תכונות נוספות:

1. **Autofill API (Preview)**
   - מילוי אוטומטי של תוכן בdיזיינים

2. **Comments API**
   - תגובות על דיזיינים
   - שיתוף פעולה

3. **Webhooks**
   - עדכונים real-time
   - התראות על שינויים

4. **Batch Operations**
   - ייצוא המוני
   - העלאה המונית

---

## תמיכה

**Documentation:** https://www.canva.dev/docs/connect/
**API Reference:** https://www.canva.dev/docs/connect/api-reference/
**Community:** https://community.canva.dev/

---

## סיכום

✅ **הכל מוכן!**

- 7/7 רכיבים הושלמו
- OAuth flow מלא
- Agent חכם עם AI
- UI אינטואיטיבי
- שילוב מלא במערכת

**פשוט הוסף credentials והתחל להשתמש!** 🎨✨
