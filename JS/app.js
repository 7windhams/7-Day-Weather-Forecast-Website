async function getWeather() {
  const location = document.getElementById("locationInput").value;
  const errorMessage = document.getElementById("errorMessage");
  const forecastContainer = document.getElementById("forecastContainer");

  errorMessage.classList.add("d-none");
  forecastContainer.innerHTML = "";

  try {
    // Step 1: Geocode the location (replace with your geocoding API)
    const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${location}`);
    const geoData = await geoRes.json();

    if (!geoData.length) throw new Error("Location not found.");

    const { lat, lon } = geoData[0];

    // Step 2: Get forecast URL from weather.gov
    const pointRes = await fetch(`https://api.weather.gov/points/${lat},${lon}`);
    const pointData = await pointRes.json();
    const forecastUrl = pointData.properties.forecast;

    // Step 3: Fetch forecast data
    const forecastRes = await fetch(forecastUrl);
    const forecastData = await forecastRes.json();

    const periods = forecastData.properties.periods.slice(0, 7); // Get 7 days

    periods.forEach(period => {
      const card = document.createElement("div");
      card.className = "col-md-4 col-lg-3";

      card.innerHTML = `
        <div class="card p-3 text-center">
          <h5>${period.name}</h5>
          <img src="${period.icon}" alt="${period.shortForecast}" class="weather-icon mx-auto" />
          <p>${period.temperature}° ${period.temperatureUnit}</p>
          <p>${period.shortForecast}</p>
        </div>
      `;

      forecastContainer.appendChild(card);
    });
  } catch (error) {
    errorMessage.textContent = error.message;
    errorMessage.classList.remove("d-none");
  }
}
