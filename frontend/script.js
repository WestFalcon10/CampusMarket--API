// Use relative URL so it always hits whatever server served this page
const API = '';

// Stripe publishable key (used if switching to Stripe.js Elements in future)
const STRIPE_PUBLISHABLE_KEY = 'pk_test_51Tbik93zThIk0yq4IreCFMlM6xCx24DvO5YidfaBCGJkcVVgNmFzhfTjSFzApJBqWcocxK0A39mQLWUWzbGrJs1J00OYUGkzwp';

const CATEGORIES = {
  1: 'Textbooks', 2: 'Electronics', 3: 'Furniture', 4: 'Clothing',
  5: 'Sports', 6: 'Music', 7: 'Gaming', 8: 'Appliances',
  9: 'Stationery', 10: 'Other',
};

const CONDITION_LABEL = {
  new: 'New', like_new: 'Like New', good: 'Good',
  fair: 'Fair', poor: 'Poor', used: 'Used',
};
const CONDITION_CLASS = {
  new: 'cond-new', like_new: 'cond-likenew', good: 'cond-good',
  fair: 'cond-fair', poor: 'cond-poor', used: 'cond-used',
};

// ── State ─────────────────────────────────────────────
let token           = localStorage.getItem('cm_token') || null;
let currentUser     = JSON.parse(localStorage.getItem('cm_user') || 'null');
let allListings     = [];
let myListingsCache = {}; // id → listing, for edit modal lookup when main grid not loaded
let pendingBuyId        = null;
let ordersData          = [];
let currentOrderTab     = 'buying';
let profileDropdownOpen = false;

// ── Init ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  updateNavbar();
  fetchListings();

  // Image preview for create listing
  const fileInput = document.getElementById('listing-images');
  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const preview = document.getElementById('image-preview');
      const label   = document.getElementById('img-upload-text');
      preview.innerHTML = '';
      const files = Array.from(fileInput.files).slice(0, 5);
      label.textContent = files.length
        ? `📷 ${files.length} file${files.length > 1 ? 's' : ''} selected`
        : '📷 Choose images…';
      files.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const item = document.createElement('div');
          item.className = 'img-preview-item';
          item.innerHTML = `<img src="${ev.target.result}" /><button class="remove-preview" type="button">✕</button>`;
          item.querySelector('.remove-preview').onclick = () => item.remove();
          preview.appendChild(item);
        };
        reader.readAsDataURL(file);
      });
    });
  }
});

// ── Auth state ────────────────────────────────────────
function updateNavbar() {
  const guest = document.getElementById('nav-guest');
  const user  = document.getElementById('nav-user');

  if (token && currentUser) {
    guest.classList.add('hidden');
    user.classList.remove('hidden');
    setAvatarUI(currentUser);
    if (!notifPollInterval) startNotifPolling();
  } else {
    guest.classList.remove('hidden');
    user.classList.add('hidden');
    stopNotifPolling();
    closeProfileDropdown();
  }
}

function setAvatarUI(u) {
  const initial = (u.full_name || '?')[0].toUpperCase();
  const color   = nameToColor(u.full_name || '');

  const btn  = document.getElementById('profile-avatar-btn');
  const span = document.getElementById('avatar-initial');
  const lgAv = document.getElementById('dropdown-avatar-lg');
  if (btn)  btn.style.background = color;
  if (span) span.textContent     = initial;
  if (lgAv) { lgAv.textContent = initial; lgAv.style.background = color; }

  const el = (id) => document.getElementById(id);
  if (el('dropdown-name'))  el('dropdown-name').textContent  = u.full_name  || '';
  if (el('dropdown-email')) el('dropdown-email').textContent = u.email      || '';
  if (el('dropdown-univ'))  el('dropdown-univ').textContent  = u.university || '';
}

function nameToColor(name) {
  const palette = [
    '#4F46E5','#7C3AED','#DB2777','#D97706',
    '#059669','#0891B2','#DC2626','#0284C7',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

function logout() {
  closeProfileDropdown();
  token = null;
  currentUser = null;
  localStorage.removeItem('cm_token');
  localStorage.removeItem('cm_user');
  stopNotifPolling();
  updateNavbar();
  fetchListings();
  showToast('Logged out successfully');
}

// ── Profile dropdown ──────────────────────────────────
function toggleProfileDropdown(e) {
  e.stopPropagation();
  profileDropdownOpen = !profileDropdownOpen;
  document.getElementById('profile-dropdown').classList.toggle('hidden', !profileDropdownOpen);
  if (profileDropdownOpen) loadProfileStats();
}

function closeProfileDropdown() {
  profileDropdownOpen = false;
  document.getElementById('profile-dropdown')?.classList.add('hidden');
}

async function loadProfileStats() {
  if (!token) return;
  try {
    const res  = await fetch(`${API}/users/profile`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!data.success) return;
    const p = data.data;
    const el = (id) => document.getElementById(id);
    if (el('dp-listings')) el('dp-listings').textContent = p.active_listings  ?? '—';
    if (el('dp-orders'))   el('dp-orders').textContent   = p.completed_orders ?? '—';
    if (el('dp-since'))    el('dp-since').textContent    = p.created_at
      ? new Date(p.created_at).getFullYear() : '—';
    // Refresh university in header (may have been updated)
    if (el('dropdown-univ')) el('dropdown-univ').textContent = p.university || '';
  } catch (_) {}
}

// ── Edit Profile modal ────────────────────────────────
async function openEditProfile() {
  if (!token) { openAuth('login'); return; }

  // Pre-fill from localStorage
  document.getElementById('profile-fullname').value  = currentUser.full_name  || '';
  document.getElementById('profile-university').value = currentUser.university || '';
  document.getElementById('profile-phone').value      = '';

  // Fetch phone (not stored in localStorage)
  try {
    const res  = await fetch(`${API}/users/profile`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.success) document.getElementById('profile-phone').value = data.data.phone || '';
  } catch (_) {}

  clearError(document.getElementById('profile-error'));
  document.getElementById('profile-modal').classList.remove('hidden');
}

async function handleEditProfile(e) {
  e.preventDefault();
  const full_name  = document.getElementById('profile-fullname').value.trim();
  const university = document.getElementById('profile-university').value.trim();
  const phone      = document.getElementById('profile-phone').value.trim();
  const errEl      = document.getElementById('profile-error');
  const btn        = document.getElementById('profile-btn');

  clearError(errEl);
  setLoading(btn, 'Saving…');

  try {
    const res  = await fetch(`${API}/users/profile`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ full_name, university, phone }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    // Update local state & localStorage
    currentUser = { ...currentUser, full_name: data.data.full_name, university: data.data.university };
    localStorage.setItem('cm_user', JSON.stringify(currentUser));

    closeModal('profile-modal');
    setAvatarUI(currentUser);       // re-render avatar + dropdown header
    showToast('Profile updated ✅', 'success');
  } catch (err) {
    showError(errEl, err.message || 'Could not update profile.');
  } finally {
    resetLoading(btn, 'Save Changes');
  }
}

// ── Fetch listings ─────────────────────────────────────
async function fetchListings() {
  const keyword  = document.getElementById('search-keyword').value.trim();
  const category = document.getElementById('search-category').value;
  const minPrice = document.getElementById('search-min-price')?.value;
  const maxPrice = document.getElementById('search-max-price')?.value;
  const grid       = document.getElementById('listings-grid');
  const emptyState = document.getElementById('empty-state');
  const countEl    = document.getElementById('listings-count');

  grid.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading listings...</p></div>`;
  emptyState.classList.add('hidden');

  const params = new URLSearchParams();
  if (keyword)  params.set('keyword', keyword);
  if (category) params.set('category_id', category);
  if (minPrice) params.set('minPrice', minPrice);
  if (maxPrice) params.set('maxPrice', maxPrice);

  try {
    const res  = await fetch(`${API}/listings/all?${params}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    allListings = data.data;

    // Update stats
    const statEl = document.getElementById('stat-listings');
    if (statEl) statEl.textContent = allListings.length;

    countEl.textContent = allListings.length
      ? `${allListings.length} listing${allListings.length !== 1 ? 's' : ''}`
      : '';

    if (allListings.length === 0) {
      grid.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }

    grid.innerHTML = allListings.map(renderCard).join('');
  } catch (err) {
    grid.innerHTML = '';
    emptyState.classList.remove('hidden');
    console.error('Fetch listings error:', err);
  }
}

// ── Render card ────────────────────────────────────────
function renderCard(listing) {
  const category      = CATEGORIES[listing.category_id] || 'Other';
  const price         = parseFloat(listing.price).toFixed(2);
  const desc          = listing.description || 'No description provided.';
  const date          = new Date(listing.created_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
  const isOwner       = currentUser && listing.seller_id === currentUser.id;
  const firstImg      = listing.images && listing.images.length > 0 ? listing.images[0] : null;
  const sellerInitial = (listing.seller_name || 'U')[0].toUpperCase();
  const condLabel     = CONDITION_LABEL[listing.condition] || listing.condition || 'Used';
  const condClass     = CONDITION_CLASS[listing.condition] || 'cond-used';

  const mediaHtml = firstImg
    ? `<img class="card-image" src="${escapeHtml(firstImg)}" alt="${escapeHtml(listing.title)}" loading="lazy" />`
    : `<div class="card-img-placeholder"><span>📷</span><p>No Image</p></div>`;

  const heartBtn = !isOwner && token
    ? `<button class="card-heart" onclick="addToWatchlist(${listing.id}, this)" title="Add to Watchlist">♡</button>`
    : '';

  const actionBtns = isOwner
    ? `<div class="card-owner-actions">
        <button class="btn-edit"   onclick="openEditModal(${listing.id})">✏ Edit</button>
        <button class="btn-delete" onclick="deleteListing(${listing.id})">🗑 Delete</button>
       </div>`
    : '';

  const buyBtn = !isOwner && token
    ? `<button class="btn-buy" onclick="openBuyModal(${listing.id})">🛒 Buy</button>`
    : '';

  return `
    <div class="card" data-listing-id="${listing.id}">
      <div class="card-media">
        ${mediaHtml}
        <span class="card-condition ${condClass}">${condLabel}</span>
        ${heartBtn}
      </div>
      <div class="card-body">
        <span class="card-category">${category}</span>
        <h3 class="card-title">${escapeHtml(listing.title)}</h3>
        <p class="card-description">${escapeHtml(desc)}</p>
        <div class="card-seller-row">
          <div class="seller-avatar">${sellerInitial}</div>
          <div class="seller-info">
            <span class="seller-name">${escapeHtml(listing.seller_name || 'Unknown')}</span>
            <span class="seller-univ">${escapeHtml(listing.seller_university || '')}</span>
          </div>
          <span class="card-date">${date}</span>
        </div>
        <div class="card-footer">
          <span class="card-price">$${price}</span>
          ${actionBtns}${buyBtn}
        </div>
      </div>
    </div>`;
}

// ── Category pill filter ───────────────────────────────
function filterCategory(id, el) {
  document.getElementById('search-category').value = id;
  document.querySelectorAll('.pill').forEach((p) => p.classList.remove('active'));
  el.classList.add('active');
  fetchListings();
}

// ── Watchlist ──────────────────────────────────────────
async function addToWatchlist(listingId, btn) {
  if (!token) { openAuth('login'); return; }

  btn.disabled = true;
  btn.textContent = '…';

  try {
    const res  = await fetch(`${API}/watchlist/${listingId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (res.status === 409) {
      btn.textContent = '❤️';
      btn.classList.add('watching');
      return;
    }
    if (!data.success) throw new Error(data.message);

    btn.textContent = '❤️';
    btn.classList.add('watching');
    showToast('Added to watchlist!', 'success');
  } catch (err) {
    btn.disabled = false;
    btn.textContent = '♡';
    showToast(err.message || 'Could not add to watchlist', 'error');
  }
}

// ── Notifications ──────────────────────────────────────
let notifPollInterval = null;
let notifOpen = false;

function startNotifPolling() {
  fetchNotifBadge();
  notifPollInterval = setInterval(fetchNotifBadge, 30000);
}

function stopNotifPolling() {
  clearInterval(notifPollInterval);
  notifPollInterval = null;
}

async function fetchNotifBadge() {
  if (!token) return;
  try {
    const res  = await fetch(`${API}/notifications`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!data.success) return;

    const unread = data.data.filter((n) => !n.is_read).length;
    const badge  = document.getElementById('notif-badge');
    if (unread > 0) {
      badge.textContent = unread > 99 ? '99+' : unread;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
    if (notifOpen) renderNotifList(data.data);
  } catch (_) {}
}

function toggleNotifications(e) {
  e.stopPropagation();
  const dropdown = document.getElementById('notif-dropdown');
  notifOpen = !notifOpen;
  dropdown.classList.toggle('hidden', !notifOpen);
  if (notifOpen) loadNotifications();
}

async function loadNotifications() {
  try {
    const res  = await fetch(`${API}/notifications`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    renderNotifList(data.data);
  } catch (err) {
    document.getElementById('notif-list').innerHTML =
      `<div class="notif-empty">${err.message || 'Could not load notifications.'}</div>`;
  }
}

function renderNotifList(notifications) {
  const list = document.getElementById('notif-list');
  if (notifications.length === 0) {
    list.innerHTML = `<div class="notif-empty">🔔 No notifications yet</div>`;
    return;
  }
  list.innerHTML = notifications.map((n) => `
    <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="markAsRead(${n.id}, this)">
      <span class="notif-msg">${escapeHtml(n.message)}</span>
      <span class="notif-time">${timeAgo(n.created_at)}</span>
    </div>`).join('');
}

async function markAsRead(id, el) {
  if (el.classList.contains('unread')) {
    el.classList.remove('unread');
    try {
      await fetch(`${API}/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchNotifBadge();
    } catch (_) {}
  }
}

async function markAllAsRead() {
  document.querySelectorAll('.notif-item.unread').forEach((el) => el.classList.remove('unread'));
  document.getElementById('notif-badge').classList.add('hidden');
  try {
    const res  = await fetch(`${API}/notifications`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!data.success) return;
    await Promise.all(
      data.data.filter((n) => !n.is_read).map((n) =>
        fetch(`${API}/notifications/${n.id}/read`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        })
      )
    );
  } catch (_) {}
}

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}

document.addEventListener('click', (e) => {
  if (notifOpen && !document.getElementById('bell-btn')?.contains(e.target) &&
      !document.getElementById('notif-dropdown')?.contains(e.target)) {
    notifOpen = false;
    document.getElementById('notif-dropdown')?.classList.add('hidden');
  }
  if (profileDropdownOpen && !document.getElementById('profile-wrapper')?.contains(e.target)) {
    closeProfileDropdown();
  }
});

// ── Watchlist modal ────────────────────────────────────
async function openWatchlist() {
  document.getElementById('watchlist-modal').classList.remove('hidden');
  const body = document.getElementById('watchlist-body');
  body.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>';

  try {
    const res  = await fetch(`${API}/watchlist`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    if (data.data.length === 0) {
      body.innerHTML = `
        <div class="empty-state" style="padding:40px 0">
          <div class="empty-icon">♡</div>
          <h3>Your watchlist is empty</h3>
          <p>Tap ♡ on any listing to save it here.</p>
        </div>`;
      return;
    }

    body.innerHTML = data.data.map((item) => `
      <div class="watchlist-item" id="wl-${item.listing_id}">
        <div class="watchlist-item-info">
          <span class="card-category" style="margin-bottom:4px">${CATEGORIES[item.category_id] || 'Other'}</span>
          <h4 class="watchlist-item-title">${escapeHtml(item.title)}</h4>
          <p class="watchlist-item-desc">${escapeHtml(item.description || 'No description.')}</p>
        </div>
        <div class="watchlist-item-right">
          <span class="card-price" style="font-size:1.1rem">$${parseFloat(item.price).toFixed(2)}</span>
          <button class="btn-remove" onclick="removeFromWatchlist(${item.listing_id})">Remove</button>
        </div>
      </div>`).join('');
  } catch (err) {
    body.innerHTML = `<p class="form-error" style="margin:0">${err.message || 'Could not load watchlist.'}</p>`;
  }
}

async function removeFromWatchlist(itemId) {
  try {
    const res  = await fetch(`${API}/watchlist/${itemId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    document.getElementById(`wl-${itemId}`)?.remove();

    const body = document.getElementById('watchlist-body');
    if (!body.querySelector('.watchlist-item')) {
      body.innerHTML = `
        <div class="empty-state" style="padding:40px 0">
          <div class="empty-icon">♡</div>
          <h3>Your watchlist is empty</h3>
          <p>Tap ♡ on any listing to save it here.</p>
        </div>`;
    }
    showToast('Removed from watchlist', 'success');
  } catch (err) {
    showToast(err.message || 'Could not remove item', 'error');
  }
}

// ── Buy Now / Purchase flow ────────────────────────
function openBuyModal(listingId) {
  if (!token) { openAuth('login'); return; }

  const listing = allListings.find((l) => l.id === listingId);
  if (!listing) return;

  pendingBuyId = listingId;

  document.getElementById('buy-item-title').textContent  = listing.title;
  document.getElementById('buy-item-seller').textContent = `Sold by ${listing.seller_name || 'Unknown'}`;
  document.getElementById('buy-item-price').textContent  = `$${parseFloat(listing.price).toFixed(2)}`;

  const thumbEl = document.getElementById('buy-item-thumb');
  if (listing.images && listing.images.length > 0) {
    thumbEl.className = 'buy-thumb';
    thumbEl.innerHTML = `<img src="${escapeHtml(listing.images[0])}" alt="${escapeHtml(listing.title)}" />`;
  } else {
    thumbEl.className = 'buy-thumb-placeholder';
    thumbEl.textContent = '📷';
  }

  clearError(document.getElementById('buy-error'));
  document.getElementById('buy-modal').classList.remove('hidden');
}

async function confirmPurchase() {
  if (!pendingBuyId) return;
  const btn   = document.getElementById('buy-btn');
  const errEl = document.getElementById('buy-error');
  clearError(errEl);
  setLoading(btn, 'Redirecting to checkout…');

  try {
    const res  = await fetch(`${API}/payments/create-checkout`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ listing_id: pendingBuyId }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    // Redirect to Stripe-hosted checkout page
    window.location.href = data.data.url;
  } catch (err) {
    showError(errEl, err.message || 'Could not start checkout.');
    resetLoading(btn, 'Confirm Purchase');
  }
}

// ── My Orders modal ────────────────────────────────
async function openMyOrders() {
  if (!token) { openAuth('login'); return; }
  document.getElementById('orders-modal').classList.remove('hidden');
  await fetchOrders();
}

async function fetchOrders() {
  const body = document.getElementById('orders-body');
  body.innerHTML = '<div class="loading-state" style="padding:40px 0"><div class="spinner"></div><p>Loading...</p></div>';

  try {
    const res  = await fetch(`${API}/orders`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    ordersData = data.data;
    renderOrders();
  } catch (err) {
    body.innerHTML = `<p class="form-error" style="margin:0">${err.message || 'Could not load orders.'}</p>`;
  }
}

function switchOrderTab(tab) {
  currentOrderTab = tab;
  document.getElementById('tab-buying').classList.toggle('active',  tab === 'buying');
  document.getElementById('tab-selling').classList.toggle('active', tab === 'selling');
  renderOrders();
}

function renderOrders() {
  const body     = document.getElementById('orders-body');
  const filtered = ordersData.filter((o) =>
    currentOrderTab === 'buying' ? o.buyer_id === currentUser.id : o.seller_id === currentUser.id
  );

  if (filtered.length === 0) {
    body.innerHTML = `
      <div class="empty-state" style="padding:48px 0">
        <div class="empty-icon">${currentOrderTab === 'buying' ? '🛒' : '💰'}</div>
        <h3>${currentOrderTab === 'buying' ? 'No purchases yet' : 'No sales yet'}</h3>
        <p>${currentOrderTab === 'buying' ? 'Browse listings and tap Buy to purchase.' : 'Post a listing to start selling!'}</p>
      </div>`;
    return;
  }

  body.innerHTML = filtered.map(renderOrderRow).join('');
}

const ORDER_STATUS_LABEL = { pending: 'Pending', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled' };
const ORDER_STATUS_CLASS = { pending: 'status-pending', confirmed: 'status-confirmed', completed: 'status-completed', cancelled: 'status-cancelled' };

function renderOrderRow(order) {
  const isSeller     = order.seller_id === currentUser.id;
  const date         = new Date(order.created_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
  const price        = parseFloat(order.price).toFixed(2);
  const statusLabel  = ORDER_STATUS_LABEL[order.status] || order.status;
  const statusClass  = ORDER_STATUS_CLASS[order.status] || '';
  const counterparty = isSeller
    ? `Buyer: ${escapeHtml(order.buyer_name  || 'Unknown')}`
    : `Seller: ${escapeHtml(order.seller_name || 'Unknown')}`;

  const thumb = order.listing_images && order.listing_images.length > 0
    ? `<img class="order-thumb" src="${escapeHtml(order.listing_images[0])}" alt="${escapeHtml(order.listing_title || '')}" loading="lazy" />`
    : `<div class="order-thumb-placeholder">📦</div>`;

  // Build action buttons
  let actions = '';
  if (isSeller && order.status === 'pending') {
    actions = `
      <button class="btn-order-action btn-order-confirm" onclick="updateOrderStatus(${order.id},'confirmed')">✓ Confirm</button>
      <button class="btn-order-action btn-order-cancel"  onclick="updateOrderStatus(${order.id},'cancelled')">✕ Cancel</button>`;
  } else if (isSeller && order.status === 'confirmed') {
    actions = `
      <button class="btn-order-action btn-order-complete" onclick="updateOrderStatus(${order.id},'completed')">✔ Complete</button>
      <button class="btn-order-action btn-order-cancel"   onclick="updateOrderStatus(${order.id},'cancelled')">✕ Cancel</button>`;
  } else if (!isSeller && order.status === 'pending') {
    actions = `<button class="btn-order-action btn-order-cancel" onclick="updateOrderStatus(${order.id},'cancelled')">✕ Cancel</button>`;
  }

  return `
    <div class="order-row" id="order-${order.id}">
      ${thumb}
      <div class="order-info">
        <div class="order-title">${escapeHtml(order.listing_title || 'Deleted listing')}</div>
        <div class="order-meta">${counterparty} · ${date}</div>
      </div>
      <div class="order-right">
        <span class="order-price">$${price}</span>
        <span class="status-badge ${statusClass}">${statusLabel}</span>
        ${actions ? `<div class="order-actions">${actions}</div>` : ''}
      </div>
    </div>`;
}

async function updateOrderStatus(orderId, newStatus) {
  try {
    const res  = await fetch(`${API}/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: newStatus }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    // Update local cache and re-render
    const idx = ordersData.findIndex((o) => o.id === orderId);
    if (idx !== -1) ordersData[idx] = { ...ordersData[idx], status: newStatus };
    renderOrders();

    // If cancelled the listing is reactivated — refresh main grid
    if (newStatus === 'cancelled') fetchListings();

    const labels = { confirmed: 'Order confirmed 🎉', completed: 'Order completed ✅', cancelled: 'Order cancelled' };
    showToast(labels[newStatus] || `Order ${newStatus}`, newStatus === 'cancelled' ? 'error' : 'success');
  } catch (err) {
    showToast(err.message || 'Could not update order', 'error');
  }
}

// ── My Listings ────────────────────────────────────
async function openMyListings() {
  if (!token) { openAuth('login'); return; }
  document.getElementById('my-listings-modal').classList.remove('hidden');
  await fetchMyListings();
}

async function fetchMyListings() {
  const body  = document.getElementById('my-listings-body');
  const badge = document.getElementById('my-listings-badge');
  body.innerHTML = '<div class="loading-state" style="padding:40px 0"><div class="spinner"></div><p>Loading...</p></div>';

  try {
    const res  = await fetch(`${API}/listings/my`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    const listings = data.data;

    // Cache all for edit modal lookup
    myListingsCache = {};
    listings.forEach((l) => { myListingsCache[l.id] = l; });

    // Badge
    if (badge) {
      badge.textContent = listings.length;
      badge.classList.toggle('hidden', listings.length === 0);
    }

    if (listings.length === 0) {
      renderMyListingsEmpty();
      return;
    }

    body.innerHTML = listings.map(renderMyListingCard).join('');
  } catch (err) {
    body.innerHTML = `<p class="form-error" style="margin:0">${err.message || 'Could not load your listings.'}</p>`;
  }
}

function renderMyListingCard(listing) {
  const thumb    = listing.images && listing.images.length > 0 ? listing.images[0] : null;
  const price    = parseFloat(listing.price).toFixed(2);
  const category = CATEGORIES[listing.category_id] || listing.category_name || 'Other';
  const date     = new Date(listing.created_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
  const status   = listing.status || 'active';
  const statusLabel = { active: 'Active', inactive: 'Deleted', sold: 'Sold' }[status] || status;
  const statusClass = { active: 'status-active', inactive: 'status-inactive', sold: 'status-sold' }[status] || 'status-inactive';

  const thumbHtml = thumb
    ? `<img class="my-listing-thumb" src="${escapeHtml(thumb)}" alt="${escapeHtml(listing.title)}" loading="lazy" />`
    : `<div class="my-listing-thumb-placeholder">📷</div>`;

  return `
    <div class="my-listing-card" id="ml-${listing.id}">
      ${thumbHtml}
      <div class="my-listing-info">
        <div class="my-listing-title-row">
          <span class="my-listing-title">${escapeHtml(listing.title)}</span>
          <span class="status-badge ${statusClass}">${statusLabel}</span>
        </div>
        <div class="my-listing-meta">${category} · Listed ${date}</div>
      </div>
      <div class="my-listing-right">
        <span class="my-listing-price">$${price}</span>
        <div class="my-listing-actions">
          <button class="btn-edit" onclick="openEditModal(${listing.id})">✏ Edit</button>
          <button class="btn-delete" onclick="deleteListingFromMyListings(${listing.id})">🗑 Delete</button>
        </div>
      </div>
    </div>`;
}

function renderMyListingsEmpty() {
  document.getElementById('my-listings-body').innerHTML = `
    <div class="empty-state" style="padding:48px 0">
      <div class="empty-icon">🏷️</div>
      <h3>No listings yet</h3>
      <p>You haven't posted anything yet.</p>
      <button class="btn btn-primary" style="margin-top:20px;display:inline-flex" onclick="closeModal('my-listings-modal');openCreateListing()">+ Create your first listing</button>
    </div>`;
}

async function deleteListingFromMyListings(id) {
  if (!confirm('Are you sure you want to delete this listing?')) return;
  try {
    const res  = await fetch(`${API}/listings/delete/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    document.getElementById(`ml-${id}`)?.remove();
    document.querySelector(`[data-listing-id="${id}"]`)?.remove();
    delete myListingsCache[id];

    // Update badge count
    const remaining = document.querySelectorAll('#my-listings-body .my-listing-card').length;
    const badge = document.getElementById('my-listings-badge');
    if (badge) { badge.textContent = remaining; badge.classList.toggle('hidden', remaining === 0); }
    if (remaining === 0) renderMyListingsEmpty();

    showToast('Listing deleted', 'success');
  } catch (err) {
    showToast(err.message || 'Could not delete listing', 'error');
  }
}

// ── Delete listing ─────────────────────────────────────
async function deleteListing(id) {
  if (!confirm('Are you sure you want to delete this listing?')) return;
  try {
    const res  = await fetch(`${API}/listings/delete/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    document.querySelector(`[data-listing-id="${id}"]`)?.remove();
    document.getElementById(`ml-${id}`)?.remove();
    delete myListingsCache[id];
    showToast('Listing deleted', 'success');
  } catch (err) {
    showToast(err.message || 'Could not delete listing', 'error');
  }
}

// ── Edit listing ───────────────────────────────────────
function openEditModal(id) {
  const listing = allListings.find((l) => l.id === id) || myListingsCache[id];
  if (!listing) return;

  document.getElementById('edit-id').value         = listing.id;
  document.getElementById('edit-title').value       = listing.title;
  document.getElementById('edit-description').value = listing.description || '';
  document.getElementById('edit-price').value       = parseFloat(listing.price).toFixed(2);
  document.getElementById('edit-category').value    = listing.category_id;
  document.getElementById('edit-condition').value   = listing.condition || '';
  clearError(document.getElementById('edit-error'));
  document.getElementById('edit-modal').classList.remove('hidden');
}

async function handleEditListing(e) {
  e.preventDefault();
  const id          = document.getElementById('edit-id').value;
  const title       = document.getElementById('edit-title').value.trim();
  const description = document.getElementById('edit-description').value.trim();
  const price       = document.getElementById('edit-price').value;
  const category_id = document.getElementById('edit-category').value;
  const condition   = document.getElementById('edit-condition').value;
  const errEl       = document.getElementById('edit-error');
  const btn         = document.getElementById('edit-btn');

  clearError(errEl);
  setLoading(btn, 'Saving...');

  try {
    const res  = await fetch(`${API}/listings/update/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title, description, price: parseFloat(price), category_id: parseInt(category_id), condition }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    closeModal('edit-modal');
    fetchListings();
    if (!document.getElementById('my-listings-modal').classList.contains('hidden')) {
      fetchMyListings();
    }
    showToast('Listing updated successfully', 'success');
  } catch (err) {
    showError(errEl, err.message || 'Could not update listing.');
  } finally {
    resetLoading(btn, 'Save Changes');
  }
}

// ── Auth ───────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  const btn      = document.getElementById('login-btn');

  clearError(errEl);
  setLoading(btn, 'Logging in...');

  try {
    const res  = await fetch(`${API}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    token       = data.data.token;
    currentUser = data.data.user;
    localStorage.setItem('cm_token', token);
    localStorage.setItem('cm_user', JSON.stringify(currentUser));

    closeModal('auth-modal');
    updateNavbar();
    fetchListings();
    showToast(`Welcome back, ${currentUser.full_name.split(' ')[0]}! 🎉`, 'success');
  } catch (err) {
    showError(errEl, err.message || 'Login failed. Please try again.');
  } finally {
    resetLoading(btn, 'Log In');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const full_name  = document.getElementById('reg-fullname').value.trim();
  const email      = document.getElementById('reg-email').value.trim();
  const password   = document.getElementById('reg-password').value;
  const university = document.getElementById('reg-university').value.trim();
  const errEl      = document.getElementById('register-error');
  const btn        = document.getElementById('register-btn');

  clearError(errEl);
  setLoading(btn, 'Creating account...');

  try {
    const res  = await fetch(`${API}/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name, email, password, university }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    showToast('Account created! Please log in. 🎉', 'success');
    switchTab('login');
    document.getElementById('login-email').value = email;
  } catch (err) {
    showError(errEl, err.message || 'Registration failed. Please try again.');
  } finally {
    resetLoading(btn, 'Create Account');
  }
}

// ── Create listing ─────────────────────────────────────
async function handleCreateListing(e) {
  e.preventDefault();
  const title       = document.getElementById('listing-title').value.trim();
  const description = document.getElementById('listing-description').value.trim();
  const price       = document.getElementById('listing-price').value;
  const category_id = document.getElementById('listing-category').value;
  const condition   = document.getElementById('listing-condition').value || 'used';
  const errEl       = document.getElementById('listing-error');
  const btn         = document.getElementById('listing-btn');

  clearError(errEl);
  setLoading(btn, 'Posting...');

  try {
    const fd = new FormData();
    fd.append('title',       title);
    fd.append('description', description);
    fd.append('price',       price);
    fd.append('category_id', category_id);
    fd.append('condition',   condition);

    const fileInput = document.getElementById('listing-images');
    if (fileInput && fileInput.files.length) {
      Array.from(fileInput.files).slice(0, 5).forEach((f) => fd.append('images', f));
    }

    const res  = await fetch(`${API}/listings/add`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    closeModal('listing-modal');
    document.getElementById('image-preview').innerHTML = '';
    fetchListings();
    showToast('Listing posted successfully! 🎉', 'success');
  } catch (err) {
    showError(errEl, err.message || 'Could not post listing.');
  } finally {
    resetLoading(btn, 'Post Listing');
  }
}

// ── Modal helpers ──────────────────────────────────────
function openAuth(tab = 'login') {
  document.getElementById('auth-modal').classList.remove('hidden');
  switchTab(tab);
}

function openCreateListing() {
  if (!token) { openAuth('login'); return; }
  document.getElementById('listing-form').reset();
  document.getElementById('image-preview').innerHTML = '';
  document.getElementById('img-upload-text').textContent = '📷 Choose images…';
  document.getElementById('listing-modal').classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

function closeModalOnOverlay(e, id) {
  if (e.target === e.currentTarget) closeModal(id);
}

function switchTab(tab) {
  document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
  document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
  clearError(document.getElementById('login-error'));
  clearError(document.getElementById('register-error'));
}

// ── Form helpers ───────────────────────────────────────
function showError(el, msg)  { el.textContent = msg; el.classList.remove('hidden'); }
function clearError(el)      { el.textContent = ''; el.classList.add('hidden'); }
function setLoading(btn, t)  { btn.disabled = true;  btn.textContent = t; }
function resetLoading(btn,t) { btn.disabled = false; btn.textContent = t; }

// ── Toast ──────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast${type ? ' ' + type : ''} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

// ── Search debounce ────────────────────────────────────
let searchTimer;
function debounceSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(fetchListings, 400);
}

// ── Escape HTML ────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
