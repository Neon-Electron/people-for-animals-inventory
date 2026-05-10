# People for Animals Medicine Inventory

Responsive medicine inventory app for tracking animal-care medicines, stock updates, QR codes, holds, dogs, users, and admin-managed medicine data.

## Local Setup

```bash
npm install
npm run dev
```

Default local admin for local-storage fallback:

```text
User ID: aroragagan09@gmail.com
Password: admin123
```

For Firebase deployments, enable Email/Password sign-in in Firebase Authentication. The account matching `VITE_ADMIN_USER_ID` is treated as the first admin after registration/login.

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

## Firebase Setup

In Firebase Console:

1. Go to **Authentication > Sign-in method**.
2. Enable **Email/Password**.
3. Register the admin account in the app with the email from `VITE_ADMIN_USER_ID`.
4. Register regular users from the app login screen. They can update quantities only.
5. Use the Admin tab to promote users when needed.

Firestore rules are included in `firestore.rules`. Paste them into Firebase Console under **Firestore Database > Rules** and publish them after replacing the admin email if needed. These rules allow regular users to update only `quantity` and `updatedAt` on medicines, while admins can add/delete medicines and manage dogs, data, and users.

## Vercel Build Settings

Vercel detects Vite automatically:

```text
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

The included `vercel.json` routes all app paths back to `index.html`.
