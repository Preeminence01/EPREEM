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

site.use('/api', api);

site.get('/', (_req, res) => res.json({ status: 'EPREEM API is running' }));

site.listen(port, () => {
  console.log(`EPREEM API is running on port ${port}`);
});