const API = 'http://localhost:3000';

const CATEGORIES = {
  1: 'Textbooks', 2: 'Electronics', 3: 'Furniture', 4: 'Clothing',
  5: 'Sports', 6: 'Music', 7: 'Gaming', 8: 'Appliances',
  9: 'Stationery', 10: 'Other',
};

// ── State ────────────────────────────────────────────
let token = localStorage.getItem('cm_token') || null;
let currentUser = JSON.parse(localStorage.getItem('cm_user') || 'null');

// ── Init ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  updateNavbar();
  fetchListings();
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
  } else {
    guest.classList.remove('hidden');
    user.classList.add('hidden');
  }
}

function logout() {
  token = null;
  currentUser = null;
  localStorage.removeItem('cm_token');
  localStorage.removeItem('cm_user');
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

    const listings = data.data;
    countEl.textContent = listings.length ? `${listings.length} listing${listings.length !== 1 ? 's' : ''}` : '';

    if (listings.length === 0) {
      grid.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }

    grid.innerHTML = listings.map(renderCard).join('');
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
  const watchBtn  = token
    ? `<button class="btn-watch" onclick="addToWatchlist(${listing.id}, this)">♡ Watchlist</button>`
    : '';

  return `
    <div class="card">
      <span class="card-badge">${category}</span>
      <h3 class="card-title">${escapeHtml(listing.title)}</h3>
      <p class="card-description">${escapeHtml(desc)}</p>
      <div class="card-footer">
        <span class="card-price">$${price}</span>
        <span class="card-date">${date}</span>
      </div>
      ${watchBtn}
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
  const errEl       = document.getElementById('listing-error');
  const btn         = document.getElementById('listing-btn');

  clearError(errEl);
  setLoading(btn, 'Posting...');

  try {
    const res  = await fetch(`${API}/listings/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ title, description, price: parseFloat(price), category_id: parseInt(category_id) }),
    });
    const data = await res.json();

    if (!data.success) throw new Error(data.message);

    closeModal('listing-modal');
    document.getElementById('listing-form').reset();
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
