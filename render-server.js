const path = require('path');
const fs = require('fs');
const os = require('os');

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON && !process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
  const tmpPath = path.join(os.tmpdir(), 'firebase-service-account.json');
  fs.writeFileSync(tmpPath, process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH = tmpPath;
}

const express = require('express');
const { app: api } = require('./functions');

const port = Number(process.env.PORT) || 3000;
const site = express();

// Render serves the browser application as well as the API. Keep server-only
// code, dependencies, and local credentials out of the static site.
site.use(['/functions', '/node_modules'], (_req, res) => res.sendStatus(404));
site.get('/epreem-fb6b6-firebase-adminsdk-fbsvc-8ff5a4f52a.json', (_req, res) => res.sendStatus(404));
site.use('/api', api);
site.use(express.static(__dirname, { dotfiles: 'deny' }));

site.listen(port, () => {
  console.log(`EPREEM API is running on port ${port}`);
});
