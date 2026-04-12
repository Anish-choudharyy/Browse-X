var API_KEY = "e77858412d1571020f642635a32b79a6";

var API_URL = "https://api.themoviedb.org/3";
var IMG_URL = "https://image.tmdb.org/t/p/w500";


var currentPage    = 1;
var totalPages     = 0;
var totalResults   = 0;
var currentQuery   = "";
var allMovies      = [];
var filteredMovies = [];
var currentTheme   = "dark";
var debounceTimer  = null;


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


function startApp() {
  loadTheme();
  addRatingStyle();
  setupListeners(); 
  loadTrending();
}

async function loadTrending() {
  showSkeleton();

  try {
    var url      = API_URL + "/trending/all/week?api_key=" + API_KEY + "&language=en-US";
    var response = await fetch(url);
    var data     = await response.json();

    hideSkeleton();
    var trending = [];
    for (var i = 0; i < data.results.length; i++) {
      var item = data.results[i];
      if (item.media_type === "movie" || item.media_type === "tv") {
        trending.push(makeMovieObject(item));
      }
    }

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

async function handleSearch(page) {
  if (!page) page = 1;

  var query = searchInput.value.trim();

  if (!query) {
    showEmpty("Search for a movie above", "Type a title and hit Search.");
    return;
  }

  currentQuery = query;
  currentPage  = page;

  emptyState.hidden        = true;
  movieGrid.innerHTML      = "";
  movieGrid.style.display  = "none";
  pagination.hidden        = true;
  resultsCount.textContent = "";

  showSkeleton();

  try {
    var result = await searchMovies(query, page);

    hideSkeleton();
    if (result.movies.length === 0) {
      showEmpty("No Results Found", "Nothing matched \"" + query + "\". Try a different title.");
      return;
    }

    allMovies    = result.movies;
    totalResults = result.totalResults;
    totalPages   = result.totalPages;

    applyFiltersAndSort();
    paintCards(filteredMovies);

    resultsCount.textContent = totalResults.toLocaleString() + " results for \"" + query + "\"";

    updatePagination();

  } catch (err) {
    hideSkeleton();
    console.log("Search error:", err);
    showEmpty("Something went wrong", "Check your internet or API key.");
  }
}

async function searchMovies(query, page) {
  var url = API_URL + "/search/multi"
    + "?api_key="        + API_KEY
    + "&query="          + encodeURIComponent(query)
    + "&page="           + page
    + "&language=en-US"
    + "&include_adult=false";

  var response = await fetch(url);
  var data     = await response.json();

  if (data.success === false) {
    throw new Error(data.status_message);
  }

  var mediaOnly = [];
  for (var i = 0; i < data.results.length; i++) {
    var item = data.results[i];
    if (item.media_type === "movie" || item.media_type === "tv") {
      mediaOnly.push(item);
    }
  }

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
    type:   item.media_type,
    poster: poster,
    rating: rating
  };
}


function applyFiltersAndSort() {
  var results = allMovies.slice();

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

  var selectedDecade = yearFilter.value;
  if (selectedDecade) {
    var dec    = parseInt(selectedDecade);
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
  movieGrid.style.display = "grid";
  emptyState.hidden       = true;
}

function makeCardHTML(movie) {
  var badgeClass  = (movie.type === "tv") ? "card__badge--series" : "card__badge--movie";
  var typeLabel   = (movie.type === "tv") ? "TV" : "Movie";
  var ratingBadge = (movie.rating !== "N/A") ? '<span class="card__rating">★ ' + movie.rating + '</span>' : "";

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

function showEmpty(title, sub) {
  hideSkeleton();
  movieGrid.innerHTML      = "";
  movieGrid.style.display  = "none";
  emptyTitle.textContent   = title;
  emptySub.textContent     = sub;
  emptyState.hidden        = false;
  pagination.hidden        = true;
}

function updatePagination() {
  var maxPages = Math.min(totalPages, 500);

  if (maxPages <= 1) {
    pagination.hidden = true;
    return;
  }

  pagination.hidden    = false;
  pageInfo.textContent = "Page " + currentPage + " / " + maxPages;
  prevBtn.disabled     = (currentPage <= 1);
  nextBtn.disabled     = (currentPage >= maxPages);
}


function toggleTheme() {
  currentTheme = (currentTheme === "dark") ? "light" : "dark";
  applyTheme(currentTheme);
  localStorage.setItem("bx_theme", currentTheme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

function loadTheme() {
  var saved = localStorage.getItem("bx_theme");
  if (saved) currentTheme = saved;
  applyTheme(currentTheme);
}

function debouncedSearch() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(function() {
    handleSearch(1);
  }, 500);
}

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

function setupListeners() {

  searchInput.addEventListener("input", function() {
    if (searchInput.value.length > 0) {
      clearBtn.classList.add("visible");
    } else {
      clearBtn.classList.remove("visible");
    }
    debouncedSearch();
  });

  searchBtn.addEventListener("click", function() {
    handleSearch(1);
  });

  searchInput.addEventListener("keydown", function(e) {
    if (e.key === "Enter") handleSearch(1);
  });

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

  sortOrder.addEventListener("change", function() {
    if (allMovies.length > 0) {
      applyFiltersAndSort();
      paintCards(filteredMovies);
    }
  });

  typeFilter.addEventListener("change", function() {
    if (allMovies.length > 0) {
      applyFiltersAndSort();
      paintCards(filteredMovies);
    }
  });

  yearFilter.addEventListener("change", function() {
    if (allMovies.length > 0) {
      applyFiltersAndSort();
      paintCards(filteredMovies);
    }
  });

  prevBtn.addEventListener("click", function() {
    if (currentPage > 1) {
      handleSearch(currentPage - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  nextBtn.addEventListener("click", function() {
    if (currentPage < Math.min(totalPages, 500)) {
      handleSearch(currentPage + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  themeToggle.addEventListener("click", function() {
    toggleTheme();
  });
}


startApp();
