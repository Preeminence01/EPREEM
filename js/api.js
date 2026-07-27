/* ==========================================================================
   EPREEM — API client
   Thin wrapper around fetch() for the Firebase Cloud Function. Every network call
   in the app goes through here so the transport can change later (e.g. to
   websockets for bidding) without touching page code.
   ========================================================================== */

(function(){
  const BASE = (window.EPREEM_CONFIG && window.EPREEM_CONFIG.API_BASE_URL) || '/api';
  const TOKEN_KEY = 'epreem_token';
  const USER_KEY = 'epreem_user';

  if(location.protocol === 'file:'){
    console.error(
      '[EPREEM] This page was opened directly as a file (' + location.href + '). ' +
      'Browsers block fetch() requests to relative URLs like "' + BASE + '" when the page ' +
      'itself is not served over http(s). You must run this through a local server, e.g.:\n' +
      '  firebase emulators:start --only functions,hosting\n' +
      'and then open http://127.0.0.1:8000/index.html in the browser — not the file directly.'
    );
  }

  function getToken(){ return localStorage.getItem(TOKEN_KEY); }
  function setToken(t){ if(t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); }
  function getUser(){ try{ return JSON.parse(localStorage.getItem(USER_KEY)); }catch(e){ return null; } }
  function setUser(u){ if(u) localStorage.setItem(USER_KEY, JSON.stringify(u)); else localStorage.removeItem(USER_KEY); }

  // The compat build keeps this PWA framework-free while Firebase Auth handles passwords.
  const firebaseReady = new Promise((resolve, reject) => {
    if (window.firebase) return resolve(window.firebase);
    ['https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js', 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js', 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js'].reduce((p, src) => p.then(() => new Promise((ok, fail) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = fail; document.head.appendChild(s); })), Promise.resolve()).then(() => { const cfg = window.EPREEM_CONFIG && window.EPREEM_CONFIG.firebaseConfig; if (!cfg || !cfg.apiKey || cfg.apiKey === 'YOUR_API_KEY') throw new Error('Set firebaseConfig in js/config.js'); if (!window.firebase.apps.length) window.firebase.initializeApp(cfg); resolve(window.firebase); }).catch(reject);
  });
  async function firebaseSignIn(email, password){ const firebase = await firebaseReady; const credential = await firebase.auth().signInWithEmailAndPassword(email, password); const token = await credential.user.getIdToken(); setToken(token); return token; }
  async function firestoreProfile(){
    const firebase = await firebaseReady;
    const account = firebase.auth().currentUser;
    if(!account) throw new Error('Please sign in first.');
    const profile = await firebase.firestore().collection('users').doc(account.uid).get();
    if(!profile.exists) throw new Error('Your account profile has not been set up yet.');
    return { id: account.uid, email: account.email, ...profile.data() };
  }

  async function request(path, { method = 'GET', body, auth = true } = {}){
    const headers = { 'Accept': 'application/json' };
    if(body !== undefined) headers['Content-Type'] = 'application/json';
    const token = getToken();
    if(auth && token) headers['Authorization'] = 'Bearer ' + token;

    const url = BASE + path;

    let res;
    try{
      res = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    }catch(networkErr){
      console.error('[EPREEM] Network request failed for', url, '\nRaw error:', networkErr,
        '\nMost common causes: (1) page opened via file:// instead of a local server, ' +
        '(2) the Firebase emulator or deployed function is unavailable, (3) wrong API_BASE_URL in config.js, (4) CORS blocked by the backend.');
      throw { networkError: true, message: 'Could not reach the EPREEM server. Check your connection.' };
    }

    const rawText = await res.clone().text().catch(() => '');
    let data = null;
    try{ data = rawText ? JSON.parse(rawText) : null; }
    catch(e){
      console.error('[EPREEM] Response from', url, 'was not valid JSON (status ' + res.status + '). ' +
        'This usually means the backend returned an HTML error page (a PHP fatal error, a 404 page, ' +
        'or a redirect) instead of JSON. First 300 chars of response:\n', rawText.slice(0, 300));
    }

    if(!res.ok){
      if(res.status === 401){ setToken(null); setUser(null); }
      const err = new Error((data && data.message) || ('Request failed with status ' + res.status));
      err.status = res.status;
      err.errors = data && data.errors;
      throw err;
    }
    return data;
  }

  const API = {
    // ---- auth ----
    auth: {
      async register(payload){
        const data = await request('/auth/register', { method:'POST', body: payload, auth:false });
        await firebaseSignIn(payload.email, payload.password);
        setUser(data.user);
        return data;
      },
      async login(email, password){
        await firebaseSignIn(email, password);
        const user = await firestoreProfile();
        setUser(user);
        return { user, token: getToken() };
      },
      async logout(){
        try{ const firebase = await firebaseReady; await firebase.auth().signOut(); }catch(e){}
        setToken(null); setUser(null);
      },
      async me(){
        const data = await firestoreProfile();
        setUser(data);
        return data;
      },
      async forgotPassword(email){
        const firebase = await firebaseReady;
        await firebase.auth().sendPasswordResetEmail(email);
        return { message: 'If an account exists for that email, a password reset link has been sent.' };
      },
      async resetPassword(email, token, password){
        const firebase = await firebaseReady;
        await firebase.auth().confirmPasswordReset(token, password);
        return { message: 'Password updated — you can now sign in.' };
      },
      getUser, setUser, getToken, setToken,
      isLoggedIn(){ return !!getToken(); },
    },

    // ---- catalog ----
    categories: {
      list: async () => { const firebase = await firebaseReady; const snapshot = await firebase.firestore().collection('categories').orderBy('name').get(); return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); },
    },
    products: {
      list: (params={}) => request('/products?' + new URLSearchParams(params).toString(), { auth:false }),
      get: (id) => request('/products/' + id, { auth:false }),
      reviews: (id) => request('/products/' + id + '/reviews', { auth:false }),
      addReview: (id, payload) => request('/products/' + id + '/reviews', { method:'POST', body: payload }),
    },
    auctions: {
      list: (params={}) => request('/auctions?' + new URLSearchParams(params).toString(), { auth:false }),
      get: (id) => request('/auctions/' + id, { auth:false }),
      bid: (id, amount) => request('/auctions/' + id + '/bids', { method:'POST', body:{ amount } }),
      watch: (id) => request('/auctions/' + id + '/watch', { method:'POST' }),
    },

    // ---- cart / wishlist ----
    cart: {
      list: () => request('/cart'),
      add: (product_id, quantity=1) => request('/cart', { method:'POST', body:{ product_id, quantity } }),
      update: (itemId, quantity) => request('/cart/' + itemId, { method:'PUT', body:{ quantity } }),
      remove: (itemId) => request('/cart/' + itemId, { method:'DELETE' }),
      applyCoupon: (code) => request('/cart/coupon', { method:'POST', body:{ code } }),
    },
    wishlist: {
      list: () => request('/wishlist'),
      toggle: (product_id) => request('/wishlist/toggle', { method:'POST', body:{ product_id } }),
    },

    // ---- orders ----
    orders: {
      list: () => request('/orders'),
      get: (id) => request('/orders/' + id),
      create: (payload) => request('/orders', { method:'POST', body: payload }),
      dispute: (id, payload) => request('/orders/' + id + '/dispute', { method:'POST', body: payload }),
    },

    // ---- messaging ----
    conversations: {
      list: () => request('/conversations'),
      get: (id) => request('/conversations/' + id),
      start: (payload) => request('/conversations', { method:'POST', body: payload }),
      send: (id, body) => request('/conversations/' + id + '/messages', { method:'POST', body:{ body } }),
    },

    // ---- notifications ----
    notifications: {
      list: () => request('/notifications'),
      markRead: (id) => request('/notifications/' + id + '/read', { method:'PUT' }),
      markAllRead: () => request('/notifications/read-all', { method:'PUT' }),
    },

    // ---- seller ----
    seller: {
      stats: () => request('/seller/stats'),
      products: () => request('/seller/products'),
      createProduct: (payload) => request('/seller/products', { method:'POST', body: payload }),
      updateProduct: (id, payload) => request('/seller/products/' + id, { method:'PUT', body: payload }),
      deleteProduct: (id) => request('/seller/products/' + id, { method:'DELETE' }),
      orders: () => request('/seller/orders'),
      updateOrderStatus: (orderId, fulfillment_status) => request('/seller/orders/' + orderId + '/status', { method:'PUT', body:{ fulfillment_status } }),
    },

    // ---- admin ----
    admin: {
      stats: () => request('/admin/stats'),
      users: async () => { const firebase = await firebaseReady; const snapshot = await firebase.firestore().collection('users').get(); return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); },
      toggleSuspend: (userId) => request('/admin/users/' + userId + '/suspend', { method:'PUT' }),
      pendingSellers: () => request('/admin/sellers/pending'),
      verifySeller: (userId, approve) => request('/admin/sellers/' + userId + '/verify', { method:'PUT', body:{ approve } }),
      promoteSellerToAdmin: (userId) => request('/admin/users/' + userId + '/promote-admin', { method:'PUT' }),
      appointSupportAgent: (userId) => request('/admin/users/' + userId + '/appoint-support', { method:'PUT' }),
      businesses: () => request('/admin/businesses'),
      updateBusinessStatus: (id, status) => request('/admin/businesses/' + id + '/status', { method:'PUT', body:{ status } }),
      listings: async () => { const firebase = await firebaseReady; const snapshot = await firebase.firestore().collection('products').get(); return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); },
      updateListingStatus: async (id, status) => { const firebase = await firebaseReady; await firebase.firestore().collection('products').doc(id).update({ status }); return { message: 'Listing updated' }; },
      createProduct: (payload) => request('/admin/products', { method:'POST', body: payload }),
      disputes: () => request('/admin/disputes'),
      updateDisputeStatus: (id, status) => request('/admin/disputes/' + id + '/status', { method:'PUT', body:{ status } }),
      commissions: () => request('/admin/commissions'),
      updateCommission: (id, rate_percent) => request('/admin/commissions/' + id, { method:'PUT', body:{ rate_percent } }),
    },
  };

  window.EpreemAPI = API;
})();
