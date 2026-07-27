/* ==========================================================================
   EPREEM — Eternal Preeminence
   Global application script
   Talks to the Laravel API (see js/api.js) for all live data. Shared across
   every page: header/footer render, auth state, cart/wishlist, product
   card rendering, toasts, countdowns, PWA install/service-worker hookup.
   ========================================================================== */

(function(){

const api = window.EpreemAPI;

// --- Fail loudly instead of silently if api.js didn't load / didn't run first ---
if(!api){
  console.error('[EPREEM] window.EpreemAPI is undefined. Check that api.js loaded ' +
    'BEFORE app.js, and that api.js has no thrown errors (open the Network tab ' +
    'and confirm config.js / api.js both return 200, not 404).');
}

/* ---------------------------------------------------------------------
   0. SERVICE WORKER / PWA
   --------------------------------------------------------------------- */
if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}

let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const btn = document.getElementById('installAppBtn');
  if(btn) btn.style.display = 'inline-flex';
});
window.promptInstallApp = async function(){
  if(!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
};

/* ---------------------------------------------------------------------
   1. LOCAL CACHES  (counts only — source of truth is always the API)
   --------------------------------------------------------------------- */
let cartCache = [];
let wishlistCache = [];
let notifUnreadCache = 0;

async function refreshCounts(){
  if(!api || !api.auth.isLoggedIn()){
    cartCache = []; wishlistCache = []; notifUnreadCache = 0;
    paintCounts();
    return;
  }
  try{
    const [cart, wishlist, notifs] = await Promise.all([api.cart.list(), api.wishlist.list(), api.notifications.list()]);
    cartCache = cart.items || [];
    wishlistCache = wishlist || [];
    notifUnreadCache = (notifs || []).filter(n => !n.read_at).length;
  }catch(e){ console.error('[EPREEM] refreshCounts failed:', e); }
  paintCounts();
}

function paintCounts(){
  const cartEl = document.getElementById('cartCount');
  const wishEl = document.getElementById('wishCount');
  const notifEl = document.getElementById('notifCount');
  if(cartEl) cartEl.textContent = cartCache.reduce((n,i)=>n+i.quantity,0);
  if(wishEl) wishEl.textContent = wishlistCache.length;
  if(notifEl) notifEl.textContent = notifUnreadCache;
}

async function addToCart(productId, qty){
  if(!requireAuth('add items to your cart')) return;
  try{
    await api.cart.add(productId, qty || 1);
    toast('Added to cart');
    refreshCounts();
  }catch(e){ toast(e.message || 'Could not add to cart'); }
}

async function removeFromCart(itemId){
  try{
    await api.cart.remove(itemId);
    toast('Removed from cart');
    refreshCounts();
    if(typeof window.renderCartPage === 'function') window.renderCartPage();
  }catch(e){ toast(e.message || 'Could not remove item'); }
}

async function toggleWishlist(productId, btnEl){
  if(!requireAuth('save items to your wishlist')) return;
  try{
    const res = await api.wishlist.toggle(productId);
    if(btnEl) btnEl.classList.toggle('active', res.saved);
    document.querySelectorAll('[data-fav="'+productId+'"]').forEach(el => el.classList.toggle('active', res.saved));
    toast(res.message);
    refreshCounts();
  }catch(e){ toast(e.message || 'Could not update wishlist'); }
}

function requireAuth(actionPhrase){
  if(api && api.auth.isLoggedIn()) return true;
  const registerAsBuyer = window.confirm('To ' + actionPhrase + ', create an account. Press OK for Buyer or Cancel for Seller.');
  toast('Create your ' + (registerAsBuyer ? 'buyer' : 'seller') + ' account to continue');
  setTimeout(() => location.href = 'register.html?role=' + (registerAsBuyer ? 'buyer' : 'seller'), 900);
  return false;
}

window.Cart = { add:addToCart, remove:removeFromCart, list: () => cartCache };
window.Wishlist = { toggle:toggleWishlist, list: () => wishlistCache };
window.Auth = {
  getUser: () => api ? api.auth.getUser() : null,
  isLoggedIn: () => api ? api.auth.isLoggedIn() : false,
  async logout(){ if(api) await api.auth.logout(); location.href = 'index.html'; },
};

/* ---------------------------------------------------------------------
   2. HEADER / FOOTER
   --------------------------------------------------------------------- */
let categoryCache = [];
async function loadCategories(){
  if(!api) return (categoryCache = []);
  try{ categoryCache = await api.categories.list(); }
  catch(e){ console.error('[EPREEM] loadCategories failed:', e); categoryCache = []; }
  return categoryCache;
}

function headerHTML(categories){
  const user = api ? api.auth.getUser() : null;
  const adminRoles = ['admin', 'super_admin'];
  // FIX: the nested ternary below was missing its else-branch, which is a
  // JavaScript syntax error. A syntax error anywhere in this file stops the
  // ENTIRE script from parsing, so mountLayout() never ran and the header/
  // footer/search-bar/nav never got injected into #site-header / #site-footer.
  const accountHref = user && user.role === 'seller' && user.verification_status === 'verified'
    ? 'seller-dashboard.html'
    : (user && adminRoles.includes(user.role) ? 'admin-dashboard.html' : 'profile.html');
  return `
  <header class="site-header">
    <div class="header-top wrap">
      <a href="index.html" class="logo">
        <img class="logo-image" src="logo.jpg" alt="EPREEM" />
        <span class="tag">Eternal Preeminence</span>
      </a>
      <form class="search-bar" onsubmit="event.preventDefault(); location.href='browse.html?q='+encodeURIComponent(this.q.value);">
        <input name="q" type="search" placeholder="Search jewelry, estates, vehicles, equipment\u2026" />
        <button type="submit" aria-label="Search">⌕</button>
      </form>
      <div class="header-actions">
        <a class="icon-btn" href="browse.html" title="Search" aria-label="Search">⌕</a>
        <a class="icon-btn" href="notifications.html" title="Notifications" aria-label="Notifications">
          🔔<span class="badge-count" id="notifCount">0</span>
        </a>
        <a class="icon-btn" href="profile.html#saved" title="Saved items" aria-label="Saved items">
          ♡<span class="badge-count" id="wishCount">0</span>
        </a>
        <a class="icon-btn" href="messages.html" title="Messages" aria-label="Messages">✉</a>
        <a class="icon-btn" href="cart.html" title="Cart" aria-label="Cart">
          ⛁<span class="badge-count" id="cartCount">0</span>
        </a>
        <button id="installAppBtn" class="btn btn-line btn-sm" style="display:none;" onclick="promptInstallApp()">Install App</button>
        ${user
          ? `<a class="btn btn-line btn-sm" href="${accountHref}">${user.name.split(' ')[0]}</a>`
          : `<a class="btn btn-line btn-sm" href="login.html">Sign In</a>`
        }
        <button class="mobile-toggle" aria-label="Menu" onclick="document.querySelector('.cat-nav').classList.toggle('force-open')">☰</button>
      </div>
    </div>
    <nav class="cat-nav" aria-label="Main navigation">
      <div class="wrap">
        <a href="index.html">Home</a>
        <a href="browse.html">Browse</a>
        <a href="auctions.html">Auctions</a>
        <a href="product.html">Product</a>
        <a href="cart.html">Cart</a>
        <a href="checkout.html">Checkout</a>
        <a href="order-detail.html">Order details</a>
        <a href="messages.html">Messages</a>
        <a href="notifications.html">Notifications</a>
        <a href="profile.html">Profile</a>
        <a href="seller-dashboard.html">Seller dashboard</a>
        <a href="about.html">About</a>
        <a href="trust.html">Trust</a>
        <a href="support.html">Support</a>
        <a href="terms.html">Terms</a>
        <a href="login.html">Sign in</a>
        <a href="register.html">Register</a>
        <a href="forgot-password.html">Forgot password</a>
        <a href="reset-password.html">Reset password</a>
        <a href="admin-login.html">Admin sign in</a>
        <a href="admin-dashboard.html">Admin dashboard</a>
        ${categories.map(c => `<a href="browse.html?cat=${c.slug}">${c.icon || '◆'} ${c.name}</a>`).join('')}
        <a href="auctions.html" style="color:var(--gold-bright)">🔔 Live Auctions</a>
        <a href="seller-dashboard.html">Sell on EPREEM</a>
      </div>
    </nav>
  </header>`;
}

function footerHTML(){
  return `
  <footer class="site-footer">
    <div class="wrap">
      <div class="footer-grid">
        <div class="footer-about">
          <img class="footer-logo-image" src="logo.jpg" alt="EPREEM" />
          <p>A private marketplace for buying, selling, renting and auctioning high-value jewelry, property, vehicles and equipment, with verified sellers and secure escrow-backed payments.</p>
        </div>
        <div>
          <h4>Marketplace</h4>
          <ul>
            <li><a href="browse.html">Browse all</a></li>
            <li><a href="auctions.html">Live auctions</a></li>
            <li><a href="browse.html?cat=real-estate">Real estate</a></li>
            <li><a href="browse.html?cat=automotive">Automotive</a></li>
          </ul>
        </div>
        <div>
          <h4>Sell</h4>
          <ul>
            <li><a href="seller-dashboard.html">Seller dashboard</a></li>
            <li><a href="register.html">Become a seller</a></li>
            <li><a href="register.html">Business accounts</a></li>
            <li><a href="#">Commission rates</a></li>
          </ul>
        </div>
        <div>
          <h4>Account</h4>
          <ul>
            <li><a href="profile.html">My profile</a></li>
            <li><a href="cart.html">Cart</a></li>
            <li><a href="messages.html">Messages</a></li>
            <li><a href="login.html">Sign in</a></li>
          </ul>
        </div>
        <div>
          <h4>Company</h4>
          <ul>
            <li><a href="about.html">About EPREEM</a></li>
            <li><a href="trust.html">Trust & verification</a></li>
            <li><a href="support.html">Support</a></li>
            <li><a href="terms.html">Terms & privacy</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© 2026 EPREEM — Eternal Preeminence. All rights reserved.</span>
        <span>Secured checkout · HTTPS encrypted · PWA ready</span>
      </div>
    </div>
  </footer>`;
}

function mobileMarketNavHTML(){
  const page = location.pathname.split('/').pop() || 'index.html';
  if(page.startsWith('admin-')) return '';
  const active = (pages) => pages.includes(page) ? ' active' : '';
  return `
  <nav class="mobile-market-nav" aria-label="Mobile navigation">
    <a class="${active(['index.html', 'index.html'])}" href="index.html"><span aria-hidden="true">⌂</span>Home</a>
    <a class="${active(['profile.html'])}" href="profile.html#saved"><span aria-hidden="true">♡</span>Saved</a>
    <a class="${active(['seller-dashboard.html'])}" href="seller-dashboard.html"><span aria-hidden="true">⊞</span>Sell</a>
    <a class="${active(['messages.html'])}" href="messages.html"><span aria-hidden="true">◫</span>Messages</a>
    <a class="${active(['login.html', 'register.html'])}" href="profile.html"><span aria-hidden="true">◯</span>Profile</a>
  </nav>`;
}

async function mountLayout(){
  const h = document.getElementById('site-header');
  const f = document.getElementById('site-footer');
  let categories = [];

  // Draw the site shell immediately. Firebase/category loading must never hide
  // the logo, navigation icons, or footer on a slow/offline connection.
  try{
    if(h) h.innerHTML = headerHTML(categories);
    if(f) f.innerHTML = footerHTML();
    const mobileNav = mobileMarketNavHTML();
    if(mobileNav && !document.querySelector('.mobile-market-nav')) {
      document.body.insertAdjacentHTML('beforeend', mobileNav);
    }
  }catch(e){
    console.error('[EPREEM] mountLayout: rendering header/footer failed', e);
    return;
  }

  try{
    categories = await loadCategories();
  }catch(e){
    console.error('[EPREEM] mountLayout: loadCategories threw, continuing with []', e);
  }

  // Add category links once Firestore/Firebase has finished loading.
  try{
    if(h) h.innerHTML = headerHTML(categories);
  }catch(e){
    console.error('[EPREEM] mountLayout: rendering categories failed', e);
  }
  refreshCounts();
  document.dispatchEvent(new CustomEvent('epreem:layout-ready', { detail: { categories } }));
}

/* ---------------------------------------------------------------------
   3. SHARED COMPONENT BUILDERS
   --------------------------------------------------------------------- */
function money(n, currency = 'USD'){
  return new Intl.NumberFormat(currency === 'NGN' ? 'en-NG' : 'en-US', {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(Number(n || 0));
}

// Normalizes a product coming from the API (Eloquent shapes) into what the card needs.
function productCard(p){
  const isAuction = p.listing_type === 'auction' && p.auction;
  const canSeePrice = api ? api.auth.isLoggedIn() : false;
  const wished = wishlistCache.some(w => w.product_id === p.id || (w.product && w.product.id === p.id));
  const catIcon = p.category ? (p.category.icon || '◆') : '◆';
  const catName = p.category ? p.category.name : '';
  const catSlug = p.category ? p.category.slug : '';
  const sellerName = p.seller ? p.seller.name : '';
  const img = (p.images && p.images.length) ? p.images[0].url : null;
  const bidsCount = isAuction ? (p.auction.bids_count ?? (p.auction.bids ? p.auction.bids.length : 0)) : 0;
  const endsAt = isAuction ? new Date(p.auction.ends_at).getTime() : null;
  const saleChannel = p.sale_channel === 'wholesale' ? 'Wholesale' : (p.sale_channel === 'both' ? 'Retail / Wholesale' : '');
  const sellerMeta = sellerName ? `<span class="card-seller"><span aria-hidden="true">✓</span> Verified seller</span>` : '';

  return `
  <a class="card" href="product.html?id=${p.id}">
    <div class="card-media">
      ${isAuction ? `<span class="card-tag">Live Auction</span>` : (p.old_price ? `<span class="card-tag">Featured</span>` : '')}
      <span class="card-fav ${wished?'active':''}" data-fav="${p.id}" onclick="event.preventDefault(); Wishlist.toggle(${p.id}, this)">♡</span>
      ${img ? `<img src="${img}" alt="${p.title}" loading="lazy" />` : `<span>${catIcon}</span>`}
    </div>
    <div class="card-body">
      <span class="card-cat">${saleChannel || catName}</span>
      ${sellerMeta}
      <span class="card-title">${p.title}</span>
      <span class="card-meta">${p.location || ''} · ${p.condition || ''}</span>
      <div class="card-foot">
        <span class="card-price">${canSeePrice ? `${money(isAuction ? (p.auction.current_bid || p.price) : p.price, p.currency)}${isAuction?'<small>current bid</small>':''}` : '<small>Sign in for price</small>'}</span>
        ${isAuction ? '' : `<button class="btn btn-line btn-sm" onclick="event.preventDefault(); Cart.add(${p.id})">${canSeePrice ? 'Add' : 'Sign in'}</button>`}
      </div>
      ${isAuction ? `<div class="card-auction-meta"><span>${bidsCount} bids</span><b data-countdown="${endsAt}">--:--:--</b></div>` : ''}
    </div>
  </a>`;
}

function renderCards(containerId, items){
  const el = document.getElementById(containerId);
  if(!el) return;
  if(!items || !items.length){
    el.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div style="font-size:34px;">◇</div><h3>Nothing here yet</h3><p>Check back soon.</p></div>`;
    return;
  }
  el.innerHTML = items.map(productCard).join('');
  tickCountdowns();
}

function tickCountdowns(){
  document.querySelectorAll('[data-countdown]').forEach(el => {
    const end = Number(el.dataset.countdown);
    if(!end){ el.textContent = '--:--:--'; return; }
    const diff = Math.max(0, end - Date.now());
    const h = String(Math.floor(diff/3600000)).padStart(2,'0');
    const m = String(Math.floor((diff%3600000)/60000)).padStart(2,'0');
    const s = String(Math.floor((diff%60000)/1000)).padStart(2,'0');
    el.textContent = `${h}:${m}:${s}`;
  });
}
setInterval(tickCountdowns, 1000);

/* ---------------------------------------------------------------------
   4. TOASTS
   --------------------------------------------------------------------- */
function toast(msg){
  let stack = document.querySelector('.toast-stack');
  if(!stack){ stack = document.createElement('div'); stack.className = 'toast-stack'; document.body.appendChild(stack); }
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  stack.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}
window.toast = toast;

/* ---------------------------------------------------------------------
   5. TABS  (generic, used on product detail page)
   --------------------------------------------------------------------- */
window.initTabs = function(scopeSelector){
  const scope = document.querySelector(scopeSelector) || document;
  scope.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      scope.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      scope.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      scope.querySelector('#' + btn.dataset.tab).classList.add('active');
    });
  });
};

function initPasswordVisibility(){
  document.querySelectorAll('input[type="password"]').forEach(input => {
    if(input.closest('.password-control')) return;

    const control = document.createElement('div');
    control.className = 'password-control';
    input.parentNode.insertBefore(control, input);
    control.appendChild(input);

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'password-toggle';
    toggle.setAttribute('aria-label', 'Show password');
    toggle.setAttribute('aria-pressed', 'false');
    toggle.textContent = 'Show';
    toggle.addEventListener('click', () => {
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      toggle.textContent = isHidden ? 'Hide' : 'Show';
      toggle.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
      toggle.setAttribute('aria-pressed', String(isHidden));
    });
    control.appendChild(toggle);
  });
}

/* ---------------------------------------------------------------------
   6. INIT
   --------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  initPasswordVisibility();
  mountLayout();
});

window.EpreemUI = { money, productCard, renderCards, headerHTML, footerHTML, tickCountdowns };

})();