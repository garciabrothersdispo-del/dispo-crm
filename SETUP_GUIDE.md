# DispoCRM Pro — Complete Setup Guide
### From zero to live app on web, desktop, and mobile

---

## What You're Building

| Platform | How | Cost |
|----------|-----|------|
| **Web app** | Next.js deployed on Vercel | Free |
| **Database + Auth** | Supabase (Postgres + login) | Free |
| **Desktop (Mac/Windows)** | Electron wraps the web app | Free |
| **Mobile (iOS/Android)** | Capacitor wraps the web app | Free (dev), ~$99/yr (App Store) |

Your whole team shares one real database. Changes sync in real time across every device.

---

## PHASE 1 — Supabase (Database & Auth)

### Step 1.1 — Create a free Supabase account

1. Go to **https://supabase.com** and click **Start your project**
2. Sign up with GitHub or email
3. Click **New project**
4. Fill in:
   - **Name:** `dispo-crm`
   - **Database Password:** make something strong, save it
   - **Region:** pick the one closest to you (US East if you're in Texas)
5. Click **Create new project** — wait ~2 minutes for it to provision

### Step 1.2 — Run the database schema

1. In your Supabase dashboard, click **SQL Editor** in the left sidebar
2. Click **New query**
3. Open the file `supabase/migrations/001_schema.sql` from your project folder
4. Copy the entire contents and paste it into the SQL editor
5. Click **Run** (or press Cmd+Enter)
6. You should see "Success. No rows returned" — that means it worked

### Step 1.3 — Get your API keys

1. In Supabase, go to **Project Settings** (gear icon) → **API**
2. Copy two values:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)
3. Keep these open — you'll need them in the next step

### Step 1.4 — Enable Google Login (optional but recommended)

1. In Supabase, go to **Authentication** → **Providers**
2. Find **Google** and toggle it on
3. Go to **https://console.cloud.google.com**
4. Create a new project → **APIs & Services** → **Credentials**
5. Create **OAuth 2.0 Client ID** (Web application)
6. Add authorized redirect URIs:
   - `https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback`
   - `http://localhost:3000/auth/callback` (for local dev)
7. Copy the Client ID and Client Secret back into Supabase's Google provider settings
8. Click Save

---

## PHASE 2 — Web App Setup (Local Development)

### Step 2.1 — Install Node.js

1. Go to **https://nodejs.org**
2. Download the **LTS version** (the one that says "Recommended for most users")
3. Run the installer — click through defaults
4. Open **Terminal** (Mac: Cmd+Space → type "Terminal") or **Command Prompt** (Windows: Start → "cmd")
5. Verify it worked: type `node --version` — you should see something like `v20.x.x`

### Step 2.2 — Set up the project

1. Move the `dispo-crm-app` folder somewhere permanent (e.g., your Desktop or Documents)
2. In Terminal, navigate to it:
   ```bash
   cd ~/Desktop/dispo-crm-app
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
   This takes 1–2 minutes.

### Step 2.3 — Add your Supabase keys

1. In the project folder, find the file `.env.local.example`
2. Duplicate it and rename the copy to `.env.local`
3. Open `.env.local` in any text editor (TextEdit on Mac, Notepad on Windows)
4. Replace the placeholder values:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_ACTUAL_PROJECT_ID.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_actual_anon_key_here
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```
5. Save the file

### Step 2.4 — Run the app locally

```bash
npm run dev
```

Open **http://localhost:3000** in your browser. You should see the DispoCRM login page.

Create your first account — you'll be the admin.

**To make yourself admin:**
1. Go to Supabase → **Table Editor** → `profiles`
2. Find your row
3. Change `role` from `agent` to `admin`
4. Click **Save**

---

## PHASE 3 — Deploy to the Web (Vercel)

This makes the app live at a real URL your whole team can access.

### Step 3.1 — Push code to GitHub

1. Go to **https://github.com** and create a free account if you don't have one
2. Click **New repository** → name it `dispo-crm` → **Create repository**
3. In Terminal (in your project folder):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/dispo-crm.git
   git push -u origin main
   ```

### Step 3.2 — Deploy on Vercel

1. Go to **https://vercel.com** and sign up with GitHub
2. Click **Add New Project**
3. Import your `dispo-crm` repository
4. Click **Environment Variables** and add:
   - `NEXT_PUBLIC_SUPABASE_URL` → your Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → your anon key
   - `NEXT_PUBLIC_APP_URL` → (leave blank for now, Vercel will fill it)
5. Click **Deploy**

In ~2 minutes, you'll get a live URL like `https://dispo-crm-yourname.vercel.app`.

### Step 3.3 — Update Supabase redirect URLs

1. In Supabase → **Authentication** → **URL Configuration**
2. Add your Vercel URL to **Redirect URLs**:
   - `https://dispo-crm-yourname.vercel.app/auth/callback`
3. Update **Site URL** to your Vercel URL

### Step 3.4 — Share with your team

Send your team members your Vercel URL. They sign up, get agent access by default. Go to Settings in the app to promote anyone to admin.

---

## PHASE 4 — Desktop App (Mac & Windows)

This wraps your web app into a desktop app people can install and open like any other application.

### Step 4.1 — Install Electron

In your project folder:
```bash
npm install --save-dev electron electron-builder
```

### Step 4.2 — Create the Electron entry file

Create a file called `electron.js` in your project root:

```javascript
const { app, BrowserWindow } = require('electron')
const path = require('path')

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset', // Mac: makes it look native
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, 'public/icon-512.png'),
  })

  // Point to your live Vercel URL
  win.loadURL('https://dispo-crm-yourname.vercel.app')
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
```

### Step 4.3 — Add build config to package.json

Add this to your `package.json`:
```json
"main": "electron.js",
"scripts": {
  "electron": "electron .",
  "electron:build": "electron-builder"
},
"build": {
  "appId": "com.yourcompany.dispocrm",
  "productName": "DispoCRM Pro",
  "mac": { "target": "dmg" },
  "win": { "target": "nsis" }
}
```

### Step 4.4 — Run desktop app locally
```bash
npm run electron
```

### Step 4.5 — Build installer
```bash
npm run electron:build
```
This creates a `.dmg` (Mac) or `.exe` (Windows) in the `dist/` folder. Send this file to your team.

---

## PHASE 5 — Mobile App (iOS & Android)

### Step 5.1 — Install Capacitor

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npx cap init "DispoCRM Pro" "com.yourcompany.dispocrm" --web-dir=out
```

### Step 5.2 — Build the Next.js app for static export

In `next.config.js`, uncomment `output: 'export'`:
```js
const nextConfig = {
  output: 'export',
}
```

Then build:
```bash
npm run build
```

### Step 5.3 — Add platforms

```bash
npx cap add ios
npx cap add android
npx cap copy
```

### Step 5.4 — Open in Xcode / Android Studio

**iOS:**
```bash
npx cap open ios
```
- Xcode opens — click the Play button to run in simulator
- To publish to App Store: requires Apple Developer account ($99/yr), then Archive → Distribute

**Android:**
```bash
npx cap open android
```
- Android Studio opens — click Run
- To publish to Google Play: requires Google Play Developer account ($25 one-time)

### Step 5.5 — Install as PWA on mobile (free, no app store needed)

Your web app already works as a PWA. Tell your team:
1. Open the Vercel URL in **Safari (iPhone)** or **Chrome (Android)**
2. Tap the **Share** button → **Add to Home Screen**
3. It installs like a native app, works offline for cached data

---

## PHASE 6 — Ongoing

### Adding team members
- Send them your Vercel URL
- They sign up
- Go to **Settings** in the app to adjust their role

### Updating the app
Any time you push code changes to GitHub, Vercel auto-deploys in ~2 minutes. No action needed.

### Backups
Use **Settings → Export all data (JSON)** in the app. Supabase also maintains automatic daily backups on paid plans.

### Custom domain (optional, free on Vercel)
1. In Vercel → your project → **Settings** → **Domains**
2. Add a domain you own (e.g., `crm.yourcompany.com`)
3. Follow their DNS instructions — takes ~10 minutes

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Login redirect not working | Check Supabase → Auth → URL Configuration has your URL |
| "Invalid API key" error | Double-check `.env.local` has the right anon key |
| Google login not working | Verify redirect URIs in both Google Console and Supabase |
| Team member can't see data | Check RLS policies ran correctly in SQL Editor |
| Mobile PWA not installing | Must be served over HTTPS (Vercel does this automatically) |

---

## Architecture Summary

```
Your Team
    │
    ├── Browser → Vercel (Next.js web app)
    ├── Desktop → Electron → Vercel URL
    └── Mobile → Capacitor app / PWA → Vercel URL
                         │
                         ▼
                   Supabase (Postgres)
                   ├── Auth (login/JWT)
                   ├── Row Level Security
                   ├── Real-time subscriptions
                   └── Activity logging
```

All clients talk to the same Supabase database. Changes sync instantly across everyone's devices.
