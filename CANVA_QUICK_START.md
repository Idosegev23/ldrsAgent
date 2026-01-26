# 🚀 Canva - התחלה מהירה

## 1️⃣ הוסף Credentials ל-.env.local

פתח את `.env.local` והוסף:

```bash
# Canva OAuth
CANVA_CLIENT_ID=OC-AZtCHaOIFq-7
CANVA_CLIENT_SECRET=your_secret_here
CANVA_REDIRECT_URI=http://127.0.0.1:3000/api/auth/canva/callback
```

**⚠️ חשוב:** Canva דורש `127.0.0.1` ולא `localhost`!

---

## 2️⃣ הגדר Redirect URI ב-Canva Developer Console

1. גש ל-https://www.canva.com/developers/apps
2. בחר את ה-App שלך
3. ב-Redirect URIs, הוסף:
   ```
   http://127.0.0.1:3000/api/auth/canva/callback
   ```

---

## 3️⃣ הרץ מיגרציה ב-Supabase

1. פתח https://fhgggqnaplshwbrzgima.supabase.co
2. לך ל-SQL Editor
3. הרץ:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS canva_access_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS canva_refresh_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS canva_token_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS canva_user_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS canva_scopes TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS canva_connected_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_users_canva_user_id ON users(canva_user_id);
```

---

## 4️⃣ הפעל את השרת

```bash
cd web
pnpm dev
```

**שים לב:** גש ל-`http://127.0.0.1:3000` (לא `localhost:3000`)

---

## 5️⃣ התחבר ל-Canva

1. פתח http://127.0.0.1:3000/dashboard
2. לחץ **"התחבר ל-Canva"**
3. אשר הרשאות ב-Canva
4. ✅ זהו!

---

## 6️⃣ בדוק שזה עובד

נסה בצ'אט:
```
"הראה לי את הדיזיינים שלי ב-Canva"
```

או:
```
"צור לי פוסט אינסטגרם חדש"
```

---

## ❗ Troubleshooting

### "Redirect URI mismatch"
**פתרון:** ודא ש:
- ב-`.env.local`: `http://127.0.0.1:3000/api/auth/canva/callback`
- ב-Canva Console: אותו URL בדיוק
- גש דרך `127.0.0.1` ולא `localhost`

### "Client secret not configured"
**פתרון:** הוסף `CANVA_CLIENT_SECRET` ל-`.env.local`

### "User not found"
**פתרון:** ודא שאתה מחובר למערכת עם Supabase Auth

---

## 📊 Scopes שמוגדרים:

המערכת מבקשת את כל ה-Scopes הנדרשים:
- ✅ profile:read
- ✅ design:meta:read, design:content:read, design:content:write
- ✅ design:permission:read, design:permission:write
- ✅ asset:read, asset:write
- ✅ folder:read, folder:write
- ✅ folder:permission:read, folder:permission:write
- ✅ brandtemplate:meta:read, brandtemplate:content:read
- ✅ comment:read, comment:write
- ✅ app:read, app:write

---

## 🎯 מה עכשיו?

הכל מוכן! אפשר להשתמש ב-Canva דרך הצ'אט:

```
"חפש דיזיינים של מותג X"
"ייצא את הדיזיין האחרון ל-PDF"
"העלה את הלוגו החדש"
"צור פוסט לפייסבוק"
```

**המערכת תטפל בהכל אוטומטית!** 🎨✨
