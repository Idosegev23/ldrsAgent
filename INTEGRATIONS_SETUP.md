# הגדרת אינטגרציות

## הבעיה
האינטגרציות מוצגות כ"לא מוגדר" למרות שיש מפתחות ב-env.

## הסיבה
Next.js (web/) צריך **קובץ env נפרד** מהשרת הראשי!

המפתחות של האינטגרציות צריכים להיות גם ב-`web/.env.local` כדי שה-API routes (שרצים בצד השרת של Next.js) יוכלו לגשת אליהם.

## הפתרון

### אופציה 1: סקריפט אוטומטי (מומלץ)

```bash
# הרץ את הסקריפט שיעתיק את המפתחות
./scripts/sync-env.sh
```

הסקריפט יעתיק את המפתחות הבאים מ-`.env.local` (root) ל-`web/.env.local`:
- Google (Drive, Gmail, Calendar)
- ClickUp
- WhatsApp
- Apify
- OpenAI & Gemini

### אופציה 2: העתקה ידנית

1. **פתח את הקובץ `.env.local` בroot** (אם אין, צור מ-`env.template`)

2. **העתק את המפתחות הבאים ל-`web/.env.local`:**

```bash
# Google
GOOGLE_CLIENT_ID=your-value
GOOGLE_CLIENT_SECRET=your-value
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
GOOGLE_DRIVE_FOLDER_ID=your-value

# ClickUp
CLICKUP_API_TOKEN=your-value
CLICKUP_WORKSPACE_ID=your-value

# WhatsApp
GREEN_API_INSTANCE_ID=your-value
GREEN_API_TOKEN=your-value

# Apify
APIFY_TOKEN=your-value

# LLM
OPENAI_API_KEY=your-value
GEMINI_API_KEY=your-value

# App
ALLOWED_DOMAIN=ldrsgroup.com
```

3. **שמור ורענן את השרת**

```bash
# הפסק את השרת (Ctrl+C)
# הרץ מחדש
cd web
npm run dev
```

## בדיקה

אחרי התיקון, לך ל-`/dashboard/integrations` ואתה אמור לראות:

✅ **תקינות** (ירוק) - המפתח קיים ומוגדר
⚠️ **חסר** (אדום) - המפתח לא מוגדר או ריק
❓ **לא ידוע** (אפור) - לא בוצעה בדיקה

## למה זה נדרש?

Next.js מפריד בין:
- **Frontend** (browser): משתמש ב-`NEXT_PUBLIC_*` variables
- **API Routes** (server-side): משתמש בכל ה-variables מ-`web/.env.local`

המפתחות של האינטגרציות משמשים את ה-API routes בלבד, לכן הם צריכים להיות ב-`web/.env.local` (בלי NEXT_PUBLIC_).

## אבטחה

⚠️ **חשוב:** אל תוסיף `NEXT_PUBLIC_` למפתחות הסודיים! 

- ✅ `GOOGLE_CLIENT_SECRET` - בטוח (server-side only)
- ❌ `NEXT_PUBLIC_GOOGLE_CLIENT_SECRET` - לא בטוח! (נחשף בbrowser)
