// =====================================================
// BROWSE-X | script.js
// Beginner friendly — every section explained simply
// Powered by TMDB (themoviedb.org)
// =====================================================


// ── YOUR API KEY ──
// Get a free key at: https://www.themoviedb.org/settings/api
var API_KEY = "e77858412d1571020f642635a32b79a6";

// ── TMDB URL (do not change) ──
var API_URL = "https://api.themoviedb.org/3";
var IMG_URL = "https://image.tmdb.org/t/p/w500";


// =====================================================
// VARIABLES
// These store information while the app is running
// =====================================================
var currentPage    = 1;      // which page of results we are on
var totalPages     = 0;      // how many pages exist in total
var totalResults   = 0;      // total number of results from TMDB
var currentQuery   = "";     // the last search the user typed
var allMovies      = [];     // all movies fetched from the API
var filteredMovies = [];     // movies after filter/sort is applied
var currentTheme   = "dark"; // "dark" or "light"
var debounceTimer  = null;   // used to delay auto-search while typing


// =====================================================
// HTML ELEMENTS
// Grab every element from the page that we need to use
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
var themeToggle  = document.getElementById("themeToggle");


// =====================================================
// START
// This is the first function that runs when the page loads
// =====================================================
function startApp() {
  loadTheme();      // restore saved dark/light preference
  addRatingStyle(); // add CSS for the star rating badge on cards
  setupListeners(); // connect all buttons and inputs to functions
  loadTrending();   // show trending movies on the homepage
}


// =====================================================
// LOAD TRENDING
// Fetches popular movies/shows from TMDB for the homepage
// =====================================================
async function loadTrending() {
  showSkeleton(); // show grey placeholder cards while loading

  try {
    var url      = API_URL + "/trending/all/week?api_key=" + API_KEY + "&language=en-US";
    var response = await fetch(url);
    var data     = await response.json();

    hideSkeleton();

    // Build a list of only movies and TV (TMDB also returns people — we skip those)
    var trending = [];
    for (var i = 0; i < data.results.length; i++) {
      var item = data.results[i];
      if (item.media_type === "movie" || item.media_type === "tv") {
        trending.push(makeMovieObject(item));
      }
    }

    // Save and display the results
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


// =====================================================
// HANDLE SEARCH
// Runs when the user clicks Search or presses Enter
// =====================================================
async function handleSearch(page) {
  if (!page) page = 1; // use page 1 by default

  var query = searchInput.value.trim(); // get text from the search box

  // Stop if the box is empty
  if (!query) {
    showEmpty("Search for a movie above", "Type a title and hit Search.");
    return;
  }

  currentQuery = query;
  currentPage  = page;

  // Reset the screen
  emptyState.hidden        = true;
  movieGrid.innerHTML      = "";
  movieGrid.style.display  = "none";
  pagination.hidden        = true;
  resultsCount.textContent = "";

  showSkeleton(); // show loading animation

  try {
    var result = await searchMovies(query, page); // call the API

    hideSkeleton();

    // No movies found
    if (result.movies.length === 0) {
      showEmpty("No Results Found", "Nothing matched \"" + query + "\". Try a different title.");
      return;
    }

    // Save the results
    allMovies    = result.movies;
    totalResults = result.totalResults;
    totalPages   = result.totalPages;

    // Apply filter + sort, then show cards
    applyFiltersAndSort();
    paintCards(filteredMovies);

    // Update the results count text
    resultsCount.textContent = totalResults.toLocaleString() + " results for \"" + query + "\"";

    // Show or hide prev/next buttons
    updatePagination();

  } catch (err) {
    hideSkeleton();
    console.log("Search error:", err);
    showEmpty("Something went wrong", "Check your internet or API key.");
  }
}


// =====================================================
// SEARCH API CALL
// Sends a request to TMDB and returns the results
// =====================================================
async function searchMovies(query, page) {
  var url = API_URL + "/search/multi"
    + "?api_key="        + API_KEY
    + "&query="          + encodeURIComponent(query)
    + "&page="           + page
    + "&language=en-US"
    + "&include_adult=false";

  var response = await fetch(url);
  var data     = await response.json();

  // TMDB sends { success: false } when the API key is wrong
  if (data.success === false) {
    throw new Error(data.status_message);
  }

  // Keep only movies and TV shows — skip people results
  var mediaOnly = [];
  for (var i = 0; i < data.results.length; i++) {
    var item = data.results[i];
    if (item.media_type === "movie" || item.media_type === "tv") {
      mediaOnly.push(item);
    }
  }

  // Convert each raw item into a simple object our app can use
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


// =====================================================
// MAKE MOVIE OBJECT
// TMDB movies use "title" but TV shows use "name".
// This function makes them all look the same.
// =====================================================
function makeMovieObject(item) {
  var isTV   = (item.media_type === "tv");
  var title  = isTV ? item.name           : item.title;
  var date   = isTV ? item.first_air_date : item.release_date;
  var year   = (date && date.length >= 4) ? date.slice(0, 4) : "N/A";
  var poster = item.poster_path ? IMG_URL + item.poster_path : "N/A";
  var rating = item.vote_average ? item.vote_average.toFixed(1) : "N/A";

  return {
    id:     String(item.id),
    title:  title  || "Untitled",
    year:   year,
    type:   item.media_type,  // "movie" or "tv"
    poster: poster,
    rating: rating
  };
}


// =====================================================
// FILTER AND SORT
// Runs every time a dropdown changes
// =====================================================
function applyFiltersAndSort() {
  var results = allMovies.slice(); // copy so we don't change the original

  // Filter by type (Movie or TV Show)
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

  // Filter by decade
  var selectedDecade = yearFilter.value;
  if (selectedDecade) {
    var dec    = parseInt(selectedDecade);
    var byYear = [];
    for (var j = 0; j < results.length; j++) {
      var y = parseInt(results[j].year);
      if (dec === 1980) {
        if (y < 1990) byYear.push(results[j]);              // 1980s and older
      } else {
        if (y >= dec && y < dec + 10) byYear.push(results[j]); // exact decade
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
// PAINT CARDS
// Puts movie cards onto the page
// =====================================================
function paintCards(movies) {
  // Nothing to show after filtering
  if (movies.length === 0) {
    showEmpty("No Results After Filtering", "Try removing or adjusting your filters.");
    return;
  }

  // Build all card HTML and put it in the grid
  var html = "";
  for (var i = 0; i < movies.length; i++) {
    html += makeCardHTML(movies[i]);
  }

  movieGrid.innerHTML     = html;
  movieGrid.style.display = "grid";
  emptyState.hidden       = true;
}


// =====================================================
// MAKE CARD HTML
// Builds the HTML string for one movie card
// =====================================================
function makeCardHTML(movie) {
  var badgeClass  = (movie.type === "tv") ? "card__badge--series" : "card__badge--movie";
  var typeLabel   = (movie.type === "tv") ? "TV" : "Movie";
  var ratingBadge = (movie.rating !== "N/A") ? '<span class="card__rating">★ ' + movie.rating + '</span>' : "";

  // Show poster image or a fallback placeholder
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
      + '</div>'
      + '<div class="card__info">'
        + '<h3 class="card__title">' + movie.title + '</h3>'
        + '<div class="card__meta"><span class="card__year">' + movie.year + '</span></div>'
      + '</div>'
    + '</article>'
  );
}


// =====================================================
// SKELETON LOADING
// Shows and hides grey placeholder cards while loading
// =====================================================
function showSkeleton() {
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


// =====================================================
// EMPTY STATE
// Shows a message when there are no results
// =====================================================
function showEmpty(title, sub) {
  hideSkeleton();
  movieGrid.innerHTML      = "";
  movieGrid.style.display  = "none";
  emptyTitle.textContent   = title;
  emptySub.textContent     = sub;
  emptyState.hidden        = false;
  pagination.hidden        = true;
}


// =====================================================
// PAGINATION
// Updates the Prev / Next buttons
// =====================================================
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


// =====================================================
// THEME — dark / light mode
// =====================================================
function toggleTheme() {
  currentTheme = (currentTheme === "dark") ? "light" : "dark";
  applyTheme(currentTheme);
  localStorage.setItem("bx_theme", currentTheme); // save preference
}

function applyTheme(theme) {
  // Setting data-theme on <html> makes all CSS variables switch automatically
  document.documentElement.setAttribute("data-theme", theme);
}

function loadTheme() {
  var saved = localStorage.getItem("bx_theme");
  if (saved) currentTheme = saved;
  applyTheme(currentTheme);
}


// =====================================================
// DEBOUNCE
// Waits until the user stops typing before searching.
// Without this, a new API call would fire for every letter typed.
// =====================================================
function debouncedSearch() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(function() {
    handleSearch(1);
  }, 500); // wait 500ms after the last keystroke
}


// =====================================================
// STAR RATING BADGE STYLE
// Adds the CSS for the small rating badge on each card
// =====================================================
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


// =====================================================
// EVENT LISTENERS
// Connect every button and input to the right function
// =====================================================
function setupListeners() {

  // User types in the search box
  searchInput.addEventListener("input", function() {
    // Show X button when there is text, hide it when empty
    if (searchInput.value.length > 0) {
      clearBtn.classList.add("visible");
    } else {
      clearBtn.classList.remove("visible");
    }
    debouncedSearch(); // auto-search after user stops typing
  });

  // User clicks the Search button
  searchBtn.addEventListener("click", function() {
    handleSearch(1);
  });

  // User presses Enter in the search box
  searchInput.addEventListener("keydown", function(e) {
    if (e.key === "Enter") handleSearch(1);
  });

  // User clicks the X button to clear the search
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

  // Sort dropdown changed
  sortOrder.addEventListener("change", function() {
    if (allMovies.length > 0) {
      applyFiltersAndSort();
      paintCards(filteredMovies);
    }
  });

  // Type filter changed (Movie / TV Show)
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
}


// =====================================================
// RUN THE APP
// =====================================================
startApp();
