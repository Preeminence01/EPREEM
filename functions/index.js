const { onRequest } = require('firebase-functions/v2/https');
const { cert, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const express = require('express');
const cors = require('cors');

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
initializeApp(serviceAccountPath
  ? { credential: cert(require(serviceAccountPath)) }
  : undefined);
const db = getFirestore();
const auth = getAuth();
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

const clean = (snap) => ({ id: snap.id, ...snap.data() });
const requireUser = async (req, res, next) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ message: 'Unauthenticated' });
  try {
    req.user = await auth.verifyIdToken(token);
    const profile = await db.doc(`users/${req.user.uid}`).get();
    req.profile = profile.exists ? profile.data() : {};
    if (req.profile.is_suspended) return res.status(403).json({ message: 'This account has been suspended' });
    next();
  } catch (_) { return res.status(401).json({ message: 'Invalid or expired token' }); }
};
const role = (...allowed) => (req, res, next) => allowed.includes(req.profile.role) ? next() : res.status(403).json({ message: 'Forbidden' });

// Auth is performed with Firebase Auth on the client; this endpoint returns the profile.
app.get('/auth/me', requireUser, async (req, res) => res.json({ id: req.user.uid, email: req.user.email, ...req.profile }));
app.post('/auth/register', async (req, res) => {
  const { name, email, password, phone, reason_for_joining = 'buyer', company_name } = req.body;
  if (!name || !email || !password || password.length < 8) return res.status(422).json({ message: 'Validation failed' });
  try {
    const account = await auth.createUser({ email, password, displayName: name });
    const selling = ['seller', 'both'].includes(reason_for_joining);
    const user = { name, email, phone: phone || null, role: selling ? 'seller' : 'buyer', reason_for_joining, verification_status: selling ? 'pending' : 'verified', is_suspended: false, created_at: FieldValue.serverTimestamp() };
    await db.doc(`users/${account.uid}`).set(user);
    if (selling) await db.collection('businesses').doc(account.uid).set({ owner_id: account.uid, company_name: company_name || name, status: 'pending' });
    res.status(201).json({ message: selling ? 'Account created. Seller access is pending admin approval.' : 'Account created', user: { id: account.uid, ...user } });
  } catch (e) { res.status(400).json({ message: e.code === 'auth/email-already-exists' ? 'Email already registered' : e.message }); }
});

app.get('/categories', async (_req, res) => res.json((await db.collection('categories').orderBy('name').get()).docs.map(clean)));
app.get('/products', async (req, res) => {
  let q = db.collection('products').where('status', '==', 'live');
  if (req.query.category_id) q = q.where('category_id', '==', req.query.category_id);
  const products = (await q.limit(50).get()).docs.map(clean);
  const term = (req.query.search || '').toLowerCase();
  res.json(term ? products.filter(p => `${p.title} ${p.description || ''}`.toLowerCase().includes(term)) : products);
});
app.get('/products/:id', async (req, res) => { const s = await db.doc(`products/${req.params.id}`).get(); return s.exists ? res.json(clean(s)) : res.status(404).json({ message: 'Product not found' }); });
app.post('/seller/products', requireUser, role('seller', 'admin', 'super_admin'), async (req, res) => { const ref = db.collection('products').doc(); const product = { ...req.body, seller_id: req.user.uid, status: req.body.status || 'draft', created_at: FieldValue.serverTimestamp() }; await ref.set(product); res.status(201).json({ id: ref.id, ...product }); });
app.put('/seller/products/:id', requireUser, role('seller', 'admin', 'super_admin'), async (req, res) => { const ref = db.doc(`products/${req.params.id}`); const s = await ref.get(); if (!s.exists) return res.status(404).json({ message: 'Product not found' }); if (s.data().seller_id !== req.user.uid && !['admin','super_admin'].includes(req.profile.role)) return res.status(403).json({ message: 'Forbidden' }); await ref.update({ ...req.body, updated_at: FieldValue.serverTimestamp() }); res.json({ id: ref.id, ...s.data(), ...req.body }); });
app.delete('/seller/products/:id', requireUser, role('seller', 'admin', 'super_admin'), async (req, res) => { await db.doc(`products/${req.params.id}`).delete(); res.status(204).end(); });

app.get('/cart', requireUser, async (req, res) => res.json((await db.collection(`users/${req.user.uid}/cart`).get()).docs.map(clean)));
app.post('/cart', requireUser, async (req, res) => { const ref = db.collection(`users/${req.user.uid}/cart`).doc(); const item = { product_id: req.body.product_id, quantity: Number(req.body.quantity || 1) }; await ref.set(item); res.status(201).json({ id: ref.id, ...item }); });
app.put('/cart/:id', requireUser, async (req, res) => { await db.doc(`users/${req.user.uid}/cart/${req.params.id}`).update({ quantity: Number(req.body.quantity) }); res.json({ message: 'Cart updated' }); });
app.delete('/cart/:id', requireUser, async (req, res) => { await db.doc(`users/${req.user.uid}/cart/${req.params.id}`).delete(); res.status(204).end(); });

app.get('/wishlist', requireUser, async (req, res) => res.json((await db.collection(`users/${req.user.uid}/wishlist`).get()).docs.map(clean)));
app.post('/wishlist/toggle', requireUser, async (req, res) => {
  const ref = db.doc(`users/${req.user.uid}/wishlist/${req.body.product_id}`); const item = await ref.get();
  if (item.exists) { await ref.delete(); return res.json({ wished: false }); }
  await ref.set({ product_id: req.body.product_id, created_at: FieldValue.serverTimestamp() }); res.json({ wished: true });
});

app.get('/auctions', async (_req, res) => res.json((await db.collection('auctions').where('status', '==', 'live').get()).docs.map(clean)));
app.get('/auctions/:id', async (req, res) => { const s = await db.doc(`auctions/${req.params.id}`).get(); return s.exists ? res.json(clean(s)) : res.status(404).json({ message: 'Auction not found' }); });
app.post('/auctions/:id/bids', requireUser, async (req, res) => {
  const auctionRef = db.doc(`auctions/${req.params.id}`); const amount = Number(req.body.amount);
  try { const auction = await db.runTransaction(async t => { const s = await t.get(auctionRef); if (!s.exists) throw new Error('Auction not found'); const data = s.data(); const minimum = Number(data.current_bid || data.starting_price || 0) + Number(data.min_increment || 0); if (!Number.isFinite(amount) || amount < minimum) throw new Error(`Minimum bid is ${minimum}`); t.update(auctionRef, { current_bid: amount, current_bidder_id: req.user.uid, updated_at: FieldValue.serverTimestamp() }); t.set(auctionRef.collection('bids').doc(), { user_id: req.user.uid, amount, created_at: FieldValue.serverTimestamp() }); return { id: s.id, ...data, current_bid: amount, current_bidder_id: req.user.uid }; }); res.status(201).json(auction); } catch (e) { res.status(e.message === 'Auction not found' ? 404 : 422).json({ message: e.message }); }
});
app.post('/auctions/:id/watch', requireUser, async (req, res) => { await db.doc(`auctions/${req.params.id}/watchers/${req.user.uid}`).set({ user_id: req.user.uid, created_at: FieldValue.serverTimestamp() }); res.json({ watching: true }); });

app.get('/orders', requireUser, async (req, res) => res.json((await db.collection('orders').where('buyer_id', '==', req.user.uid).get()).docs.map(clean)));
app.get('/orders/:id', requireUser, async (req, res) => { const s = await db.doc(`orders/${req.params.id}`).get(); return s.exists && (s.data().buyer_id === req.user.uid || ['admin','super_admin','support_agent'].includes(req.profile.role)) ? res.json(clean(s)) : res.status(404).json({ message: 'Order not found' }); });
app.post('/orders', requireUser, async (req, res) => { const ref = db.collection('orders').doc(); const order = { ...req.body, buyer_id: req.user.uid, order_number: `EPR-${Date.now()}`, payment_status: 'pending', fulfillment_status: 'pending', created_at: FieldValue.serverTimestamp() }; await ref.set(order); res.status(201).json({ id: ref.id, ...order }); });

app.get('/notifications', requireUser, async (req, res) => res.json((await db.collection(`users/${req.user.uid}/notifications`).orderBy('created_at', 'desc').limit(50).get()).docs.map(clean)));
app.put('/notifications/:id/read', requireUser, async (req, res) => { await db.doc(`users/${req.user.uid}/notifications/${req.params.id}`).update({ read_at: FieldValue.serverTimestamp() }); res.json({ message: 'Notification marked read' }); });
app.put('/notifications/read-all', requireUser, async (req, res) => { const list = await db.collection(`users/${req.user.uid}/notifications`).where('read_at', '==', null).get(); const batch = db.batch(); list.docs.forEach(s => batch.update(s.ref, { read_at: FieldValue.serverTimestamp() })); await batch.commit(); res.json({ message: 'Notifications marked read' }); });

app.get('/conversations', requireUser, async (req, res) => res.json((await db.collection('conversations').where('participant_ids', 'array-contains', req.user.uid).get()).docs.map(clean)));
app.get('/conversations/:id', requireUser, async (req, res) => { const s = await db.doc(`conversations/${req.params.id}`).get(); if (!s.exists || !(s.data().participant_ids || []).includes(req.user.uid)) return res.status(404).json({ message: 'Conversation not found' }); const messages = (await s.ref.collection('messages').orderBy('created_at').get()).docs.map(clean); res.json({ ...clean(s), messages }); });
app.post('/conversations', requireUser, async (req, res) => { const participant = req.body.user_id || req.body.recipient_id; if (!participant) return res.status(422).json({ message: 'recipient_id is required' }); const ref = db.collection('conversations').doc(); const record = { participant_ids: [req.user.uid, participant], created_at: FieldValue.serverTimestamp() }; await ref.set(record); res.status(201).json({ id: ref.id, ...record }); });
app.post('/conversations/:id/messages', requireUser, async (req, res) => { const ref = db.doc(`conversations/${req.params.id}`); const s = await ref.get(); if (!s.exists || !(s.data().participant_ids || []).includes(req.user.uid)) return res.status(404).json({ message: 'Conversation not found' }); const message = { sender_id: req.user.uid, body: req.body.body, created_at: FieldValue.serverTimestamp() }; const messageRef = await ref.collection('messages').add(message); await ref.update({ last_message: req.body.body, updated_at: FieldValue.serverTimestamp() }); res.status(201).json({ id: messageRef.id, ...message }); });

app.get('/seller/stats', requireUser, role('seller','admin','super_admin'), async (req, res) => { const products = await db.collection('products').where('seller_id', '==', req.user.uid).get(); res.json({ products: products.size, live_products: products.docs.filter(s => s.data().status === 'live').length }); });
app.get('/seller/products', requireUser, role('seller','admin','super_admin'), async (req, res) => res.json((await db.collection('products').where('seller_id', '==', req.user.uid).get()).docs.map(clean)));

app.get('/admin/users', requireUser, role('admin','super_admin'), async (_req, res) => res.json((await db.collection('users').get()).docs.map(clean)));
app.put('/admin/users/:id/suspend', requireUser, role('admin','super_admin'), async (req, res) => { const ref = db.doc(`users/${req.params.id}`); const s = await ref.get(); if (!s.exists) return res.status(404).json({ message: 'User not found' }); await ref.update({ is_suspended: !s.data().is_suspended }); res.json({ message: 'User suspension updated' }); });
app.get('/admin/listings', requireUser, role('admin','super_admin'), async (_req, res) => res.json((await db.collection('products').get()).docs.map(clean)));
app.put('/admin/listings/:id/status', requireUser, role('admin','super_admin'), async (req, res) => { await db.doc(`products/${req.params.id}`).update({ status: req.body.status }); res.json({ message: 'Listing updated' }); });

exports.api = onRequest({ region: 'us-central1' }, app);
exports.app = app;
