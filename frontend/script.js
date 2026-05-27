const API = 'http://localhost:3000';

const CATEGORIES = {
  1: 'Textbooks', 2: 'Electronics', 3: 'Furniture', 4: 'Clothing',
  5: 'Sports', 6: 'Music', 7: 'Gaming', 8: 'Appliances',
  9: 'Stationery', 10: 'Other',
};

// ── State ────────────────────────────────────────────
let token = localStorage.getItem('cm_token') || null;
let currentUser = JSON.parse(localStorage.getItem('cm_user') || 'null');
let allListings = [];

// ── Init ─────────────────────────────────────────────
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
  const name  = document.getElementById('nav-username');

  if (token && currentUser) {
    guest.classList.add('hidden');
    user.classList.remove('hidden');
    name.textContent = `Hi, ${currentUser.full_name.split(' ')[0]}`;
    if (!notifPollInterval) startNotifPolling();
  } else {
    guest.classList.remove('hidden');
    user.classList.add('hidden');
    stopNotifPolling();
  }
}

function logout() {
  token = null;
  currentUser = null;
  localStorage.removeItem('cm_token');
  localStorage.removeItem('cm_user');
  stopNotifPolling();
  updateNavbar();
  fetchListings();
  showToast('Logged out successfully');
}

// ── Fetch listings ─────────────────────────────────────
async function fetchListings() {
  const keyword    = document.getElementById('search-keyword').value.trim();
  const category   = document.getElementById('search-category').value;
  const grid       = document.getElementById('listings-grid');
  const emptyState = document.getElementById('empty-state');
  const countEl    = document.getElementById('listings-count');

  grid.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading listings...</p>
    </div>`;
  emptyState.classList.add('hidden');

  const params = new URLSearchParams();
  if (keyword)  params.set('keyword', keyword);
  if (category) params.set('category_id', category);

  try {
    const res  = await fetch(`${API}/listings/all?${params}`);
    const data = await res.json();

    if (!data.success) throw new Error(data.message);

    allListings = data.data;
    countEl.textContent = allListings.length ? `${allListings.length} listing${allListings.length !== 1 ? 's' : ''}` : '';

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

function renderCard(listing) {
  const category  = CATEGORIES[listing.category_id] || 'Other';
  const price     = parseFloat(listing.price).toFixed(2);
  const desc      = listing.description || 'No description provided.';
  const date      = new Date(listing.created_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
  const isOwner   = currentUser && listing.seller_id === currentUser.id;
  const firstImg  = listing.images && listing.images.length > 0 ? listing.images[0] : null;

  const imageHtml = firstImg
    ? `<img class="card-image" src="${escapeHtml(firstImg)}" alt="${escapeHtml(listing.title)}" loading="lazy" />`
    : `<div class="card-img-placeholder"><span>📷</span>No Image</div>`;

  const actionBtn = isOwner
    ? `<div class="card-actions">
        <button class="btn-edit"   onclick="openEditModal(${listing.id})">✏ Edit</button>
        <button class="btn-delete" onclick="deleteListing(${listing.id})">🗑 Delete</button>
       </div>`
    : (token ? `<button class="btn-watch" onclick="addToWatchlist(${listing.id}, this)">♡ Watchlist</button>` : '');

  return `
    <div class="card" data-listing-id="${listing.id}">
      ${imageHtml}
      <span class="card-badge">${category}</span>
      <h3 class="card-title">${escapeHtml(listing.title)}</h3>
      <p class="card-description">${escapeHtml(desc)}</p>
      <p class="card-seller">Sold by: <strong>${escapeHtml(listing.seller_name || 'Unknown')}</strong></p>
      <p class="card-university">${escapeHtml(listing.seller_university || '')}</p>
      <div class="card-footer">
        <span class="card-price">$${price}</span>
        <span class="card-date">${date}</span>
      </div>
      ${actionBtn}
    </div>`;
}

// ── Watchlist ──────────────────────────────────────────
async function addToWatchlist(listingId, btn) {
  if (!token) { openAuth('login'); return; }

  btn.disabled = true;
  btn.textContent = 'Adding...';

  try {
    const res  = await fetch(`${API}/watchlist/${listingId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (res.status === 409) {
      btn.textContent = '✓ Watching';
      btn.classList.add('watching');
      return;
    }
    if (!data.success) throw new Error(data.message);

    btn.textContent = '✓ Watching';
    btn.classList.add('watching');
    showToast('Added to watchlist!', 'success');
  } catch (err) {
    btn.disabled = false;
    btn.textContent = '♡ Watchlist';
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
    const res  = await fetch(`${API}/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    });
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
    const res  = await fetch(`${API}/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    });
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
    list.innerHTML = `<div class="notif-empty"><div class="empty-icon">🔔</div>No notifications yet</div>`;
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
  const items = document.querySelectorAll('.notif-item.unread');
  items.forEach((el) => el.classList.remove('unread'));
  document.getElementById('notif-badge').classList.add('hidden');

  try {
    const res  = await fetch(`${API}/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!data.success) return;

    const unread = data.data.filter((n) => !n.is_read);
    await Promise.all(unread.map((n) =>
      fetch(`${API}/notifications/${n.id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
    ));
  } catch (_) {}
}

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)   return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (notifOpen && !document.getElementById('bell-btn')?.contains(e.target) &&
      !document.getElementById('notif-dropdown')?.contains(e.target)) {
    notifOpen = false;
    document.getElementById('notif-dropdown')?.classList.add('hidden');
  }
});

// ── Watchlist modal ────────────────────────────────────
async function openWatchlist() {
  document.getElementById('watchlist-modal').classList.remove('hidden');
  const body = document.getElementById('watchlist-body');
  body.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>';

  try {
    const res  = await fetch(`${API}/watchlist`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (!data.success) throw new Error(data.message);

    if (data.data.length === 0) {
      body.innerHTML = `
        <div class="empty-state" style="padding:40px 0">
          <div class="empty-icon">♡</div>
          <h3>Your watchlist is empty</h3>
          <p>Click "♡ Watchlist" on any listing to save it here.</p>
        </div>`;
      return;
    }

    body.innerHTML = data.data.map((item) => `
      <div class="watchlist-item" id="wl-${item.listing_id}">
        <div class="watchlist-item-info">
          <span class="card-badge" style="margin-bottom:4px">${CATEGORIES[item.category_id] || 'Other'}</span>
          <h4 class="watchlist-item-title">${escapeHtml(item.title)}</h4>
          <p class="watchlist-item-desc">${escapeHtml(item.description || 'No description.')}</p>
        </div>
        <div class="watchlist-item-right">
          <span class="card-price">$${parseFloat(item.price).toFixed(2)}</span>
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
          <p>Click "♡ Watchlist" on any listing to save it here.</p>
        </div>`;
    }

    showToast('Removed from watchlist', 'success');
  } catch (err) {
    showToast(err.message || 'Could not remove item', 'error');
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

    const card = document.querySelector(`[data-listing-id="${id}"]`);
    if (card) card.remove();

    showToast('Listing deleted', 'success');
  } catch (err) {
    showToast(err.message || 'Could not delete listing', 'error');
  }
}

// ── Edit listing ───────────────────────────────────────
function openEditModal(id) {
  const listing = allListings.find((l) => l.id === id);
  if (!listing) return;

  document.getElementById('edit-id').value          = listing.id;
  document.getElementById('edit-title').value        = listing.title;
  document.getElementById('edit-description').value  = listing.description || '';
  document.getElementById('edit-price').value        = parseFloat(listing.price).toFixed(2);
  document.getElementById('edit-category').value     = listing.category_id;
  document.getElementById('edit-condition').value    = listing.condition || '';
  clearError(document.getElementById('edit-error'));
  document.getElementById('edit-modal').classList.remove('hidden');
}

async function handleEditListing(e) {
  e.preventDefault();
  const id             = document.getElementById('edit-id').value;
  const title          = document.getElementById('edit-title').value.trim();
  const description    = document.getElementById('edit-description').value.trim();
  const price          = document.getElementById('edit-price').value;
  const category_id    = document.getElementById('edit-category').value;
  const condition = document.getElementById('edit-condition').value;
  const errEl     = document.getElementById('edit-error');
  const btn       = document.getElementById('edit-btn');

  clearError(errEl);
  setLoading(btn, 'Saving...');

  try {
    const res  = await fetch(`${API}/listings/update/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ title, description, price: parseFloat(price), category_id: parseInt(category_id), condition }),
    });
    const data = await res.json();

    if (!data.success) throw new Error(data.message);

    closeModal('edit-modal');
    fetchListings();
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
    showToast(`Welcome back, ${currentUser.full_name.split(' ')[0]}!`, 'success');
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

    showToast('Account created! Please log in.', 'success');
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
    // Use FormData so multer can handle the image files
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
      headers: { Authorization: `Bearer ${token}` }, // no Content-Type — let browser set multipart boundary
      body: fd,
    });
    const data = await res.json();

    if (!data.success) throw new Error(data.message);

    closeModal('listing-modal');
    document.getElementById('image-preview').innerHTML = '';
    fetchListings();
    showToast('Listing posted successfully!', 'success');
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
function showError(el, msg) { el.textContent = msg; el.classList.remove('hidden'); }
function clearError(el) { el.textContent = ''; el.classList.add('hidden'); }
function setLoading(btn, text) { btn.disabled = true; btn.textContent = text; }
function resetLoading(btn, text) { btn.disabled = false; btn.textContent = text; }

// ── Toast ──────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast${type ? ' ' + type : ''} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.classList.remove('show'); }, 3000);
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
