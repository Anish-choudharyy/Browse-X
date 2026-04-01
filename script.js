/* ═══════════════════════════════════════════════════════════════
   BROWSE-X  |  script.js
   Vanilla JS — ES6+, modular, beginner-friendly with comments
   ═══════════════════════════════════════════════════════════════

   HOW TO GET YOUR API KEY:
   1. Visit https://www.omdbapi.com/apikey.aspx
   2. Sign up for a FREE account
   3. Check your email for the activation link
   4. Replace 'YOUR_API_KEY_HERE' below with your actual key

   ═══════════════════════════════════════════════════════════════ */

// ─── 1. CONFIGURATION ─────────────────────────────────────────────
const CONFIG = {
  API_KEY: 'd65145d7',       // ← PUT YOUR OMDB API KEY HERE
  BASE_URL: 'https://www.omdbapi.com/',
  RESULTS_PER_PAGE: 10,               // OMDB always returns 10 per page
  DEBOUNCE_DELAY: 500,                // ms delay for debounce (auto-search)
  TOAST_DURATION: 2800,               // ms toast stays visible
};

// ─── 2. STATE MANAGEMENT ──────────────────────────────────────────
// All application state lives in one object — easy to track & debug
const state = {
  query: '',            // current search term
  currentPage: 1,       // active OMDB page
  totalResults: 0,      // total results count from API
  movies: [],           // raw results from API
  filtered: [],         // after client-side filter + sort applied
  sortOrder: 'default',
  typeFilter: '',
  yearFilter: '',
  favourites: [],       // persisted to localStorage
  theme: 'dark',        // 'dark' | 'light'
};

// ─── 3. DOM REFERENCES ────────────────────────────────────────────
// Grabbing all elements once — avoids repeated querySelector calls
const DOM = {
  searchInput:  document.getElementById('searchInput'),
  searchBtn:    document.getElementById('searchBtn'),
  clearBtn:     document.getElementById('clearBtn'),
  movieGrid:    document.getElementById('movieGrid'),
  skeletonGrid: document.getElementById('skeletonGrid'),
  emptyState:   document.getElementById('emptyState'),
  emptyTitle:   document.getElementById('emptyTitle'),
  emptySub:     document.getElementById('emptySub'),
  resultsCount: document.getElementById('resultsCount'),
  controls:     document.getElementById('controls'),
  pagination:   document.getElementById('pagination'),
  prevBtn:      document.getElementById('prevBtn'),
  nextBtn:      document.getElementById('nextBtn'),
  pageInfo:     document.getElementById('pageInfo'),
  sortOrder:    document.getElementById('sortOrder'),
  typeFilter:   document.getElementById('typeFilter'),
  yearFilter:   document.getElementById('yearFilter'),
  favBtn:       document.getElementById('favBtn'),
  favBadge:     document.getElementById('favBadge'),
  favPanel:     document.getElementById('favPanel'),
  favOverlay:   document.getElementById('favOverlay'),
  closeFavBtn:  document.getElementById('closeFavBtn'),
  favList:      document.getElementById('favList'),
  favEmpty:     document.getElementById('favEmpty'),
  themeToggle:  document.getElementById('themeToggle'),
  modalOverlay: document.getElementById('modalOverlay'),
  modal:        document.getElementById('modal'),
  modalClose:   document.getElementById('modalClose'),
  modalContent: document.getElementById('modalContent'),
  toast:        document.getElementById('toast'),
};

// ─── 4. INITIALISATION ────────────────────────────────────────────
/**
 * Entry point — runs once when the page loads.
 * Loads saved preferences from localStorage, attaches all event listeners.
 */
function init() {
  loadFromStorage();        // restore theme, favourites
  applyTheme(state.theme);  // apply before render to prevent flash
  updateFavBadge();
  attachEventListeners();
  renderFavPanel();         // pre-render favs in drawer
}

// ─── 5. LOCAL STORAGE ─────────────────────────────────────────────
/** Save favourites & theme to localStorage */
function saveToStorage() {
  localStorage.setItem('bx_favourites', JSON.stringify(state.favourites));
  localStorage.setItem('bx_theme', state.theme);
}

/** Load favourites & theme from localStorage */
function loadFromStorage() {
  const savedFavs  = localStorage.getItem('bx_favourites');
  const savedTheme = localStorage.getItem('bx_theme');
  if (savedFavs)  state.favourites = JSON.parse(savedFavs);
  if (savedTheme) state.theme = savedTheme;
}

// ─── 6. THEME ─────────────────────────────────────────────────────
/** Toggle between dark and light theme */
function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme(state.theme);
  saveToStorage();
}

/** Apply theme by setting data-theme on <html> */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

// ─── 7. API CALL ──────────────────────────────────────────────────
/**
 * Fetches movies from the OMDB API.
 * @param {string} query  - The search term
 * @param {number} page   - Page number (1-based)
 * @returns {Promise<Object>} - Parsed JSON response from OMDB
 */
async function fetchMovies(query, page = 1) {
  // Build URL with query parameters
  const params = new URLSearchParams({
    apikey: CONFIG.API_KEY,
    s:      query,
    page:   page,
  });

  const url = `${CONFIG.BASE_URL}?${params}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Network error: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetches full movie details by IMDB ID (for the modal).
 * @param {string} imdbID
 * @returns {Promise<Object>}
 */
async function fetchMovieDetails(imdbID) {
  const params = new URLSearchParams({
    apikey: CONFIG.API_KEY,
    i:      imdbID,
    plot:   'full',
  });

  const response = await fetch(`${CONFIG.BASE_URL}?${params}`);
  return response.json();
}

// ─── 8. SEARCH HANDLER ────────────────────────────────────────────
/**
 * Main search function — called on button click or debounced input.
 * @param {number} page - Which page to fetch (default 1 for new searches)
 */
async function handleSearch(page = 1) {
  const query = DOM.searchInput.value.trim();

  // Don't search if empty
  if (!query) {
    showEmptyState('Search for a movie above', 'Type a title and hit Search.');
    return;
  }

  // Validate API key
  if (CONFIG.API_KEY === 'YOUR_API_KEY_HERE') {
    showEmptyState('API Key Missing!', 'Open script.js and add your OMDB API key in CONFIG.API_KEY.');
    return;
  }

  state.query = query;
  state.currentPage = page;

  // Show loading UI
  showSkeleton();
  hideGrid();
  hideEmptyState();

  async function handleSearch(page = 1) {
  const query = DOM.searchInput.value.trim();
  if (!query) return;

  state.query = query;
  state.currentPage = page;

  DOM.emptyState.hidden = true;
  showSkeleton();

  try {
    const data = await fetchMovies(query, page);
    console.log(data);

    if (!data || data.Response !== "True") {
      showEmpty("No Results Found", "Try another search");
      return;
    }

    state.movies = data.Search || [];
    state.totalResults = parseInt(data.totalResults || "0", 10);

    renderGrid(state.movies);
    updatePagination();

    // ✅ MOVE HERE
    hideSkeleton();

  } catch (err) {
    showEmpty("Error", "Something went wrong");
    hideSkeleton(); // ✅ ALSO HERE
  }
  finally {
    hideSkeleton();
  }
}

// ─── 9. FILTER & SORT ─────────────────────────────────────────────
/**
 * Applies client-side type filter, year filter, and sorting.
 * Uses array methods (filter, sort) — no for/while loops!
 */
function applyFiltersAndSort() {
  let results = [...state.movies]; // copy so we don't mutate originals

  // --- Filter by Type ---
  if (state.typeFilter) {
    results = results.filter(m => m.Type === state.typeFilter);
  }

  // --- Filter by Decade ---
  if (state.yearFilter) {
    const decade = parseInt(state.yearFilter, 10);
    results = results.filter(m => {
      const year = parseInt(m.Year, 10);
      if (decade === 1980) return year < 1990;          // 1980s & older
      return year >= decade && year < decade + 10;       // exact decade
    });
  }

  // --- Sort ---
  results = sortMovies(results, state.sortOrder);

  state.filtered = results;
}

/**
 * Sorts an array of movies by the given order.
 * Uses Array.sort() with a compare function.
 * @param {Array} movies
 * @param {string} order - 'az' | 'za' | 'newest' | 'oldest' | 'default'
 * @returns {Array} sorted copy
 */
function sortMovies(movies, order) {
  const sorted = [...movies]; // always sort a copy

  const compareFns = {
    az:      (a, b) => a.Title.localeCompare(b.Title),
    za:      (a, b) => b.Title.localeCompare(a.Title),
    newest:  (a, b) => parseInt(b.Year, 10) - parseInt(a.Year, 10),
    oldest:  (a, b) => parseInt(a.Year, 10) - parseInt(b.Year, 10),
    default: () => 0, // keep OMDB relevance order
  };

  return sorted.sort(compareFns[order] || compareFns.default);
}

// ─── 10. RENDER FUNCTIONS ─────────────────────────────────────────
/**
 * Renders movie cards into the grid.
 * Uses Array.map() to build HTML — no for loops!
 * @param {Array} movies
 */
function renderGrid(movies) {
  if (!movies.length) {
    showEmptyState('No Results After Filtering', 'Try removing or changing your filters.');
    DOM.movieGrid.innerHTML = '';
    return;
  }

  // Build HTML string from array of movies using .map() → .join()
  DOM.movieGrid.innerHTML = movies
    .map(movie => createCardHTML(movie))
    .join('');

  showGrid();

  // Attach favourite button listeners after DOM is updated
  attachFavButtonListeners();
  attachCardClickListeners();
}

/**
 * Creates the HTML string for a single movie card.
 * @param {Object} movie - OMDB movie object
 * @returns {string} HTML
 */
function createCardHTML(movie) {
  const isFav    = isFavourite(movie.imdbID);
  const posterSrc = movie.Poster !== 'N/A' ? movie.Poster : null;
  const badgeClass = getBadgeClass(movie.Type);

  const posterHTML = posterSrc
    ? `<img class="card__poster" src="${escapeHTML(posterSrc)}" alt="${escapeHTML(movie.Title)} poster" loading="lazy" />`
    : `<div class="card__no-poster">🎬<span>No Image</span></div>`;

  return `
    <article class="card" data-imdbid="${escapeHTML(movie.imdbID)}" tabindex="0" role="button" aria-label="${escapeHTML(movie.Title)}">
      <div class="card__poster-wrap">
        ${posterHTML}
        <span class="card__badge ${badgeClass}">${escapeHTML(movie.Type || 'N/A')}</span>
        <button
          class="card__fav ${isFav ? 'active' : ''}"
          data-imdbid="${escapeHTML(movie.imdbID)}"
          data-title="${escapeHTML(movie.Title)}"
          data-year="${escapeHTML(movie.Year)}"
          data-poster="${escapeHTML(movie.Poster)}"
          data-type="${escapeHTML(movie.Type)}"
          aria-label="${isFav ? 'Remove from favourites' : 'Add to favourites'}"
          title="${isFav ? 'Remove from favourites' : 'Add to favourites'}"
        >${isFav ? '♥' : '♡'}</button>
      </div>
      <div class="card__info">
        <h3 class="card__title">${escapeHTML(movie.Title)}</h3>
        <div class="card__meta">
          <span class="card__year">${escapeHTML(movie.Year)}</span>
        </div>
      </div>
    </article>
  `;
}

/** Returns the CSS class for the card type badge */
function getBadgeClass(type) {
  const map = {
    movie:   'card__badge--movie',
    series:  'card__badge--series',
    episode: 'card__badge--episode',
  };
  return map[type] || 'card__badge--default';
}

/**
 * Creates skeleton loading cards (10 by default).
 * @param {number} count
 */
function renderSkeletons(count = 10) {
  DOM.skeletonGrid.innerHTML = Array.from({ length: count })
    .map(() => `
      <div class="skeleton-card">
        <div class="skeleton-poster"></div>
        <div class="skeleton-info">
          <div class="skeleton-line"></div>
          <div class="skeleton-line skeleton-line--short"></div>
        </div>
      </div>
    `)
    .join('');
}

/**
 * Renders the Favourites drawer content.
 */
function renderFavPanel() {
  if (state.favourites.length === 0) {
    DOM.favList.innerHTML = '';
    DOM.favEmpty.hidden   = false;
    return;
  }

  DOM.favEmpty.hidden = true;
  DOM.favList.innerHTML = state.favourites
    .map(fav => `
      <div class="fav-item" data-imdbid="${escapeHTML(fav.imdbID)}">
        <img class="fav-item__poster"
          src="${fav.Poster !== 'N/A' ? escapeHTML(fav.Poster) : ''}"
          alt="${escapeHTML(fav.Title)}"
          onerror="this.style.display='none'"
        />
        <div class="fav-item__info">
          <p class="fav-item__title">${escapeHTML(fav.Title)}</p>
          <p class="fav-item__meta">${escapeHTML(fav.Year)} · ${escapeHTML(fav.Type)}</p>
        </div>
        <button class="fav-item__remove" data-imdbid="${escapeHTML(fav.imdbID)}" aria-label="Remove ${escapeHTML(fav.Title)} from favourites" title="Remove">✕</button>
      </div>
    `)
    .join('');

  // Attach remove listeners
  DOM.favList.querySelectorAll('.fav-item__remove').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.imdbid;
      removeFavourite(id);
    });
  });
}

/**
 * Renders the detail modal for a specific movie.
 * Shows a loading spinner, then fetches full data.
 * @param {string} imdbID
 */
async function renderModal(imdbID) {
  DOM.modalContent.innerHTML = `<div class="modal-loading">Loading details…</div>`;
  DOM.modalOverlay.hidden = false;
  document.body.style.overflow = 'hidden';

  try {
    const movie = await fetchMovieDetails(imdbID);

    if (movie.Response === 'False') {
      DOM.modalContent.innerHTML = `<div class="modal-loading">Details not available.</div>`;
      return;
    }

    const posterSrc = movie.Poster !== 'N/A' ? movie.Poster : '';
    const rating = movie.imdbRating !== 'N/A' ? `★ ${movie.imdbRating}` : 'N/A';

    DOM.modalContent.innerHTML = `
      <div class="modal-hero">
        <img class="modal-poster" src="${escapeHTML(posterSrc)}" alt="${escapeHTML(movie.Title)}" onerror="this.style.display='none'" />
        <div class="modal-meta">
          <h2 class="modal-title" id="modalTitle">${escapeHTML(movie.Title)}</h2>
          <div class="modal-tags">
            <span class="modal-tag modal-tag--accent">${escapeHTML(movie.Year)}</span>
            <span class="modal-tag">${escapeHTML(movie.Rated || 'N/A')}</span>
            <span class="modal-tag">${escapeHTML(movie.Runtime || 'N/A')}</span>
            <span class="modal-tag">${escapeHTML(movie.Type || 'N/A')}</span>
          </div>
          <div class="modal-rating">${escapeHTML(rating)} <span>/ 10 on IMDb</span></div>
          <div class="modal-tags">
            ${(movie.Genre || '').split(',').map(g => `<span class="modal-tag">${escapeHTML(g.trim())}</span>`).join('')}
          </div>
        </div>
      </div>
      <p class="modal-plot">${escapeHTML(movie.Plot || 'No plot available.')}</p>
      <div class="modal-grid">
        <div class="modal-field">
          <span class="modal-field__label">Director</span>
          <span class="modal-field__value">${escapeHTML(movie.Director || 'N/A')}</span>
        </div>
        <div class="modal-field">
          <span class="modal-field__label">Cast</span>
          <span class="modal-field__value">${escapeHTML(movie.Actors || 'N/A')}</span>
        </div>
        <div class="modal-field">
          <span class="modal-field__label">Language</span>
          <span class="modal-field__value">${escapeHTML(movie.Language || 'N/A')}</span>
        </div>
        <div class="modal-field">
          <span class="modal-field__label">Country</span>
          <span class="modal-field__value">${escapeHTML(movie.Country || 'N/A')}</span>
        </div>
        <div class="modal-field">
          <span class="modal-field__label">Box Office</span>
          <span class="modal-field__value">${escapeHTML(movie.BoxOffice || 'N/A')}</span>
        </div>
        <div class="modal-field">
          <span class="modal-field__label">Awards</span>
          <span class="modal-field__value">${escapeHTML(movie.Awards || 'N/A')}</span>
        </div>
      </div>
    `;
  } catch {
    DOM.modalContent.innerHTML = `<div class="modal-loading">Failed to load details. Check your connection.</div>`;
  }
}

// ─── 11. FAVOURITES LOGIC ─────────────────────────────────────────
/**
 * Checks if a movie (by imdbID) is in favourites.
 * Uses Array.some() — clean and readable!
 */
function isFavourite(imdbID) {
  return state.favourites.some(f => f.imdbID === imdbID);
}

/** Adds a movie to favourites and persists to localStorage */
function addFavourite(movie) {
  if (isFavourite(movie.imdbID)) return; // no duplicates
  state.favourites.push(movie);
  saveToStorage();
  updateFavBadge();
  renderFavPanel();
  showToast(`♥ ${movie.Title} added to favourites`);
}

/** Removes a movie from favourites by imdbID */
function removeFavourite(imdbID) {
  const removedMovie = state.favourites.find(f => f.imdbID === imdbID);
  // Array.filter() creates a new array without the removed item
  state.favourites = state.favourites.filter(f => f.imdbID !== imdbID);
  saveToStorage();
  updateFavBadge();
  renderFavPanel();
  updateFavButtons(); // update ♥/♡ on visible cards
  if (removedMovie) showToast(`Removed "${removedMovie.Title}" from favourites`);
}

/** Updates the badge number on the favourites button */
function updateFavBadge() {
  const count = state.favourites.length;
  DOM.favBadge.textContent = count;
  DOM.favBadge.classList.toggle('hidden', count === 0);
}

/** Refreshes all heart button states on the current grid */
function updateFavButtons() {
  DOM.movieGrid.querySelectorAll('.card__fav').forEach(btn => {
    const id  = btn.dataset.imdbid;
    const fav = isFavourite(id);
    btn.classList.toggle('active', fav);
    btn.textContent = fav ? '♥' : '♡';
    btn.setAttribute('aria-label', fav ? 'Remove from favourites' : 'Add to favourites');
  });
}

// ─── 12. PAGINATION ───────────────────────────────────────────────
/** Updates pagination buttons and page info text */
function updatePagination() {
  const totalPages = Math.ceil(state.totalResults / CONFIG.RESULTS_PER_PAGE);

  if (totalPages <= 1) {
    DOM.pagination.hidden = true;
    return;
  }

  DOM.pagination.hidden = false;
  DOM.pageInfo.textContent = `Page ${state.currentPage} / ${totalPages}`;
  DOM.prevBtn.disabled = state.currentPage <= 1;
  DOM.nextBtn.disabled = state.currentPage >= totalPages;
}

// ─── 13. UI HELPERS ───────────────────────────────────────────────
function showSkeleton()    { renderSkeletons(); DOM.skeletonGrid.hidden = false; }
function hideSkeleton()    { DOM.skeletonGrid.hidden = true; }
function showGrid()        { DOM.movieGrid.style.display = 'grid'; }
function hideGrid()        { DOM.movieGrid.style.display = 'none'; DOM.movieGrid.innerHTML = ''; }
function hideEmptyState()  { DOM.emptyState.hidden = true; }

function showEmptyState(title, sub) {
  hideSkeleton();
  hideGrid();
  DOM.emptyTitle.textContent = title;
  DOM.emptySub.textContent   = sub;
  DOM.emptyState.hidden      = false;
  DOM.pagination.hidden      = true;
}

function updateResultsCount(overrideCount) {
  const count = overrideCount !== undefined ? overrideCount : state.totalResults;
  DOM.resultsCount.textContent = count
    ? `${count.toLocaleString()} result${count === 1 ? '' : 's'} for "${state.query}"`
    : '';
}

/**
 * Shows a temporary toast notification.
 * @param {string} message
 */
let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  DOM.toast.textContent = message;
  DOM.toast.classList.add('show');
  toastTimer = setTimeout(() => DOM.toast.classList.remove('show'), CONFIG.TOAST_DURATION);
}

/**
 * XSS prevention — escapes HTML special characters.
 * Always escape user-supplied or API data before inserting into innerHTML!
 * @param {string} str
 * @returns {string}
 */
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
}

// ─── 14. DEBOUNCE ─────────────────────────────────────────────────
/**
 * Debounce — wraps a function so it only fires after the user
 * stops typing for `delay` ms. Reduces unnecessary API calls.
 *
 * @param {Function} fn    - The function to debounce
 * @param {number}   delay - Delay in milliseconds
 * @returns {Function}     - Debounced version of fn
 */
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// Create a debounced version of handleSearch for the input event
const debouncedSearch = debounce(() => handleSearch(1), CONFIG.DEBOUNCE_DELAY);

// ─── 15. EVENT LISTENERS ──────────────────────────────────────────
function attachEventListeners() {

  // — Search input: show/hide clear button + debounced search
  DOM.searchInput.addEventListener('input', () => {
    const hasValue = DOM.searchInput.value.length > 0;
    DOM.clearBtn.classList.toggle('visible', hasValue);
    debouncedSearch();
  });

  // — Search button: immediate search
  DOM.searchBtn.addEventListener('click', () => handleSearch(1));

  // — Press Enter in search box
  DOM.searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSearch(1);
  });

  // — Clear button
  DOM.clearBtn.addEventListener('click', () => {
    DOM.searchInput.value = '';
    DOM.clearBtn.classList.remove('visible');
    DOM.searchInput.focus();
    hideGrid();
    hideEmptyState();
    DOM.pagination.hidden = true;
    DOM.resultsCount.textContent = '';
    state.movies   = [];
    state.filtered = [];
  });

  // — Sort dropdown
  DOM.sortOrder.addEventListener('change', () => {
    state.sortOrder = DOM.sortOrder.value;
    applyFiltersAndSort();
    renderGrid(state.filtered);
    updateResultsCount();
  });

  // — Type filter
  DOM.typeFilter.addEventListener('change', () => {
    state.typeFilter = DOM.typeFilter.value;
    applyFiltersAndSort();
    renderGrid(state.filtered);
    updateResultsCount();
  });

  // — Year filter
  DOM.yearFilter.addEventListener('change', () => {
    state.yearFilter = DOM.yearFilter.value;
    applyFiltersAndSort();
    renderGrid(state.filtered);
    updateResultsCount();
  });

  // — Pagination: previous page
  DOM.prevBtn.addEventListener('click', () => {
    if (state.currentPage > 1) {
      handleSearch(state.currentPage - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  // — Pagination: next page
  DOM.nextBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(state.totalResults / CONFIG.RESULTS_PER_PAGE);
    if (state.currentPage < totalPages) {
      handleSearch(state.currentPage + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  // — Theme toggle
  DOM.themeToggle.addEventListener('click', toggleTheme);

  // — Open favourites panel
  DOM.favBtn.addEventListener('click', () => {
    DOM.favPanel.hidden = false;
    document.body.style.overflow = 'hidden';
  });

  // — Close favourites panel (close button & overlay click)
  DOM.closeFavBtn.addEventListener('click', closeFavPanel);
  DOM.favOverlay.addEventListener('click', closeFavPanel);

  // — Close modal
  DOM.modalClose.addEventListener('click', closeModal);
  DOM.modalOverlay.addEventListener('click', e => {
    if (e.target === DOM.modalOverlay) closeModal();
  });

  // — Keyboard: Escape closes panels / modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!DOM.modalOverlay.hidden)  closeModal();
      if (!DOM.favPanel.hidden)      closeFavPanel();
    }
  });
}

/** Attaches click/keyboard listeners to favourite heart buttons on cards */
function attachFavButtonListeners() {
  DOM.movieGrid.querySelectorAll('.card__fav').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation(); // don't open modal when clicking ♥

      const { imdbid, title, year, poster, type } = btn.dataset;
      const movie = { imdbID: imdbid, Title: title, Year: year, Poster: poster, Type: type };

      if (isFavourite(imdbid)) {
        removeFavourite(imdbid);
      } else {
        addFavourite(movie);
        // Animate the button
        btn.classList.add('active');
        btn.textContent = '♥';
      }
    });
  });
}

/** Attaches click listeners to the card body to open detail modal */
function attachCardClickListeners() {
  DOM.movieGrid.querySelectorAll('.card').forEach(card => {
    const openModal = () => renderModal(card.dataset.imdbid);
    card.addEventListener('click', openModal);
    // Also support keyboard (Enter / Space) for accessibility
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openModal();
      }
    });
  });
}

function closeFavPanel() {
  DOM.favPanel.hidden = true;
  document.body.style.overflow = '';
}

function closeModal() {
  DOM.modalOverlay.hidden = true;
  document.body.style.overflow = '';
}

// ─── 16. KICK OFF THE APP ─────────────────────────────────────────
init();
