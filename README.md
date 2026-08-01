# EPREEM Firebase backend

EPREEM is a static PWA that can be deployed with Firebase Hosting or served by Render. Its API is backed by Firebase Authentication and Cloud Firestore.

## Setup

1. Create a Firebase project and enable **Authentication > Email/Password** and **Firestore Database**.
2. Add the Firebase web app configuration to `js/config.js`.
3. Replace `YOUR_FIREBASE_PROJECT_ID` in `.firebaserc` with your Firebase project ID.
4. Install dependencies and deploy:

```powershell
npm.cmd install --prefix functions
npm.cmd install -g firebase-tools
firebase login
firebase deploy --only functions,hosting,firestore:rules
```

Firebase Hosting serves the PWA and rewrites `/api/**` to the Cloud Function.

## Render

Render should use the repository root, run `npm install`, and start the service with `npm start`. Set `FIREBASE_SERVICE_ACCOUNT_JSON` to the complete Firebase service-account JSON string. The `render-server.js` entrypoint serves both the PWA and `/api` routes; it does not expose the service-account file or backend source directory.
