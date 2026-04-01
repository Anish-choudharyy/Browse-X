/* ═══════════════════════════════════════════════════════════════
   BROWSE-X  |  script.js
   Vanilla JS — ES6+, modular, beginner-friendly with comments
   Now powered by: The Movie Database (TMDB) API
   ═══════════════════════════════════════════════════════════════

   HOW TO GET YOUR TMDB API KEY:
   1. Visit https://www.themoviedb.org/signup and create a free account
   2. Go to: https://www.themoviedb.org/settings/api
   3. Click "Create" → choose "Developer" → fill in the short form
   4. Copy your "API Key (v3 auth)" — the shorter alphanumeric key
   5. Paste it below replacing 'YOUR_TMDB_API_KEY_HERE'

   TMDB vs OMDB — Key Differences:
   • TMDB has 20 results per page (OMDB had 10)
   • Images need a base URL prefix (see CONFIG.IMAGE_BASE)
   • Separate field names for movies vs TV (handled by normaliseItem)
   • /search/multi endpoint returns both movies AND TV shows at once
   ═══════════════════════════════════════════════════════════════ */

// ─── 1. CONFIGURATION ─────────────────────────────────────────────
const CONFIG = {
  API_KEY:    'e77858412d1571020f642635a32b79a6',  // ← PASTE YOUR TMDB v3 API KEY HERE
  BASE_URL:   'https://api.themoviedb.org/3',
  IMAGE_BASE: 'https://image.tmdb.org/t/p/w500', // poster thumbnail
  IMAGE_ORIG: 'https://image.tmdb.org/t/p/w780', // larger for modal
  RESULTS_PER_PAGE: 20,                  // TMDB returns 20 per page
  DEBOUNCE_DELAY:   500,                 // ms before auto-search fires
  TOAST_DURATION:   2800,               // ms toast is visible
};

// ─── 2. STATE MANAGEMENT ──────────────────────────────────────────
// All app state in one place — easy to read and debug
const state = {
  query:        '',
  currentPage:  1,
  totalResults: 0,
  totalPages:   0,
  movies:       [],    // raw results (normalised from TMDB)
  filtered:     [],    // after client-side filter + sort
  sortOrder:    'default',
  typeFilter:   '',    // 'movie' | 'tv' | ''
  yearFilter:   '',
  favourites:   [],    // persisted to localStorage
  theme:        'dark',
};

// ─── 3. DOM REFERENCES ────────────────────────────────────────────
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
  modalClose:   document.getElementById('modalClose'),
  modalContent: document.getElementById('modalContent'),
  toast:        document.getElementById('toast'),
};

// ─── 4. INITIALISATION ────────────────────────────────────────────
/**
 * Entry point — runs once on page load.
 */
function init() {
  loadFromStorage();
  applyTheme(state.theme);
  updateFavBadge();
  attachEventListeners();
  renderFavPanel();
  updateTypeFilterOptions(); // TMDB uses 'tv' not 'series'
  injectRatingStyle();       // add TMDB star-rating badge CSS
}

/** TMDB uses 'movie' and 'tv' — update the filter dropdown */
function updateTypeFilterOptions() {
  DOM.typeFilter.innerHTML = `
    <option value="">All Types</option>
    <option value="movie">Movies</option>
    <option value="tv">TV Shows</option>
  `;
}

// ─── 5. LOCAL STORAGE ─────────────────────────────────────────────
function saveToStorage() {
  localStorage.setItem('bx_favourites', JSON.stringify(state.favourites));
  localStorage.setItem('bx_theme', state.theme);
}

function loadFromStorage() {
  const savedFavs  = localStorage.getItem('bx_favourites');
  const savedTheme = localStorage.getItem('bx_theme');
  if (savedFavs)  state.favourites = JSON.parse(savedFavs);
  if (savedTheme) state.theme = savedTheme;
}

// ─── 6. THEME ─────────────────────────────────────────────────────
function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme(state.theme);
  saveToStorage();
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

// ─── 7. TMDB API CALLS ────────────────────────────────────────────

/**
 * Builds a full TMDB API URL with the API key and any extra params.
 * @param {string} path        - e.g. '/search/multi'
 * @param {Object} extraParams - additional query params
 * @returns {string} full URL
 */
function buildURL(path, extraParams = {}) {
  const params = new URLSearchParams({
    api_key:       CONFIG.API_KEY,
    language:      'en-US',
    include_adult: false,
    ...extraParams,
  });
  return `${CONFIG.BASE_URL}${path}?${params}`;
}

/**
 * Searches TMDB using the /search/multi endpoint.
 * This returns movies AND TV shows in one request.
 * People results are filtered out — we only want media.
 *
 * @param {string} query - search term
 * @param {number} page  - page number (1-based)
 * @returns {Promise<Object>} normalised result object
 */
async function fetchMovies(query, page = 1) {
  const url      = buildURL('/search/multi', { query, page });
  const response = await fetch(url);

  if (!response.ok) throw new Error(`Network error: ${response.status}`);

  const data = await response.json();

  // Filter out 'person' results — keep only movie and tv
  const mediaItems = (data.results || []).filter(
    item => item.media_type === 'movie' || item.media_type === 'tv'
  );

  return {
    results:      mediaItems.map(normaliseItem),
    totalResults: data.total_results || 0,
    totalPages:   data.total_pages   || 0,
    page:         data.page          || 1,
  };
}

/**
 * Fetches full details for one movie or TV show.
 * append_to_response=credits gets cast & crew in the same request.
 *
 * @param {string|number} id        - TMDB id
 * @param {string}        mediaType - 'movie' | 'tv'
 */
async function fetchDetails(id, mediaType) {
  const url      = buildURL(`/${mediaType}/${id}`, { append_to_response: 'credits' });
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Detail fetch failed: ${response.status}`);
  return response.json();
}

/**
 * Normalises a raw TMDB item into a consistent shape.
 *
 * Why? TMDB movies use `title` + `release_date` but
 * TV shows use `name` + `first_air_date`. This function
 * maps both to Title, Year, Type so the rest of the app
 * doesn't need to care about the difference.
 *
 * @param {Object} item - raw TMDB search result
 * @returns {Object}    - normalised movie-like object
 */
function normaliseItem(item) {
  const isTV  = item.media_type === 'tv';
  const title = isTV ? item.name            : item.title;
  const date  = isTV ? item.first_air_date  : item.release_date;
  const year  = date ? date.substring(0, 4) : 'N/A';

  return {
    id:          item.id,
    imdbID:      String(item.id),           // kept as 'imdbID' for compat
    Title:       title || 'Untitled',
    Year:        year,
    Type:        item.media_type,           // 'movie' | 'tv'
    Poster:      item.poster_path
                   ? `${CONFIG.IMAGE_BASE}${item.poster_path}`
                   : 'N/A',
    poster_path: item.poster_path || null,
    Rating:      item.vote_average
                   ? item.vote_average.toFixed(1)
                   : 'N/A',
    Overview:    item.overview || '',
  };
}

// ─── 8. SEARCH HANDLER ────────────────────────────────────────────
/**
 * Main search — called on button click or via debounced input.
 * @param {number} page - page to fetch (reset to 1 on new search)
 */
async function handleSearch(page = 1) {
  const query = DOM.searchInput.value.trim();

  if (!query) {
    showEmptyState('Search for a movie above', 'Type a title and hit Search.');
    return;
  }

  if (CONFIG.API_KEY === 'YOUR_TMDB_API_KEY_HERE') {
    showEmptyState('API Key Missing!', 'Open script.js and replace YOUR_TMDB_API_KEY_HERE with your real TMDB key.');
    return;
  }

  state.query       = query;
  state.currentPage = page;

  showSkeleton();
  hideGrid();
  hideEmptyState();

  try {
    const data = await fetchMovies(query, page);

    if (data.results.length > 0) {
      state.movies       = data.results;
      state.totalResults = data.totalResults;
      state.totalPages   = data.totalPages;

      applyFiltersAndSort();
      renderGrid(state.filtered);
      updateResultsCount();
      updatePagination();
    } else {
      showEmptyState('No Results Found', `Nothing matched "${query}". Try a different title.`);
      updateResultsCount(0);
    }
  } catch (err) {
    console.error('Fetch error:', err);
    showEmptyState('Connection Error', 'Could not reach the TMDB API. Check your internet connection or API key.');
  } finally {
    hideSkeleton();
  }
}

// ─── 9. FILTER & SORT ─────────────────────────────────────────────
/**
 * Applies type filter, year filter, and sort order.
 * Uses Array.filter() and Array.sort() — no for/while loops!
 */
function applyFiltersAndSort() {
  let results = [...state.movies];

  // Filter by media type
  if (state.typeFilter) {
    results = results.filter(m => m.Type === state.typeFilter);
  }

  // Filter by decade
  if (state.yearFilter) {
    const decade = parseInt(state.yearFilter, 10);
    results = results.filter(m => {
      const year = parseInt(m.Year, 10);
      if (decade === 1980) return year < 1990;
      return year >= decade && year < decade + 10;
    });
  }

  state.filtered = sortMovies(results, state.sortOrder);
}

/**
 * Returns a sorted copy of the movies array.
 * Pure function — doesn't mutate the original.
 */
function sortMovies(movies, order) {
  const sorted = [...movies];
  const compareFns = {
    az:      (a, b) => a.Title.localeCompare(b.Title),
    za:      (a, b) => b.Title.localeCompare(a.Title),
    newest:  (a, b) => parseInt(b.Year, 10) - parseInt(a.Year, 10),
    oldest:  (a, b) => parseInt(a.Year, 10) - parseInt(b.Year, 10),
    default: () => 0,
  };
  return sorted.sort(compareFns[order] || compareFns.default);
}

// ─── 10. RENDER FUNCTIONS ─────────────────────────────────────────
/**
 * Paints movie cards into the grid.
 * Uses Array.map() to build HTML strings — no loops!
 */
function renderGrid(movies) {
  if (!movies.length) {
    showEmptyState('No Results After Filtering', 'Try removing or adjusting your filters.');
    DOM.movieGrid.innerHTML = '';
    return;
  }

  DOM.movieGrid.innerHTML = movies.map(createCardHTML).join('');
  showGrid();
  attachFavButtonListeners();
  attachCardClickListeners();
}

/**
 * Builds the HTML for one movie card.
 * TMDB bonus: shows star rating in the bottom-right corner.
 */
function createCardHTML(movie) {
  const isFav      = isFavourite(movie.imdbID);
  const posterSrc  = movie.Poster !== 'N/A' ? movie.Poster : null;
  const badgeClass = getBadgeClass(movie.Type);
  const typeLabel  = movie.Type === 'tv' ? 'TV' : 'Movie';

  const posterHTML = posterSrc
    ? `<img class="card__poster" src="${escapeHTML(posterSrc)}" alt="${escapeHTML(movie.Title)} poster" loading="lazy" />`
    : `<div class="card__no-poster">🎬<span>No Image</span></div>`;

  const ratingBadge = movie.Rating !== 'N/A'
    ? `<span class="card__rating">★ ${escapeHTML(movie.Rating)}</span>`
    : '';

  return `
    <article
      class="card"
      data-id="${escapeHTML(movie.imdbID)}"
      data-type="${escapeHTML(movie.Type)}"
      tabindex="0"
      role="button"
      aria-label="${escapeHTML(movie.Title)}"
    >
      <div class="card__poster-wrap">
        ${posterHTML}
        <span class="card__badge ${badgeClass}">${escapeHTML(typeLabel)}</span>
        ${ratingBadge}
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

function getBadgeClass(type) {
  return type === 'tv' ? 'card__badge--series' : 'card__badge--movie';
}

function renderSkeletons(count = 20) {
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

function renderFavPanel() {
  if (state.favourites.length === 0) {
    DOM.favList.innerHTML = '';
    DOM.favEmpty.hidden   = false;
    return;
  }

  DOM.favEmpty.hidden = true;
  DOM.favList.innerHTML = state.favourites
    .map(fav => `
      <div class="fav-item" data-id="${escapeHTML(fav.imdbID)}">
        <img
          class="fav-item__poster"
          src="${fav.Poster !== 'N/A' ? escapeHTML(fav.Poster) : ''}"
          alt="${escapeHTML(fav.Title)}"
          onerror="this.style.display='none'"
        />
        <div class="fav-item__info">
          <p class="fav-item__title">${escapeHTML(fav.Title)}</p>
          <p class="fav-item__meta">${escapeHTML(fav.Year)} · ${fav.Type === 'tv' ? 'TV Show' : 'Movie'}</p>
        </div>
        <button
          class="fav-item__remove"
          data-imdbid="${escapeHTML(fav.imdbID)}"
          aria-label="Remove ${escapeHTML(fav.Title)}"
          title="Remove"
        >✕</button>
      </div>
    `)
    .join('');

  DOM.favList.querySelectorAll('.fav-item__remove').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      removeFavourite(btn.dataset.imdbid);
    });
  });
}

/**
 * Fetches full TMDB details and renders the detail modal.
 * TMDB gives us genres, runtime, cast, budget, number of seasons, etc.
 * @param {string} id        - TMDB id
 * @param {string} mediaType - 'movie' | 'tv'
 */
async function renderModal(id, mediaType) {
  DOM.modalContent.innerHTML = `<div class="modal-loading">Loading details…</div>`;
  DOM.modalOverlay.hidden = false;
  document.body.style.overflow = 'hidden';

  try {
    const item  = await fetchDetails(id, mediaType);
    const isTV  = mediaType === 'tv';

    // Normalise fields
    const title    = isTV ? item.name           : item.title;
    const date     = isTV ? item.first_air_date : item.release_date;
    const year     = date ? date.substring(0, 4) : 'N/A';
    const runtime  = isTV
      ? (item.episode_run_time?.[0] ? `${item.episode_run_time[0]} min / ep` : 'N/A')
      : (item.runtime ? `${item.runtime} min` : 'N/A');

    const posterSrc = item.poster_path ? `${CONFIG.IMAGE_ORIG}${item.poster_path}` : '';
    const rating    = item.vote_average ? `★ ${item.vote_average.toFixed(1)}` : 'N/A';
    const genres    = (item.genres || []).map(g => g.name).join(', ') || 'N/A';
    const tagline   = item.tagline || '';

    // Top 5 cast names from credits
    const cast = item.credits?.cast
      ?.slice(0, 5)
      .map(c => c.name)
      .join(', ') || 'N/A';

    // Director (movie) or Creator (TV)
    let director = 'N/A';
    if (!isTV && item.credits?.crew) {
      const dir = item.credits.crew.find(c => c.job === 'Director');
      if (dir) director = dir.name;
    } else if (isTV && item.created_by?.length) {
      director = item.created_by.map(c => c.name).join(', ');
    }

    const language = item.original_language?.toUpperCase() || 'N/A';
    const budget   = item.budget  ? `$${item.budget.toLocaleString()}`  : 'N/A';
    const revenue  = item.revenue ? `$${item.revenue.toLocaleString()}` : 'N/A';

    // Extra fields for TV
    const seasons  = item.number_of_seasons  || 'N/A';
    const episodes = item.number_of_episodes || 'N/A';
    const status   = item.status || 'N/A';

    // Build genre tag chips
    const genreChips = genres.split(', ')
      .map(g => `<span class="modal-tag">${escapeHTML(g)}</span>`)
      .join('');

    DOM.modalContent.innerHTML = `
      <div class="modal-hero">
        <img
          class="modal-poster"
          src="${escapeHTML(posterSrc)}"
          alt="${escapeHTML(title)}"
          onerror="this.style.display='none'"
        />
        <div class="modal-meta">
          <h2 class="modal-title" id="modalTitle">${escapeHTML(title)}</h2>
          ${tagline ? `<p style="font-style:italic;color:var(--text-muted);font-size:0.82rem;margin-bottom:0.6rem;">"${escapeHTML(tagline)}"</p>` : ''}
          <div class="modal-tags">
            <span class="modal-tag modal-tag--accent">${escapeHTML(year)}</span>
            <span class="modal-tag">${escapeHTML(runtime)}</span>
            <span class="modal-tag">${isTV ? 'TV Show' : 'Movie'}</span>
            <span class="modal-tag">${escapeHTML(status)}</span>
          </div>
          <div class="modal-rating">${escapeHTML(rating)} <span>/ 10 on TMDB</span></div>
          <div class="modal-tags">${genreChips}</div>
        </div>
      </div>

      <p class="modal-plot">${escapeHTML(item.overview || 'No overview available.')}</p>

      <div class="modal-grid">
        <div class="modal-field">
          <span class="modal-field__label">${isTV ? 'Creator' : 'Director'}</span>
          <span class="modal-field__value">${escapeHTML(director)}</span>
        </div>
        <div class="modal-field">
          <span class="modal-field__label">Cast</span>
          <span class="modal-field__value">${escapeHTML(cast)}</span>
        </div>
        <div class="modal-field">
          <span class="modal-field__label">Language</span>
          <span class="modal-field__value">${escapeHTML(language)}</span>
        </div>
        <div class="modal-field">
          <span class="modal-field__label">Genres</span>
          <span class="modal-field__value">${escapeHTML(genres)}</span>
        </div>
        ${isTV ? `
          <div class="modal-field">
            <span class="modal-field__label">Seasons</span>
            <span class="modal-field__value">${escapeHTML(String(seasons))}</span>
          </div>
          <div class="modal-field">
            <span class="modal-field__label">Episodes</span>
            <span class="modal-field__value">${escapeHTML(String(episodes))}</span>
          </div>
        ` : `
          <div class="modal-field">
            <span class="modal-field__label">Budget</span>
            <span class="modal-field__value">${escapeHTML(budget)}</span>
          </div>
          <div class="modal-field">
            <span class="modal-field__label">Box Office</span>
            <span class="modal-field__value">${escapeHTML(revenue)}</span>
          </div>
        `}
      </div>
    `;
  } catch (err) {
    console.error('Modal error:', err);
    DOM.modalContent.innerHTML = `<div class="modal-loading">Failed to load details. Check your connection.</div>`;
  }
}

// ─── 11. FAVOURITES ───────────────────────────────────────────────
function isFavourite(id) {
  return state.favourites.some(f => f.imdbID === String(id));
}

function addFavourite(movie) {
  if (isFavourite(movie.imdbID)) return;
  state.favourites.push(movie);
  saveToStorage();
  updateFavBadge();
  renderFavPanel();
  showToast(`♥ "${movie.Title}" added to favourites`);
}

function removeFavourite(id) {
  const removed = state.favourites.find(f => f.imdbID === String(id));
  state.favourites = state.favourites.filter(f => f.imdbID !== String(id));
  saveToStorage();
  updateFavBadge();
  renderFavPanel();
  updateFavButtons();
  if (removed) showToast(`Removed "${removed.Title}" from favourites`);
}

function updateFavBadge() {
  const count = state.favourites.length;
  DOM.favBadge.textContent = count;
  DOM.favBadge.classList.toggle('hidden', count === 0);
}

function updateFavButtons() {
  DOM.movieGrid.querySelectorAll('.card__fav').forEach(btn => {
    const fav = isFavourite(btn.dataset.imdbid);
    btn.classList.toggle('active', fav);
    btn.textContent = fav ? '♥' : '♡';
    btn.setAttribute('aria-label', fav ? 'Remove from favourites' : 'Add to favourites');
  });
}

// ─── 12. PAGINATION ───────────────────────────────────────────────
function updatePagination() {
  // TMDB caps results at 500 pages regardless of total_pages
  const maxPages = Math.min(state.totalPages, 500);

  if (maxPages <= 1) {
    DOM.pagination.hidden = true;
    return;
  }

  DOM.pagination.hidden = false;
  DOM.pageInfo.textContent = `Page ${state.currentPage} / ${maxPages}`;
  DOM.prevBtn.disabled = state.currentPage <= 1;
  DOM.nextBtn.disabled = state.currentPage >= maxPages;
}

// ─── 13. UI HELPERS ───────────────────────────────────────────────
function showSkeleton()   { renderSkeletons(); DOM.skeletonGrid.hidden = false; }
function hideSkeleton()   { DOM.skeletonGrid.hidden = true; }
function showGrid()       { DOM.movieGrid.style.display = 'grid'; }
function hideGrid()       { DOM.movieGrid.style.display = 'none'; DOM.movieGrid.innerHTML = ''; }
function hideEmptyState() { DOM.emptyState.hidden = true; }

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

let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  DOM.toast.textContent = message;
  DOM.toast.classList.add('show');
  toastTimer = setTimeout(() => DOM.toast.classList.remove('show'), CONFIG.TOAST_DURATION);
}

/** Escape HTML to prevent XSS — always use on API data in innerHTML */
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
}

// ─── 14. DEBOUNCE ─────────────────────────────────────────────────
/**
 * Debounce — delays fn execution until user stops typing.
 * Prevents hammering the API on every keystroke.
 */
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

const debouncedSearch = debounce(() => handleSearch(1), CONFIG.DEBOUNCE_DELAY);

// ─── 15. EVENT LISTENERS ──────────────────────────────────────────
function attachEventListeners() {

  DOM.searchInput.addEventListener('input', () => {
    DOM.clearBtn.classList.toggle('visible', DOM.searchInput.value.length > 0);
    debouncedSearch();
  });

  DOM.searchBtn.addEventListener('click', () => handleSearch(1));

  DOM.searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSearch(1);
  });

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

  DOM.sortOrder.addEventListener('change', () => {
    state.sortOrder = DOM.sortOrder.value;
    applyFiltersAndSort();
    renderGrid(state.filtered);
  });

  DOM.typeFilter.addEventListener('change', () => {
    state.typeFilter = DOM.typeFilter.value;
    applyFiltersAndSort();
    renderGrid(state.filtered);
  });

  DOM.yearFilter.addEventListener('change', () => {
    state.yearFilter = DOM.yearFilter.value;
    applyFiltersAndSort();
    renderGrid(state.filtered);
  });

  DOM.prevBtn.addEventListener('click', () => {
    if (state.currentPage > 1) {
      handleSearch(state.currentPage - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  DOM.nextBtn.addEventListener('click', () => {
    if (state.currentPage < Math.min(state.totalPages, 500)) {
      handleSearch(state.currentPage + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  DOM.themeToggle.addEventListener('click', toggleTheme);

  DOM.favBtn.addEventListener('click', () => {
    DOM.favPanel.hidden = false;
    document.body.style.overflow = 'hidden';
  });

  DOM.closeFavBtn.addEventListener('click', closeFavPanel);
  DOM.favOverlay.addEventListener('click', closeFavPanel);

  DOM.modalClose.addEventListener('click', closeModal);
  DOM.modalOverlay.addEventListener('click', e => {
    if (e.target === DOM.modalOverlay) closeModal();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!DOM.modalOverlay.hidden) closeModal();
      if (!DOM.favPanel.hidden)     closeFavPanel();
    }
  });
}

function attachFavButtonListeners() {
  DOM.movieGrid.querySelectorAll('.card__fav').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation(); // prevent card click (modal) when clicking ♥
      const { imdbid, title, year, poster, type } = btn.dataset;
      const movie = { imdbID: imdbid, Title: title, Year: year, Poster: poster, Type: type };

      if (isFavourite(imdbid)) {
        removeFavourite(imdbid);
      } else {
        addFavourite(movie);
        btn.classList.add('active');
        btn.textContent = '♥';
      }
    });
  });
}

/** Cards now pass both TMDB id and mediaType to renderModal */
function attachCardClickListeners() {
  DOM.movieGrid.querySelectorAll('.card').forEach(card => {
    const openModal = () => renderModal(card.dataset.id, card.dataset.type);
    card.addEventListener('click', openModal);
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

// ─── 16. INJECT RATING BADGE STYLE ────────────────────────────────
/**
 * Adds the TMDB star-rating badge CSS dynamically.
 * (Keeps CSS additions co-located with the JS feature that needs it.)
 */
function injectRatingStyle() {
  const style = document.createElement('style');
  style.textContent = `
    .card__rating {
      position: absolute;
      bottom: 0.5rem;
      right: 0.5rem;
      padding: 3px 8px;
      border-radius: 4px;
      background: rgba(0,0,0,0.75);
      backdrop-filter: blur(6px);
      font-family: var(--font-mono);
      font-size: 0.68rem;
      color: var(--accent);
      font-weight: 600;
      letter-spacing: 0.5px;
    }
  `;
  document.head.appendChild(style);
}

// ─── 17. START THE APP ────────────────────────────────────────────
init();
