# People for Animals Medicine Inventory

Responsive medicine inventory app for tracking animal-care medicines, stock updates, QR codes, holds, dogs, users, and admin-managed medicine data.

## Local Setup

```bash
npm install
npm run dev
```

Default local admin:

```text
User ID: aroragagan09@gmail.com
Password: admin123
```

For deployment, set a strong password in Vercel instead of relying on the local fallback.

## Vercel Environment Variables

Add these in Vercel project settings under **Settings > Environment Variables**:

```env
VITE_ADMIN_USER_ID=aroragagan09@gmail.com
VITE_ADMIN_PASSWORD=your-strong-password
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

If Firebase variables are omitted, the app runs in browser local storage mode. For shared production use, configure Firebase so all admins see the same data.

## Vercel Build Settings

Vercel detects Vite automatically:

```text
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

The included `vercel.json` routes all app paths back to `index.html`.
