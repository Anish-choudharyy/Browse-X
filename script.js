var API_KEY = "e77858412d1571020f642635a32b79a6";

// TMDB URLs — do not change these
var API_URL  = "https://api.themoviedb.org/3";
var IMG_URL  = "https://image.tmdb.org/t/p/w500";
var IMG_BIG  = "https://image.tmdb.org/t/p/w780";


// =====================================================
// APP STATE — variables that store current app data
// =====================================================
var currentQuery   = "";
var currentPage    = 1;
var totalPages     = 0;
var totalResults   = 0;
var allMovies      = [];
var filteredMovies = [];
var favourites     = [];
var currentTheme   = "dark";
var debounceTimer  = null;


// =====================================================
// GET HTML ELEMENTS
// =====================================================
var searchInput  = document.getElementById("searchInput");
var searchBtn    = document.getElementById("searchBtn");
var clearBtn     = document.getElementById("clearBtn");
var movieGrid    = document.getElementById("movieGrid");
var skeletonGrid = document.getElementById("skeletonGrid");
var emptyState   = document.getElementById("emptyState");
var emptyTitle   = document.getElementById("emptyTitle");
var emptySub     = document.getElementById("emptySub");
var resultsCount = document.getElementById("resultsCount");
var pagination   = document.getElementById("pagination");
var prevBtn      = document.getElementById("prevBtn");
var nextBtn      = document.getElementById("nextBtn");
var pageInfo     = document.getElementById("pageInfo");
var sortOrder    = document.getElementById("sortOrder");
var typeFilter   = document.getElementById("typeFilter");
var yearFilter   = document.getElementById("yearFilter");
var favBtn       = document.getElementById("favBtn");
var favBadge     = document.getElementById("favBadge");
var favPanel     = document.getElementById("favPanel");
var favOverlay   = document.getElementById("favOverlay");
var closeFavBtn  = document.getElementById("closeFavBtn");
var favList      = document.getElementById("favList");
var favEmpty     = document.getElementById("favEmpty");
var themeToggle  = document.getElementById("themeToggle");
var modalOverlay = document.getElementById("modalOverlay");
var modalClose   = document.getElementById("modalClose");
var modalContent = document.getElementById("modalContent");
var toast        = document.getElementById("toast");


// =====================================================
// START THE APP
// =====================================================
function startApp() {
  loadFromStorage();
  applyTheme(currentTheme);
  updateFavBadge();
  fixTypeDropdown();
  addRatingBadgeStyle();
  setupEventListeners();
  renderFavPanel();
  loadTrending();
}



// =====================================================
// LOAD TRENDING MOVIES ON HOMEPAGE
// =====================================================
async function loadTrending() {
  if (API_KEY === "YOUR_API_KEY_HERE") return;

  var skelHTML = "";
  for (var s = 0; s < 20; s++) {
    skelHTML += '<div class="skeleton-card"><div class="skeleton-poster"></div><div class="skeleton-info"><div class="skeleton-line"></div><div class="skeleton-line skeleton-line--short"></div></div></div>';
  }
  skeletonGrid.innerHTML = skelHTML;
  skeletonGrid.hidden    = false;
  emptyState.hidden      = true;

  try {
    var url      = API_URL + "/trending/all/week?api_key=" + API_KEY + "&language=en-US";
    var response = await fetch(url);
    var data     = await response.json();
    skeletonGrid.hidden = true;
    if (!data.results || data.results.length === 0) return;
    var trending = [];
    for (var i = 0; i < data.results.length; i++) {
      var item = data.results[i];
      if (item.media_type === "movie" || item.media_type === "tv") {
        trending.push(makeMovie(item));
      }
    }
    allMovies = trending;
    filteredMovies = trending;
    totalResults = trending.length;
    totalPages = 1;
    paintCards(filteredMovies);
    resultsCount.textContent = "🔥 Trending this week";
  } catch (err) {
    skeletonGrid.hidden = true;
    console.log("Trending failed:", err);
  }
}

// =====================================================
// LOCAL STORAGE — save and load data
// =====================================================
function saveToStorage() {
  localStorage.setItem("bx_favourites", JSON.stringify(favourites));
  localStorage.setItem("bx_theme", currentTheme);
}

function loadFromStorage() {
  var savedFavs  = localStorage.getItem("bx_favourites");
  var savedTheme = localStorage.getItem("bx_theme");
  if (savedFavs)  favourites   = JSON.parse(savedFavs);
  if (savedTheme) currentTheme = savedTheme;
}


// =====================================================
// DARK / LIGHT THEME
// =====================================================
function toggleTheme() {
  currentTheme = (currentTheme === "dark") ? "light" : "dark";
  applyTheme(currentTheme);
  saveToStorage();
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}


// =====================================================
// API — FETCH MOVIES FROM TMDB
// =====================================================

async function searchMovies(query, page) {
  var url = API_URL + "/search/multi"
    + "?api_key="         + API_KEY
    + "&query="           + encodeURIComponent(query)
    + "&page="            + page
    + "&language=en-US"
    + "&include_adult=false";

  var response = await fetch(url);
  var data     = await response.json();

  // TMDB returns an error like { status_message: "...", success: false }
  // when the API key is wrong
  if (data.success === false) {
    throw new Error("TMDB Error: " + data.status_message);
  }

  // Keep only movies and tv shows — remove "person" results
  var mediaOnly = [];
  for (var i = 0; i < data.results.length; i++) {
    var item = data.results[i];
    if (item.media_type === "movie" || item.media_type === "tv") {
      mediaOnly.push(item);
    }
  }

  // Convert each item to a simple clean object
  var cleanList = [];
  for (var j = 0; j < mediaOnly.length; j++) {
    cleanList.push(makeMovie(mediaOnly[j]));
  }

  return {
    movies:       cleanList,
    totalResults: data.total_results || 0,
    totalPages:   data.total_pages   || 0
  };
}

// TMDB movies have "title" but TV shows have "name" — this evens them out
function makeMovie(item) {
  var isTV   = (item.media_type === "tv");
  var title  = isTV ? item.name           : item.title;
  var date   = isTV ? item.first_air_date : item.release_date;
  var year   = (date && date.length >= 4) ? date.slice(0, 4) : "N/A";
  var poster = item.poster_path ? (IMG_URL + item.poster_path) : "N/A";
  var rating = item.vote_average ? item.vote_average.toFixed(1) : "N/A";

  return {
    id:       String(item.id),
    title:    title   || "Untitled",
    year:     year,
    type:     item.media_type,
    poster:   poster,
    rating:   rating,
    overview: item.overview || ""
  };
}

// Fetch full details for the movie detail popup
async function getDetails(id, type) {
  var url = API_URL + "/" + type + "/" + id
    + "?api_key="             + API_KEY
    + "&append_to_response=credits"
    + "&language=en-US";

  var response = await fetch(url);
  return response.json();
}


// =====================================================
// MAIN SEARCH HANDLER
// =====================================================

async function handleSearch(page) {
  if (!page) page = 1;

  var query = searchInput.value.trim();

  // Empty search box
  if (!query) {
    showEmpty("Search for a movie above", "Type a title and hit Search.");
    return;
  }

  // API key not set
  if (API_KEY === "YOUR_API_KEY_HERE") {
    showEmpty("API Key Missing!", "Open script.js and replace YOUR_API_KEY_HERE with your real TMDB API key.");
    return;
  }

  currentQuery  = query;
  currentPage   = page;

  // --- Show loading state ---
  emptyState.hidden      = true;   // hide "no results" message
  movieGrid.innerHTML    = "";     // clear old cards
  movieGrid.style.display = "none"; // hide grid
  pagination.hidden      = true;   // hide pagination
  resultsCount.textContent = "";

  // Show skeleton cards
  var skelHTML = "";
  for (var s = 0; s < 20; s++) {
    skelHTML += '<div class="skeleton-card"><div class="skeleton-poster"></div>'
      + '<div class="skeleton-info"><div class="skeleton-line"></div>'
      + '<div class="skeleton-line skeleton-line--short"></div></div></div>';
  }
  skeletonGrid.innerHTML = skelHTML;
  skeletonGrid.hidden    = false;

  // --- Call the API ---
  try {
    var result = await searchMovies(query, page);

    // Hide skeleton NOW — before showing anything else
    skeletonGrid.hidden = true;

    if (result.movies.length === 0) {
      showEmpty("No Results Found", "Nothing matched \"" + query + "\". Try a different title.");
      resultsCount.textContent = "";
      return;
    }

    // Save results
    allMovies    = result.movies;
    totalResults = result.totalResults;
    totalPages   = result.totalPages;

    // Filter + sort
    applyFiltersAndSort();

    // Paint the cards
    paintCards(filteredMovies);

    // Update results count text
    resultsCount.textContent = totalResults.toLocaleString() + " results for \"" + query + "\"";

    // Update pagination
    showPagination();

  } catch (err) {
    // Hide skeleton on error too
    skeletonGrid.hidden = true;
    console.error("Browse-X Error:", err);
    showEmpty("Error: " + err.message, "Check your API key in script.js and your internet connection.");
  }
}


// =====================================================
// FILTER AND SORT
// =====================================================
function applyFiltersAndSort() {
  var results = allMovies.slice();

  // Filter by type
  var type = typeFilter.value;
  if (type) {
    var typed = [];
    for (var i = 0; i < results.length; i++) {
      if (results[i].type === type) typed.push(results[i]);
    }
    results = typed;
  }

  // Filter by decade
  var decade = yearFilter.value;
  if (decade) {
    var dec = parseInt(decade);
    var byYear = [];
    for (var j = 0; j < results.length; j++) {
      var y = parseInt(results[j].year);
      if (dec === 1980) {
        if (y < 1990) byYear.push(results[j]);
      } else {
        if (y >= dec && y < dec + 10) byYear.push(results[j]);
      }
    }
    results = byYear;
  }

  // Sort
  var order = sortOrder.value;
  if (order === "az") {
    results.sort(function(a, b) { return a.title.localeCompare(b.title); });
  } else if (order === "za") {
    results.sort(function(a, b) { return b.title.localeCompare(a.title); });
  } else if (order === "newest") {
    results.sort(function(a, b) { return parseInt(b.year) - parseInt(a.year); });
  } else if (order === "oldest") {
    results.sort(function(a, b) { return parseInt(a.year) - parseInt(b.year); });
  }

  filteredMovies = results;
}


// =====================================================
// PAINT CARDS ON THE PAGE
// =====================================================
function paintCards(movies) {
  if (movies.length === 0) {
    showEmpty("No Results After Filtering", "Try removing or adjusting your filters.");
    return;
  }

  var html = "";
  for (var i = 0; i < movies.length; i++) {
    html += makeCardHTML(movies[i]);
  }

  movieGrid.innerHTML     = html;
  movieGrid.style.display = "grid";  // show the grid
  emptyState.hidden       = true;    // make sure empty message is gone

  // Attach click listeners
  addHeartListeners();
  addCardListeners();
}

function makeCardHTML(movie) {
  var isFav      = isFavourite(movie.id);
  var heart      = isFav ? "♥" : "♡";
  var heartClass = isFav ? "card__fav active" : "card__fav";
  var badgeClass = (movie.type === "tv") ? "card__badge--series" : "card__badge--movie";
  var typeLabel  = (movie.type === "tv") ? "TV" : "Movie";
  var rating     = (movie.rating !== "N/A") ? '<span class="card__rating">★ ' + movie.rating + '</span>' : "";

  var posterHTML;
  if (movie.poster !== "N/A") {
    posterHTML = '<img class="card__poster" src="' + movie.poster + '" alt="' + movie.title + '" loading="lazy">';
  } else {
    posterHTML = '<div class="card__no-poster">🎬<span>No Image</span></div>';
  }

  return '<article class="card" data-id="' + movie.id + '" data-type="' + movie.type + '" tabindex="0" role="button">'
    + '<div class="card__poster-wrap">'
    + posterHTML
    + '<span class="card__badge ' + badgeClass + '">' + typeLabel + '</span>'
    + rating
    + '<button class="' + heartClass + '" data-id="' + movie.id + '" data-title="' + movie.title
    + '" data-year="' + movie.year + '" data-poster="' + movie.poster + '" data-type="' + movie.type + '">'
    + heart + '</button>'
    + '</div>'
    + '<div class="card__info">'
    + '<h3 class="card__title">' + movie.title + '</h3>'
    + '<div class="card__meta"><span class="card__year">' + movie.year + '</span></div>'
    + '</div>'
    + '</article>';
}


// =====================================================
// SHOW / HIDE HELPERS
// =====================================================
function showEmpty(title, sub) {
  skeletonGrid.hidden       = true;
  movieGrid.style.display   = "none";
  movieGrid.innerHTML       = "";
  emptyTitle.textContent    = title;
  emptySub.textContent      = sub;
  emptyState.hidden         = false;
  pagination.hidden         = true;
}

function showPagination() {
  var maxPages = Math.min(totalPages, 500);
  if (maxPages <= 1) {
    pagination.hidden = true;
    return;
  }
  pagination.hidden         = false;
  pageInfo.textContent      = "Page " + currentPage + " / " + maxPages;
  prevBtn.disabled          = (currentPage <= 1);
  nextBtn.disabled          = (currentPage >= maxPages);
}


// =====================================================
// FAVOURITES
// =====================================================
function isFavourite(id) {
  for (var i = 0; i < favourites.length; i++) {
    if (favourites[i].id === id) return true;
  }
  return false;
}

function addFav(movie) {
  if (isFavourite(movie.id)) return;
  favourites.push(movie);
  saveToStorage();
  updateFavBadge();
  renderFavPanel();
  showToast("♥ \"" + movie.title + "\" added to favourites");
}

function removeFav(id) {
  var title = "";
  var newList = [];
  for (var i = 0; i < favourites.length; i++) {
    if (favourites[i].id === id) {
      title = favourites[i].title;
    } else {
      newList.push(favourites[i]);
    }
  }
  favourites = newList;
  saveToStorage();
  updateFavBadge();
  renderFavPanel();
  refreshHearts();
  if (title) showToast("Removed \"" + title + "\" from favourites");
}

function updateFavBadge() {
  favBadge.textContent = favourites.length;
  favBadge.classList.toggle("hidden", favourites.length === 0);
}

function refreshHearts() {
  var btns = movieGrid.querySelectorAll(".card__fav");
  for (var i = 0; i < btns.length; i++) {
    var btn = btns[i];
    var fav = isFavourite(btn.dataset.id);
    btn.textContent = fav ? "♥" : "♡";
    btn.classList.toggle("active", fav);
  }
}

function renderFavPanel() {
  if (favourites.length === 0) {
    favList.innerHTML = "";
    favEmpty.hidden   = false;
    return;
  }
  favEmpty.hidden = true;
  var html = "";
  for (var i = 0; i < favourites.length; i++) {
    var f = favourites[i];
    var src = (f.poster !== "N/A") ? f.poster : "";
    var label = (f.type === "tv") ? "TV Show" : "Movie";
    html += '<div class="fav-item">'
      + '<img class="fav-item__poster" src="' + src + '" alt="' + f.title + '" onerror="this.style.display=\'none\'">'
      + '<div class="fav-item__info"><p class="fav-item__title">' + f.title + '</p>'
      + '<p class="fav-item__meta">' + f.year + ' · ' + label + '</p></div>'
      + '<button class="fav-item__remove" data-id="' + f.id + '">✕</button>'
      + '</div>';
  }
  favList.innerHTML = html;

  var removeBtns = favList.querySelectorAll(".fav-item__remove");
  for (var j = 0; j < removeBtns.length; j++) {
    removeBtns[j].addEventListener("click", function(e) {
      e.stopPropagation();
      removeFav(this.dataset.id);
    });
  }
}


// =====================================================
// MOVIE DETAIL MODAL
// =====================================================
async function showModal(id, type) {
  modalContent.innerHTML = '<div class="modal-loading">Loading details…</div>';
  modalOverlay.hidden    = false;
  document.body.style.overflow = "hidden";

  try {
    var item  = await getDetails(id, type);
    var isTV  = (type === "tv");

    var title   = isTV ? item.name           : item.title;
    var date    = isTV ? item.first_air_date : item.release_date;
    var year    = (date && date.length >= 4) ? date.slice(0, 4) : "N/A";
    var poster  = item.poster_path ? IMG_BIG + item.poster_path : "";
    var rating  = item.vote_average ? "★ " + item.vote_average.toFixed(1) : "N/A";
    var tagline = item.tagline  || "";
    var overview = item.overview || "No overview available.";
    var status  = item.status  || "N/A";
    var lang    = item.original_language ? item.original_language.toUpperCase() : "N/A";

    var runtime;
    if (isTV) {
      runtime = (item.episode_run_time && item.episode_run_time[0]) ? item.episode_run_time[0] + " min/ep" : "N/A";
    } else {
      runtime = item.runtime ? item.runtime + " min" : "N/A";
    }

    // Genres
    var genreTags = "";
    var genreText = "N/A";
    if (item.genres && item.genres.length > 0) {
      var names = [];
      for (var i = 0; i < item.genres.length; i++) {
        genreTags += '<span class="modal-tag">' + item.genres[i].name + '</span>';
        names.push(item.genres[i].name);
      }
      genreText = names.join(", ");
    }

    // Cast (top 5)
    var castText = "N/A";
    if (item.credits && item.credits.cast && item.credits.cast.length > 0) {
      var castNames = [];
      var limit = Math.min(5, item.credits.cast.length);
      for (var j = 0; j < limit; j++) {
        castNames.push(item.credits.cast[j].name);
      }
      castText = castNames.join(", ");
    }

    // Director or Creator
    var directorText = "N/A";
    if (!isTV && item.credits && item.credits.crew) {
      for (var k = 0; k < item.credits.crew.length; k++) {
        if (item.credits.crew[k].job === "Director") {
          directorText = item.credits.crew[k].name;
          break;
        }
      }
    } else if (isTV && item.created_by && item.created_by.length > 0) {
      var creators = [];
      for (var m = 0; m < item.created_by.length; m++) {
        creators.push(item.created_by[m].name);
      }
      directorText = creators.join(", ");
    }

    // Extra fields
    var extraHTML;
    if (isTV) {
      extraHTML = '<div class="modal-field"><span class="modal-field__label">Seasons</span>'
        + '<span class="modal-field__value">' + (item.number_of_seasons || "N/A") + '</span></div>'
        + '<div class="modal-field"><span class="modal-field__label">Episodes</span>'
        + '<span class="modal-field__value">' + (item.number_of_episodes || "N/A") + '</span></div>';
    } else {
      var budget  = item.budget  ? "$" + item.budget.toLocaleString()  : "N/A";
      var revenue = item.revenue ? "$" + item.revenue.toLocaleString() : "N/A";
      extraHTML = '<div class="modal-field"><span class="modal-field__label">Budget</span>'
        + '<span class="modal-field__value">' + budget + '</span></div>'
        + '<div class="modal-field"><span class="modal-field__label">Box Office</span>'
        + '<span class="modal-field__value">' + revenue + '</span></div>';
    }

    modalContent.innerHTML =
      '<div class="modal-hero">'
      + '<img class="modal-poster" src="' + poster + '" alt="' + title + '" onerror="this.style.display=\'none\'">'
      + '<div class="modal-meta">'
      + '<h2 class="modal-title">' + title + '</h2>'
      + (tagline ? '<p style="font-style:italic;color:var(--text-muted);font-size:0.82rem;margin-bottom:0.6rem;">"' + tagline + '"</p>' : "")
      + '<div class="modal-tags">'
      + '<span class="modal-tag modal-tag--accent">' + year + '</span>'
      + '<span class="modal-tag">' + runtime + '</span>'
      + '<span class="modal-tag">' + (isTV ? "TV Show" : "Movie") + '</span>'
      + '<span class="modal-tag">' + status + '</span>'
      + '</div>'
      + '<div class="modal-rating">' + rating + ' <span>/ 10 on TMDB</span></div>'
      + '<div class="modal-tags">' + genreTags + '</div>'
      + '</div></div>'
      + '<p class="modal-plot">' + overview + '</p>'
      + '<div class="modal-grid">'
      + '<div class="modal-field"><span class="modal-field__label">' + (isTV ? "Creator" : "Director") + '</span>'
      + '<span class="modal-field__value">' + directorText + '</span></div>'
      + '<div class="modal-field"><span class="modal-field__label">Cast</span>'
      + '<span class="modal-field__value">' + castText + '</span></div>'
      + '<div class="modal-field"><span class="modal-field__label">Language</span>'
      + '<span class="modal-field__value">' + lang + '</span></div>'
      + '<div class="modal-field"><span class="modal-field__label">Genres</span>'
      + '<span class="modal-field__value">' + genreText + '</span></div>'
      + extraHTML
      + '</div>';

  } catch (err) {
    modalContent.innerHTML = '<div class="modal-loading">Failed to load details.</div>';
  }
}

function closeModal() {
  modalOverlay.hidden = true;
  document.body.style.overflow = "";
}

function closeFavPanel() {
  favPanel.hidden = true;
  document.body.style.overflow = "";
}


// =====================================================
// TOAST NOTIFICATION
// =====================================================
var toastTimer = null;
function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = setTimeout(function() {
    toast.classList.remove("show");
  }, 2800);
}


// =====================================================
// DEBOUNCE — wait until user stops typing
// =====================================================
function debouncedSearch() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(function() {
    handleSearch(1);
  }, 500);
}


// =====================================================
// CARD & HEART CLICK LISTENERS
// =====================================================
function addHeartListeners() {
  var btns = movieGrid.querySelectorAll(".card__fav");
  for (var i = 0; i < btns.length; i++) {
    btns[i].addEventListener("click", function(e) {
      e.stopPropagation();
      var d = this.dataset;
      var movie = { id: d.id, title: d.title, year: d.year, poster: d.poster, type: d.type };
      if (isFavourite(d.id)) {
        removeFav(d.id);
      } else {
        addFav(movie);
        this.classList.add("active");
        this.textContent = "♥";
      }
    });
  }
}

function addCardListeners() {
  var cards = movieGrid.querySelectorAll(".card");
  for (var i = 0; i < cards.length; i++) {
    cards[i].addEventListener("click", function() {
      showModal(this.dataset.id, this.dataset.type);
    });
    cards[i].addEventListener("keydown", function(e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        showModal(this.dataset.id, this.dataset.type);
      }
    });
  }
}


// =====================================================
// SETUP EVENT LISTENERS — connect all buttons
// =====================================================
function setupEventListeners() {

  // Type in search box
  searchInput.addEventListener("input", function() {
    clearBtn.classList.toggle("visible", searchInput.value.length > 0);
    debouncedSearch();
  });

  // Click Search button
  searchBtn.addEventListener("click", function() {
    handleSearch(1);
  });

  // Press Enter in search box
  searchInput.addEventListener("keydown", function(e) {
    if (e.key === "Enter") handleSearch(1);
  });

  // Clear button (X)
  clearBtn.addEventListener("click", function() {
    searchInput.value = "";
    clearBtn.classList.remove("visible");
    searchInput.focus();
    movieGrid.innerHTML       = "";
    movieGrid.style.display   = "none";
    emptyState.hidden         = true;
    skeletonGrid.hidden       = true;
    pagination.hidden         = true;
    resultsCount.textContent  = "";
    allMovies      = [];
    filteredMovies = [];
  });

  // Sort changed
  sortOrder.addEventListener("change", function() {
    if (allMovies.length > 0) {
      applyFiltersAndSort();
      paintCards(filteredMovies);
    }
  });

  // Type filter changed
  typeFilter.addEventListener("change", function() {
    if (allMovies.length > 0) {
      applyFiltersAndSort();
      paintCards(filteredMovies);
    }
  });

  // Year filter changed
  yearFilter.addEventListener("change", function() {
    if (allMovies.length > 0) {
      applyFiltersAndSort();
      paintCards(filteredMovies);
    }
  });

  // Previous page
  prevBtn.addEventListener("click", function() {
    if (currentPage > 1) {
      handleSearch(currentPage - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  // Next page
  nextBtn.addEventListener("click", function() {
    if (currentPage < Math.min(totalPages, 500)) {
      handleSearch(currentPage + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  // Theme toggle
  themeToggle.addEventListener("click", toggleTheme);

  // Open favourites
  favBtn.addEventListener("click", function() {
    favPanel.hidden = false;
    document.body.style.overflow = "hidden";
  });

  // Close favourites
  closeFavBtn.addEventListener("click", closeFavPanel);
  favOverlay.addEventListener("click", closeFavPanel);

  // Close modal
  modalClose.addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", function(e) {
    if (e.target === modalOverlay) closeModal();
  });

  // Escape key closes panels
  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") {
      if (!modalOverlay.hidden) closeModal();
      if (!favPanel.hidden)     closeFavPanel();
    }
  });
}


// =====================================================
// FIX TYPE DROPDOWN FOR TMDB
// =====================================================
function fixTypeDropdown() {
  typeFilter.innerHTML =
    '<option value="">All Types</option>'
    + '<option value="movie">Movies</option>'
    + '<option value="tv">TV Shows</option>';
}


// =====================================================
// ADD RATING BADGE CSS
// =====================================================
function addRatingBadgeStyle() {
  var style = document.createElement("style");
  style.textContent = ".card__rating{"
    + "position:absolute;bottom:0.5rem;right:0.5rem;"
    + "padding:3px 8px;border-radius:4px;"
    + "background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);"
    + "font-family:var(--font-mono);font-size:0.68rem;"
    + "color:var(--accent);font-weight:600;letter-spacing:0.5px;}";
  document.head.appendChild(style);
}


// =====================================================
// START
// =====================================================
startApp();
