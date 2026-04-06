// ======================================================
// BROWSE-X | script.js
// Beginner friendly — every line explained
// Powered by TMDB API (themoviedb.org)
// ======================================================

// ---- YOUR API KEY ----
// Get it free from: https://www.themoviedb.org/settings/api
var API_KEY = "e77858412d1571020f642635a32b79a6";

// ---- TMDB URLs (do not change) ----
var API_URL = "https://api.themoviedb.org/3";
var IMG_URL = "https://image.tmdb.org/t/p/w500";


// ======================================================
// VARIABLES — remember things while the app is running
// ======================================================
var currentPage   = 1;    // which page of results we are on
var totalPages    = 0;    // how many pages exist in total
var totalResults  = 0;    // total number of results from TMDB
var currentQuery  = "";   // what the user searched for
var allMovies     = [];   // all movies fetched from the API
var filteredMovies = [];  // movies after filter/sort is applied
var favourites    = [];   // movies the user saved as favourite
var currentTheme  = "dark"; // current colour theme
var debounceTimer = null; // used to delay auto-search while typing


// ======================================================
// GET HTML ELEMENTS
// — we grab every element we need from the page once
// ======================================================
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
var toast        = document.getElementById("toast");
var toastTimer   = null;


// ======================================================
// START THE APP — this runs first when the page loads
// ======================================================
function startApp() {
  loadFromStorage();          // load saved theme + favourites
  applyTheme(currentTheme);   // set dark or light mode
  updateFavBadge();           // show correct number on heart icon
  fixTypeDropdown();          // update dropdown for TMDB types
  addRatingStyle();           // add CSS for star rating badge on cards
  setupListeners();           // connect all buttons and inputs
  renderFavPanel();           // fill the favourites drawer
  loadTrending();             // show trending movies on homepage
}


// ======================================================
// LOAD TRENDING MOVIES — shown on the homepage
// ======================================================
async function loadTrending() {
  // Show skeleton cards while waiting for data
  showSkeleton();

  try {
    // Call TMDB trending endpoint
    var url      = API_URL + "/trending/all/week?api_key=" + API_KEY + "&language=en-US";
    var response = await fetch(url);
    var data     = await response.json();

    hideSkeleton();

    // Build list of only movies and TV (not people)
    var trending = [];
    for (var i = 0; i < data.results.length; i++) {
      var item = data.results[i];
      if (item.media_type === "movie" || item.media_type === "tv") {
        trending.push(makeMovieObject(item));
      }
    }

    // Save and display
    allMovies      = trending;
    filteredMovies = trending;
    totalResults   = trending.length;
    totalPages     = 1;

    paintCards(filteredMovies);
    resultsCount.textContent = "🔥 Trending this week";

  } catch (err) {
    hideSkeleton();
    console.log("Could not load trending:", err);
  }
}


// ======================================================
// SEARCH — called when user clicks Search or presses Enter
// ======================================================
async function handleSearch(page) {
  // Default to page 1 if not given
  if (!page) page = 1;

  var query = searchInput.value.trim();

  // Stop if search box is empty
  if (!query) {
    showEmpty("Search for a movie above", "Type a title and hit Search.");
    return;
  }

  currentQuery = query;
  currentPage  = page;

  // Reset the page for a fresh search
  emptyState.hidden        = true;
  movieGrid.innerHTML      = "";
  movieGrid.style.display  = "none";
  pagination.hidden        = true;
  resultsCount.textContent = "";

  // Show loading skeleton
  showSkeleton();

  try {
    // Call the API
    var result = await searchMovies(query, page);

    hideSkeleton();

    // No results found
    if (result.movies.length === 0) {
      showEmpty("No Results Found", "Nothing matched \"" + query + "\". Try a different title.");
      return;
    }

    // Save results to our variables
    allMovies    = result.movies;
    totalResults = result.totalResults;
    totalPages   = result.totalPages;

    // Apply filter and sort, then show the cards
    applyFiltersAndSort();
    paintCards(filteredMovies);

    // Show how many results were found
    resultsCount.textContent = totalResults.toLocaleString() + " results for \"" + query + "\"";

    // Show or hide prev/next buttons
    updatePagination();

  } catch (err) {
    hideSkeleton();
    console.log("Search error:", err);
    showEmpty("Something went wrong", "Check your internet connection or API key.");
  }
}


// ======================================================
// CALL TMDB SEARCH API
// ======================================================
async function searchMovies(query, page) {
  // Build the URL with all required parameters
  var url = API_URL + "/search/multi"
    + "?api_key="         + API_KEY
    + "&query="           + encodeURIComponent(query)
    + "&page="            + page
    + "&language=en-US"
    + "&include_adult=false";

  var response = await fetch(url);
  var data     = await response.json();

  // Check if TMDB returned an error (e.g. bad API key)
  if (data.success === false) {
    throw new Error(data.status_message);
  }

  // Keep only movies and TV shows — filter out people
  var mediaOnly = [];
  for (var i = 0; i < data.results.length; i++) {
    var item = data.results[i];
    if (item.media_type === "movie" || item.media_type === "tv") {
      mediaOnly.push(item);
    }
  }

  // Convert raw TMDB data into simple objects our app can use
  var cleanList = [];
  for (var j = 0; j < mediaOnly.length; j++) {
    cleanList.push(makeMovieObject(mediaOnly[j]));
  }

  return {
    movies:       cleanList,
    totalResults: data.total_results || 0,
    totalPages:   data.total_pages   || 0
  };
}


// ======================================================
// CONVERT RAW TMDB ITEM INTO A SIMPLE OBJECT
// — TMDB movies use "title" but TV shows use "name"
// — This function makes them all look the same
// ======================================================
function makeMovieObject(item) {
  var isTV = (item.media_type === "tv");

  var title  = isTV ? item.name           : item.title;
  var date   = isTV ? item.first_air_date : item.release_date;
  var year   = (date && date.length >= 4) ? date.slice(0, 4) : "N/A";
  var poster = item.poster_path ? IMG_URL + item.poster_path : "N/A";
  var rating = item.vote_average ? item.vote_average.toFixed(1) : "N/A";

  return {
    id:     String(item.id),
    title:  title  || "Untitled",
    year:   year,
    type:   item.media_type,   // "movie" or "tv"
    poster: poster,
    rating: rating
  };
}


// ======================================================
// FILTER AND SORT — runs every time a dropdown changes
// ======================================================
function applyFiltersAndSort() {
  // Start with all the movies we fetched
  var results = allMovies.slice(); // .slice() makes a copy

  // --- Filter by type (Movie or TV) ---
  var selectedType = typeFilter.value;
  if (selectedType) {
    var byType = [];
    for (var i = 0; i < results.length; i++) {
      if (results[i].type === selectedType) {
        byType.push(results[i]);
      }
    }
    results = byType;
  }

  // --- Filter by decade ---
  var selectedDecade = yearFilter.value;
  if (selectedDecade) {
    var dec = parseInt(selectedDecade);
    var byYear = [];
    for (var j = 0; j < results.length; j++) {
      var y = parseInt(results[j].year);
      if (dec === 1980) {
        if (y < 1990) byYear.push(results[j]); // 1980s and older
      } else {
        if (y >= dec && y < dec + 10) byYear.push(results[j]); // exact decade
      }
    }
    results = byYear;
  }

  // --- Sort ---
  var order = sortOrder.value;
  if (order === "az") {
    // A to Z by title
    results.sort(function(a, b) { return a.title.localeCompare(b.title); });
  } else if (order === "za") {
    // Z to A by title
    results.sort(function(a, b) { return b.title.localeCompare(a.title); });
  } else if (order === "newest") {
    // Newest year first
    results.sort(function(a, b) { return parseInt(b.year) - parseInt(a.year); });
  } else if (order === "oldest") {
    // Oldest year first
    results.sort(function(a, b) { return parseInt(a.year) - parseInt(b.year); });
  }

  filteredMovies = results;
}


// ======================================================
// PAINT CARDS — put movie cards on the page
// ======================================================
function paintCards(movies) {
  // If nothing to show after filtering
  if (movies.length === 0) {
    showEmpty("No Results After Filtering", "Try removing or adjusting your filters.");
    return;
  }

  // Build HTML for all cards
  var html = "";
  for (var i = 0; i < movies.length; i++) {
    html += makeCardHTML(movies[i]);
  }

  // Put all cards into the grid and show it
  movieGrid.innerHTML    = html;
  movieGrid.style.display = "grid";
  emptyState.hidden      = true;

  // Add click events to all the heart (favourite) buttons
  addHeartListeners();
}


// ======================================================
// BUILD ONE CARD'S HTML
// ======================================================
function makeCardHTML(movie) {
  var isFav      = isFavourite(movie.id);
  var heart      = isFav ? "♥" : "♡";
  var heartClass = isFav ? "card__fav active" : "card__fav";
  var badgeClass = (movie.type === "tv") ? "card__badge--series" : "card__badge--movie";
  var typeLabel  = (movie.type === "tv") ? "TV" : "Movie";
  var ratingBadge = (movie.rating !== "N/A") ? '<span class="card__rating">★ ' + movie.rating + '</span>' : "";

  // Show poster image or a placeholder
  var posterHTML;
  if (movie.poster !== "N/A") {
    posterHTML = '<img class="card__poster" src="' + movie.poster + '" alt="' + movie.title + '" loading="lazy">';
  } else {
    posterHTML = '<div class="card__no-poster">🎬<span>No Image</span></div>';
  }

  return (
    '<article class="card" tabindex="0">'
    + '<div class="card__poster-wrap">'
    + posterHTML
    + '<span class="card__badge ' + badgeClass + '">' + typeLabel + '</span>'
    + ratingBadge
    + '<button class="' + heartClass + '"'
    + ' data-id="'     + movie.id     + '"'
    + ' data-title="'  + movie.title  + '"'
    + ' data-year="'   + movie.year   + '"'
    + ' data-poster="' + movie.poster + '"'
    + ' data-type="'   + movie.type   + '">'
    + heart
    + '</button>'
    + '</div>'
    + '<div class="card__info">'
    + '<h3 class="card__title">' + movie.title + '</h3>'
    + '<div class="card__meta"><span class="card__year">' + movie.year + '</span></div>'
    + '</div>'
    + '</article>'
  );
}


// ======================================================
// SKELETON LOADING — show/hide grey placeholder cards
// ======================================================
function showSkeleton() {
  // Build 20 skeleton cards
  var html = "";
  for (var i = 0; i < 20; i++) {
    html += '<div class="skeleton-card">'
      + '<div class="skeleton-poster"></div>'
      + '<div class="skeleton-info">'
      + '<div class="skeleton-line"></div>'
      + '<div class="skeleton-line skeleton-line--short"></div>'
      + '</div>'
      + '</div>';
  }
  skeletonGrid.innerHTML = html;
  skeletonGrid.hidden    = false;
}

function hideSkeleton() {
  skeletonGrid.hidden = true;
}


// ======================================================
// EMPTY STATE — show a message when there are no results
// ======================================================
function showEmpty(title, sub) {
  hideSkeleton();
  movieGrid.innerHTML      = "";
  movieGrid.style.display  = "none";
  emptyTitle.textContent   = title;
  emptySub.textContent     = sub;
  emptyState.hidden        = false;
  pagination.hidden        = true;
}


// ======================================================
// PAGINATION — prev / next page buttons
// ======================================================
function updatePagination() {
  var maxPages = Math.min(totalPages, 500); // TMDB allows max 500 pages

  if (maxPages <= 1) {
    pagination.hidden = true;
    return;
  }

  pagination.hidden    = false;
  pageInfo.textContent = "Page " + currentPage + " / " + maxPages;
  prevBtn.disabled     = (currentPage <= 1);
  nextBtn.disabled     = (currentPage >= maxPages);
}


// ======================================================
// FAVOURITES
// ======================================================

// Check if a movie is already in the favourites list
function isFavourite(id) {
  for (var i = 0; i < favourites.length; i++) {
    if (favourites[i].id === id) return true;
  }
  return false;
}

// Add a movie to favourites
function addFav(movie) {
  if (isFavourite(movie.id)) return; // don't add duplicates
  favourites.push(movie);
  saveToStorage();
  updateFavBadge();
  renderFavPanel();
  showToast("♥ \"" + movie.title + "\" added to favourites");
}

// Remove a movie from favourites
function removeFav(id) {
  var removedTitle = "";
  var newList = [];

  for (var i = 0; i < favourites.length; i++) {
    if (favourites[i].id === id) {
      removedTitle = favourites[i].title; // save title for toast message
    } else {
      newList.push(favourites[i]); // keep everything else
    }
  }

  favourites = newList;
  saveToStorage();
  updateFavBadge();
  renderFavPanel();
  refreshHearts(); // update ♥/♡ icons on visible cards

  if (removedTitle) showToast("Removed \"" + removedTitle + "\" from favourites");
}

// Update the number shown on the heart icon in the header
function updateFavBadge() {
  favBadge.textContent = favourites.length;
  // Hide the badge if no favourites
  if (favourites.length === 0) {
    favBadge.classList.add("hidden");
  } else {
    favBadge.classList.remove("hidden");
  }
}

// Refresh heart icons on all currently visible cards
function refreshHearts() {
  var heartBtns = movieGrid.querySelectorAll(".card__fav");
  for (var i = 0; i < heartBtns.length; i++) {
    var btn = heartBtns[i];
    var fav = isFavourite(btn.dataset.id);
    btn.textContent = fav ? "♥" : "♡";
    if (fav) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  }
}

// Build and show the favourites drawer content
function renderFavPanel() {
  // Show "no favourites" message if list is empty
  if (favourites.length === 0) {
    favList.innerHTML = "";
    favEmpty.hidden   = false;
    return;
  }

  favEmpty.hidden = true;
  var html = "";

  for (var i = 0; i < favourites.length; i++) {
    var f         = favourites[i];
    var src       = (f.poster !== "N/A") ? f.poster : "";
    var typeLabel = (f.type === "tv") ? "TV Show" : "Movie";

    html += '<div class="fav-item">'
      + '<img class="fav-item__poster" src="' + src + '" alt="' + f.title + '" onerror="this.style.display=\'none\'">'
      + '<div class="fav-item__info">'
      + '<p class="fav-item__title">' + f.title + '</p>'
      + '<p class="fav-item__meta">'  + f.year  + ' · ' + typeLabel + '</p>'
      + '</div>'
      + '<button class="fav-item__remove" data-id="' + f.id + '">✕</button>'
      + '</div>';
  }

  favList.innerHTML = html;

  // Add click listener to each remove button
  var removeBtns = favList.querySelectorAll(".fav-item__remove");
  for (var j = 0; j < removeBtns.length; j++) {
    removeBtns[j].addEventListener("click", function(e) {
      e.stopPropagation();
      removeFav(this.dataset.id);
    });
  }
}


// ======================================================
// LOCAL STORAGE — save and load data between page visits
// ======================================================

// Save favourites and theme to the browser
function saveToStorage() {
  localStorage.setItem("bx_favourites", JSON.stringify(favourites));
  localStorage.setItem("bx_theme", currentTheme);
}

// Load favourites and theme when the page opens
function loadFromStorage() {
  var savedFavs  = localStorage.getItem("bx_favourites");
  var savedTheme = localStorage.getItem("bx_theme");
  if (savedFavs)  favourites   = JSON.parse(savedFavs);
  if (savedTheme) currentTheme = savedTheme;
}


// ======================================================
// THEME — dark / light mode
// ======================================================
function toggleTheme() {
  if (currentTheme === "dark") {
    currentTheme = "light";
  } else {
    currentTheme = "dark";
  }
  applyTheme(currentTheme);
  saveToStorage();
}

function applyTheme(theme) {
  // Setting data-theme on <html> makes CSS variables switch automatically
  document.documentElement.setAttribute("data-theme", theme);
}


// ======================================================
// TOAST — small popup message at the bottom of the screen
// ======================================================
function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  // Hide the toast after 2.8 seconds
  toastTimer = setTimeout(function() {
    toast.classList.remove("show");
  }, 2800);
}


// ======================================================
// DEBOUNCE — wait until user stops typing before searching
// Without this, a search fires for every single letter typed
// ======================================================
function debouncedSearch() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(function() {
    handleSearch(1);
  }, 500); // wait 500ms after last keystroke
}


// ======================================================
// HEART BUTTON LISTENERS — add/remove favourites on cards
// ======================================================
function addHeartListeners() {
  var heartBtns = movieGrid.querySelectorAll(".card__fav");

  for (var i = 0; i < heartBtns.length; i++) {
    heartBtns[i].addEventListener("click", function(e) {
      e.stopPropagation(); // stop the card click from firing too

      var id     = this.dataset.id;
      var movie  = {
        id:     this.dataset.id,
        title:  this.dataset.title,
        year:   this.dataset.year,
        poster: this.dataset.poster,
        type:   this.dataset.type
      };

      if (isFavourite(id)) {
        removeFav(id);
      } else {
        addFav(movie);
        this.classList.add("active");
        this.textContent = "♥";
      }
    });
  }
}


// ======================================================
// SETUP ALL EVENT LISTENERS — connect buttons to functions
// ======================================================
function setupListeners() {

  // When user types in the search box
  searchInput.addEventListener("input", function() {
    // Show or hide the X clear button
    if (searchInput.value.length > 0) {
      clearBtn.classList.add("visible");
    } else {
      clearBtn.classList.remove("visible");
    }
    debouncedSearch(); // auto-search after typing stops
  });

  // When user clicks the Search button
  searchBtn.addEventListener("click", function() {
    handleSearch(1);
  });

  // When user presses Enter in the search box
  searchInput.addEventListener("keydown", function(e) {
    if (e.key === "Enter") handleSearch(1);
  });

  // When user clicks the X button to clear search
  clearBtn.addEventListener("click", function() {
    searchInput.value        = "";
    clearBtn.classList.remove("visible");
    searchInput.focus();
    movieGrid.innerHTML      = "";
    movieGrid.style.display  = "none";
    emptyState.hidden        = true;
    skeletonGrid.hidden      = true;
    pagination.hidden        = true;
    resultsCount.textContent = "";
    allMovies      = [];
    filteredMovies = [];
  });

  // When sort dropdown changes
  sortOrder.addEventListener("change", function() {
    if (allMovies.length > 0) {
      applyFiltersAndSort();
      paintCards(filteredMovies);
    }
  });

  // When type filter changes (Movie / TV Show)
  typeFilter.addEventListener("change", function() {
    if (allMovies.length > 0) {
      applyFiltersAndSort();
      paintCards(filteredMovies);
    }
  });

  // When year filter changes
  yearFilter.addEventListener("change", function() {
    if (allMovies.length > 0) {
      applyFiltersAndSort();
      paintCards(filteredMovies);
    }
  });

  // Previous page button
  prevBtn.addEventListener("click", function() {
    if (currentPage > 1) {
      handleSearch(currentPage - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  // Next page button
  nextBtn.addEventListener("click", function() {
    if (currentPage < Math.min(totalPages, 500)) {
      handleSearch(currentPage + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  // Dark / Light mode toggle
  themeToggle.addEventListener("click", function() {
    toggleTheme();
  });

  // Open favourites drawer
  favBtn.addEventListener("click", function() {
    favPanel.hidden              = false;
    document.body.style.overflow = "hidden"; // stop background scrolling
  });

  // Close favourites drawer (X button)
  closeFavBtn.addEventListener("click", function() {
    favPanel.hidden              = true;
    document.body.style.overflow = "";
  });

  // Close favourites drawer (clicking the dark overlay)
  favOverlay.addEventListener("click", function() {
    favPanel.hidden              = true;
    document.body.style.overflow = "";
  });

  // Close with Escape key
  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape" && !favPanel.hidden) {
      favPanel.hidden              = true;
      document.body.style.overflow = "";
    }
  });
}


// ======================================================
// FIX TYPE DROPDOWN — TMDB uses "tv" not "series"
// ======================================================
function fixTypeDropdown() {
  typeFilter.innerHTML =
    '<option value="">All Types</option>'
    + '<option value="movie">Movies</option>'
    + '<option value="tv">TV Shows</option>';
}


// ======================================================
// ADD STAR RATING BADGE STYLE
// ======================================================
function addRatingStyle() {
  var style = document.createElement("style");
  style.textContent =
    ".card__rating {"
    + "  position: absolute;"
    + "  bottom: 0.5rem;"
    + "  right: 0.5rem;"
    + "  padding: 3px 8px;"
    + "  border-radius: 4px;"
    + "  background: rgba(0,0,0,0.75);"
    + "  backdrop-filter: blur(6px);"
    + "  font-family: var(--font-mono);"
    + "  font-size: 0.68rem;"
    + "  color: var(--accent);"
    + "  font-weight: 600;"
    + "}";
  document.head.appendChild(style);
}


// ======================================================
// RUN THE APP
// ======================================================
startApp();
