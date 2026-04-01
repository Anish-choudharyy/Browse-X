// e77858412d1571020f642635a32b79a6

// ===== CONFIG =====
const API_KEY = "e77858412d1571020f642635a32b79a6";
const BASE_URL = "https://api.themoviedb.org/3";

// ===== DOM =====
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const movieGrid = document.getElementById("movieGrid");

// ===== FETCH FUNCTION =====
async function fetchMovies(query) {
  try {
    // create URL
    const url = `${BASE_URL}/search/movie?api_key=${API_KEY}&query=${query}`;

    // fetch data
    const response = await fetch(url);

    // convert to JSON
    const data = await response.json();

    // display results
    displayMovies(data.results);

  } catch (error) {
    console.log("Error:", error);
  }
}

// ===== DISPLAY FUNCTION =====
function displayMovies(movies) {
  movieGrid.innerHTML = "";

  movies.forEach(movie => {
    const title = movie.title;
    const year = movie.release_date ? movie.release_date.slice(0, 4) : "N/A";
    const poster = movie.poster_path
      ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
      : "";

    const movieCard = `
      <div class="card">
        <img src="${poster}" alt="${title}" />
        <h3>${title}</h3>
        <p>${year}</p>
      </div>
    `;

    movieGrid.innerHTML += movieCard;
  });
}

// ===== EVENT LISTENER =====
searchBtn.addEventListener("click", () => {
  const query = searchInput.value.trim();

  if (query !== "") {
    fetchMovies(query);
  }
});
