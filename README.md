# EPREEM Firebase backend

EPREEM is a static PWA deployed with Firebase Hosting. Its API runs in the Firebase Cloud Function in `functions/index.js`, backed by Firebase Authentication and Cloud Firestore.

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
