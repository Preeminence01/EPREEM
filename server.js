require('dotenv').config();

const path = require('path');
const express = require('express');
const port = Number(process.env.PORT) || 3000;

// Only used locally. The file is ignored by Git and never sent to the browser.
process.env.FIREBASE_SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  || path.join(__dirname, 'epreem-fb6b6-firebase-adminsdk-fbsvc-8ff5a4f52a.json');

const { app: api } = require('./functions');
const site = express();

// Never expose credentials or installed server dependencies to the browser.
site.get('/epreem-fb6b6-firebase-adminsdk-fbsvc-8ff5a4f52a.json', (_req, res) => res.sendStatus(404));
site.use('/node_modules', (_req, res) => res.sendStatus(404));

// API first, then serve the existing HTML/CSS/JS frontend from this folder.
site.use('/api', api);
site.use(express.static(__dirname, { dotfiles: 'deny' }));

site.listen(port, () => {
  console.log(`EPREEM is running at http://localhost:${port}`);
});
