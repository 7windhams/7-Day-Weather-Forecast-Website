// Global variables to store current forecast data and location
let currentForecast = [];
let currentLocation = '';
let favorites = JSON.parse(localStorage.getItem('weatherFavorites')) || [];

// GET COORDINATES
const findMe = () => { 
  const success = (position) => {
    console.log(position);
    const { latitude, longitude } = position.coords;
    // You can use these coordinates for weather lookup
    console.log(`Latitude: ${latitude}, Longitude: ${longitude}`);
  };
  
  const error = () => {
    console.log("Unable to retrieve your location");
  };
  
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(success, error);
  } else {
    console.log("Geolocation not supported");
  }
};

function toggleTemperature() {
  const isCelsius = document.getElementById("tempToggle").checked;
  displayForecast(currentForecast, isCelsius);
}

function convertToCelsius(f) {
  return Math.round((f - 32) * 5 / 9);
}

function displayForecast(periods, isCelsius = false) {
  const forecastContainer = document.getElementById("forecastContainer");
  forecastContainer.innerHTML = "";

  // Group periods by day to get high/low temperatures
  const dailyForecasts = groupPeriodsByDay(periods);

  dailyForecasts.slice(0, 7).forEach(day => {
    const unit = isCelsius ? "C" : "F";
    const highTemp = day.high ? (isCelsius ? convertToCelsius(day.high) : day.high) : '--';
    const lowTemp = day.low ? (isCelsius ? convertToCelsius(day.low) : day.low) : '--';

    const card = document.createElement("div");
    card.className = "col-md-4 col-lg-3";

    card.innerHTML = `
      <div class="card p-3 text-center">
        <h5>${day.dayName}</h5>
        <img src="${day.icon}" alt="${day.shortForecast}" class="weather-icon mx-auto" />
        <div class="temperature">
          <span class="high-temp fw-bold">${highTemp}°</span>
          <span class="text-muted"> / </span>
          <span class="low-temp text-muted">${lowTemp}° ${unit}</span>
        </div>
        <p class="mb-0">${day.shortForecast}</p>
      </div>
    `;

    forecastContainer.appendChild(card);
  });
}

function groupPeriodsByDay(periods) {
  const dailyData = {};
  
  periods.forEach(period => {
    const date = new Date(period.startTime);
    const dateKey = date.toDateString();
    
    if (!dailyData[dateKey]) {
      dailyData[dateKey] = {
        date: date,
        dayName: getDayName(date),
        high: null,
        low: null,
        icon: period.icon,
        shortForecast: period.shortForecast
      };
    }
    
    // Determine if this is a high or low temperature
    if (period.isDaytime) {
      dailyData[dateKey].high = period.temperature;
      dailyData[dateKey].icon = period.icon;
      dailyData[dateKey].shortForecast = period.shortForecast;
    } else {
      dailyData[dateKey].low = period.temperature;
    }
  });
  
  return Object.values(dailyData);
}

function getDayName(date) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (date.toDateString() === today.toDateString()) {
    return "Today";
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return "Tomorrow";
  } else {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  }
}

function displayLocationAndDate(locationName) {
  const locationDateInfo = document.getElementById("locationDateInfo");
  const locationNameElement = document.getElementById("locationName");
  const currentDateElement = document.getElementById("currentDate");
  
  // Clean up the location name (remove extra address details if present)
  let cleanLocationName = locationName;
  if (locationName.includes(',')) {
    const parts = locationName.split(',');
    // Take the first 2-3 parts (usually city, state/country)
    cleanLocationName = parts.slice(0, Math.min(3, parts.length)).join(', ');
  }
  
  // Format current date
  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  locationNameElement.textContent = cleanLocationName;
  currentDateElement.textContent = formattedDate;
  locationDateInfo.classList.remove("d-none");
}

async function getWeather() {
  const location = document.getElementById("locationInput").value;
  const errorMessage = document.getElementById("errorMessage");
  const forecastContainer = document.getElementById("forecastContainer");
  const locationDateInfo = document.getElementById("locationDateInfo");

  errorMessage.classList.add("d-none");
  locationDateInfo.classList.add("d-none");
  forecastContainer.innerHTML = "";

  if (!location.trim()) {
    errorMessage.textContent = "Please enter a location.";
    errorMessage.classList.remove("d-none");
    return;
  }

  try {
    // Step 1: Geocode the location with proper headers
    const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1`, {
      method: 'GET',
      headers: {
        'User-Agent': 'WeatherApp/1.0'
      }
    });
    
    if (!geoRes.ok) {
      throw new Error(`Geocoding failed: ${geoRes.status} ${geoRes.statusText}`);
    }
    
    const geoData = await geoRes.json();
    if (!geoData.length) throw new Error("Location not found. Please try a different location.");

    const { lat, lon } = geoData[0];
    console.log(`Found coordinates: ${lat}, ${lon}`);

    // Step 2: Get gridpoint info from /points/{lat},{lon}
    const pointRes = await fetch(`https://api.weather.gov/points/${lat},${lon}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'WeatherApp/1.0 (contact@example.com)'
      }
    });
    
    if (!pointRes.ok) {
      if (pointRes.status === 404) {
        throw new Error("Weather data not available for this location. Please try a location within the United States.");
      }
      throw new Error(`Weather service error: ${pointRes.status} ${pointRes.statusText}`);
    }
    
    const pointData = await pointRes.json();
    
    if (!pointData.properties) {
      throw new Error("Invalid weather service response.");
    }

    const wfo = pointData.properties.gridId;
    const x = pointData.properties.gridX;
    const y = pointData.properties.gridY;

    console.log(`Grid info: WFO=${wfo}, X=${x}, Y=${y}`);

    // Step 3: Use /gridpoints/{wfo}/{x},{y}/forecast
    const forecastUrl = `https://api.weather.gov/gridpoints/${wfo}/${x},${y}/forecast`;
    const forecastRes = await fetch(forecastUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'WeatherApp/1.0 (contact@example.com)'
      }
    });
    
    if (!forecastRes.ok) {
      throw new Error(`Forecast fetch failed: ${forecastRes.status} ${forecastRes.statusText}`);
    }
    
    const forecastData = await forecastRes.json();
    
    if (!forecastData.properties || !forecastData.properties.periods) {
      throw new Error("Invalid forecast data received.");
    }

    currentForecast = forecastData.properties.periods;
    const isCelsius = document.getElementById("tempToggle").checked;
    
    // Display location name and current date
    displayLocationAndDate(geoData[0].display_name || location);
    
    displayForecast(currentForecast, isCelsius);

    // Store the current location and enable buttons
    currentLocation = location;
    document.getElementById("updateBtn").disabled = false;
    updateFavoriteButton();
  } catch (error) {
    console.error("Weather fetch error:", error);
    
    // Provide specific error messages based on the error type
    if (error.message.includes("Failed to fetch") || error.name === "TypeError") {
      errorMessage.textContent = "Network error: Please check your internet connection or try opening this page through a web server (not file://).";
    } else {
      errorMessage.textContent = error.message;
    }
    errorMessage.classList.remove("d-none");
    
    // Disable buttons on error
    document.getElementById("updateBtn").disabled = true;
    document.getElementById("favoriteBtn").disabled = true;
  }
}

function updateWeather() {
  if (!currentLocation) {
    const errorMessage = document.getElementById("errorMessage");
    errorMessage.textContent = "No location to update. Please search for a location first.";
    errorMessage.classList.remove("d-none");
    return;
  }
  
  const updateBtn = document.getElementById("updateBtn");
  const originalText = updateBtn.innerHTML;
  
  // Show loading state
  updateBtn.innerHTML = '<i class="bi bi-arrow-clockwise spin"></i> Updating...';
  updateBtn.disabled = true;
  
  // Set the location input to current location and trigger search
  document.getElementById("locationInput").value = currentLocation;
  
  // Call getWeather and then reset button state
  getWeather().finally(() => {
    updateBtn.innerHTML = originalText;
    updateBtn.disabled = false;
  });
}

// Favorites functionality
function initializeFavorites() {
  displayFavorites();
  if (favorites.length > 0) {
    document.getElementById("favoritesSection").classList.remove("d-none");
  }
}

function toggleFavorite() {
  if (!currentLocation) return;
  
  const favoriteBtn = document.getElementById("favoriteBtn");
  const isFavorite = favorites.includes(currentLocation);
  
  if (isFavorite) {
    // Remove from favorites
    favorites = favorites.filter(fav => fav !== currentLocation);
    favoriteBtn.innerHTML = '<i class="bi bi-heart"></i> Add to Favorites';
    favoriteBtn.classList.remove("btn-danger");
    favoriteBtn.classList.add("btn-outline-success");
  } else {
    // Add to favorites
    favorites.push(currentLocation);
    favoriteBtn.innerHTML = '<i class="bi bi-heart-fill"></i> Remove from Favorites';
    favoriteBtn.classList.remove("btn-outline-success");
    favoriteBtn.classList.add("btn-danger");
  }
  
  // Save to localStorage
  localStorage.setItem('weatherFavorites', JSON.stringify(favorites));
  
  // Update favorites display
  displayFavorites();
  
  // Show/hide favorites section
  if (favorites.length > 0) {
    document.getElementById("favoritesSection").classList.remove("d-none");
  } else {
    document.getElementById("favoritesSection").classList.add("d-none");
  }
}

function displayFavorites() {
  const favoritesList = document.getElementById("favoritesList");
  favoritesList.innerHTML = "";
  
  favorites.forEach(location => {
    const favoriteBtn = document.createElement("div");
    favoriteBtn.className = "btn btn-outline-info btn-sm me-2 mb-2 favorite-location-btn";
    favoriteBtn.innerHTML = `
      <span class="location-text" onclick="loadFavoriteLocation('${location}')">
        <i class="bi bi-geo-alt"></i> ${location}
      </span>
      <span class="remove-favorite" onclick="removeFavorite('${location}')" title="Remove">
        <i class="bi bi-x-lg text-danger"></i>
      </span>
    `;
    
    favoritesList.appendChild(favoriteBtn);
  });
}

function loadFavoriteLocation(location) {
  document.getElementById("locationInput").value = location;
  getWeather();
}

function removeFavorite(location) {
  favorites = favorites.filter(fav => fav !== location);
  localStorage.setItem('weatherFavorites', JSON.stringify(favorites));
  displayFavorites();
  
  // Update favorite button if this was the current location
  if (currentLocation === location) {
    const favoriteBtn = document.getElementById("favoriteBtn");
    favoriteBtn.innerHTML = '<i class="bi bi-heart"></i> Add to Favorites';
    favoriteBtn.classList.remove("btn-danger");
    favoriteBtn.classList.add("btn-outline-success");
  }
  
  // Hide favorites section if empty
  if (favorites.length === 0) {
    document.getElementById("favoritesSection").classList.add("d-none");
  }
}

function updateFavoriteButton() {
  const favoriteBtn = document.getElementById("favoriteBtn");
  const isFavorite = favorites.includes(currentLocation);
  
  if (isFavorite) {
    favoriteBtn.innerHTML = '<i class="bi bi-heart-fill"></i> Remove from Favorites';
    favoriteBtn.classList.remove("btn-outline-success");
    favoriteBtn.classList.add("btn-danger");
  } else {
    favoriteBtn.innerHTML = '<i class="bi bi-heart"></i> Add to Favorites';
    favoriteBtn.classList.remove("btn-danger");
    favoriteBtn.classList.add("btn-outline-success");
  }
  
  favoriteBtn.disabled = false;
}

// Initialize favorites on page load
document.addEventListener('DOMContentLoaded', initializeFavorites);