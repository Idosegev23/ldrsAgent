# 🚀 הדרכת פריסה לאינטרנט

## אפשרויות פריסה מומלצות

### 1️⃣ **Vercel (המומלץ ביותר)**
- ✅ מותאם ל-Next.js
- ✅ פריסה אוטומטית מ-Git
- ✅ SSL חינמי + CDN
- ✅ Serverless Functions למאחורי הקלעים
- ✅ סביבות Development/Production

**צעדים:**
```bash
# התקנת Vercel CLI
npm i -g vercel

# פריסה
cd /Users/idosegev/Downloads/TriRoars/Leaders/leadrsagents
vercel

# הגדרת משתני סביבה
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY
# ... כל שאר ה-env vars
```

**הגדרות Project ב-Vercel:**
- Root Directory: `./`
- Build Command: `pnpm build`
- Output Directory: `web/.next`
- Install Command: `cd web && pnpm install`

---

### 2️⃣ **Railway / Render**
- ✅ תמיכה מלאה ב-Node.js
- ✅ Postgres מובנה
- ✅ פריסה מ-GitHub

**Dockerfile דוגמה:**
```dockerfile
FROM node:20-alpine

WORKDIR /app

# העתקת כל הקבצים
COPY . .

# התקנת תלויות
RUN npm install -g pnpm
RUN cd web && pnpm install

# Build
RUN pnpm build:production

# פורט
EXPOSE 3000

# הרצה
CMD ["pnpm", "start"]
```

---

### 3️⃣ **AWS / Google Cloud**
לסביבה enterprise עם autoscaling.

**אופציות:**
- AWS Amplify (דומה ל-Vercel)
- Google Cloud Run (Containers)
- AWS ECS/Fargate

---

## 🔐 משתני סביבה לפריסה

צור קובץ `.env.production` עם:
```bash
NODE_ENV=production

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Google OAuth
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
NEXT_PUBLIC_GOOGLE_REDIRECT_URI=https://YOUR_DOMAIN/auth/callback

# Google Service Account
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account"...}

# LLM
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AI...

# Auth
JWT_SECRET=your_production_jwt_secret
COOKIE_SECRET=your_production_cookie_secret
ALLOWED_DOMAIN=ldrsgroup.com

# WhatsApp (Green API)
WHATSAPP_INSTANCE_ID=your_instance
WHATSAPP_TOKEN=your_token
```

---

## 📊 ניטור ולוגים

### Vercel
- לוגים אוטומטיים ב-Dashboard
- Vercel Analytics מובנה

### אחרים
- **Sentry** - מעקב אחרי שגיאות
- **LogRocket** - session replay
- **Datadog / New Relic** - APM

---

## 🔄 CI/CD Pipeline

### GitHub Actions דוגמה:
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      
      - name: Install pnpm
        run: npm install -g pnpm
      
      - name: Install dependencies
        run: cd web && pnpm install
      
      - name: Build
        run: pnpm build
      
      - name: Deploy to Vercel
        run: vercel --prod --token=${{ secrets.VERCEL_TOKEN }}
```

---

## 🌍 דומיין מותאם אישית

1. **רכוש דומיין** (לדוגמה: agents.ldrsgroup.com)
2. **הוסף ב-Vercel:**
   - Settings → Domains
   - הוסף: `agents.ldrsgroup.com`
3. **עדכן DNS:**
   ```
   Type: CNAME
   Name: agents
   Value: cname.vercel-dns.com
   ```

---

## 🔒 אבטחה לפריסה

- [x] ודא ש-`ALLOWED_DOMAIN=ldrsgroup.com` מוגדר
- [x] השתמש ב-`HTTPS` בלבד
- [x] הפעל Supabase RLS
- [x] הגבל API Keys רק לדומיין שלך
- [x] הפעל Rate Limiting
- [x] הוסף CORS מוגבל

---

## 💰 עלויות משוערות

### Vercel Pro
- $20/חודש לצוות
- 100GB bandwidth
- Unlimited deployments

### Railway
- Pay as you go
- ~$5-20/חודש לשרת קטן

### Supabase Pro
- $25/חודש
- 8GB database
- 250GB bandwidth

**סה"כ משוער:** $50-70/חודש לכל המערכת

---

## 📞 המלצה סופית

**התחל עם Vercel** - זה הכי פשוט וזול להתחלה. אם תצטרך scale יותר מאוחר יותר, אפשר תמיד לעבור ל-AWS.

רוצה שאכין סקריפט deployment אוטומטי?
