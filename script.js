const $ = (selector) => document.querySelector(selector);

const form = $("#search-form");
const cityInput = $("#city-input");
const searchButton = $("#search-button");
const locationButton = $("#location-button");
const statusEl = $("#status");

const weatherCodes = {
  0: ["Clear sky", "☀️"], 1: ["Mainly clear", "🌤️"], 2: ["Partly cloudy", "⛅"],
  3: ["Overcast", "☁️"], 45: ["Foggy", "🌫️"], 48: ["Rime fog", "🌫️"],
  51: ["Light drizzle", "🌦️"], 53: ["Drizzle", "🌦️"], 55: ["Dense drizzle", "🌧️"],
  56: ["Freezing drizzle", "🌧️"], 57: ["Heavy freezing drizzle", "🌧️"],
  61: ["Light rain", "🌦️"], 63: ["Rain", "🌧️"], 65: ["Heavy rain", "🌧️"],
  66: ["Freezing rain", "🌧️"], 67: ["Heavy freezing rain", "🌧️"],
  71: ["Light snow", "🌨️"], 73: ["Snow", "🌨️"], 75: ["Heavy snow", "❄️"],
  77: ["Snow grains", "🌨️"], 80: ["Rain showers", "🌦️"], 81: ["Rain showers", "🌧️"],
  82: ["Heavy showers", "⛈️"], 85: ["Snow showers", "🌨️"], 86: ["Heavy snow showers", "❄️"],
  95: ["Thunderstorm", "⛈️"], 96: ["Thunderstorm with hail", "⛈️"], 99: ["Severe thunderstorm", "⛈️"]
};

function getWeather(code) {
  return weatherCodes[code] || ["Weather conditions", "🌤️"];
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function setLoading(loading) {
  searchButton.disabled = loading;
  searchButton.textContent = loading ? "Loading…" : "Search ↗";
  locationButton.disabled = loading;
}

function formatTime(value) {
  if (!value) return "--:--";
  const date = new Date(value);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(value) {
  const date = value ? new Date(`${value}T12:00:00`) : new Date();
  return date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

function buildOutlook(current, high, low, precipitation) {
  if (precipitation >= 5) return ["Keep an umbrella handy", "Rain is expected today, so consider carrying an umbrella and planning a little extra travel time."];
  if (current >= 32) return ["A warm day ahead", "It may feel hot outside. Stay hydrated and take breaks in the shade when you can."];
  if (current <= 12) return ["A cooler day ahead", "A light jacket may come in handy, especially during the cooler parts of the day."];
  if (high - low >= 10) return ["Big temperature swing", "Temperatures may change quite a bit through the day. A flexible outfit is a good idea."];
  return ["Looking fairly comfortable", "Check the forecast before heading out, and enjoy whatever the day brings."];
}

async function findCity(name) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not search for that city right now.");
  const data = await response.json();
  if (!data.results || !data.results.length) throw new Error("We couldn't find that city. Check the spelling and try again.");
  return data.results[0];
}

async function getForecast(latitude, longitude, timezone = "auto") {
  const params = new URLSearchParams({
    latitude, longitude, timezone,
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum",
    forecast_days: "5",
    temperature_unit: "celsius",
    wind_speed_unit: "kmh"
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!response.ok) throw new Error("Weather data couldn't be loaded. Please try again.");
  return response.json();
}

function renderForecast(data, place) {
  const current = data.current;
  const daily = data.daily;
  const [condition, icon] = getWeather(current.weather_code);
  const locationName = [place.name, place.admin1, place.country].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(", ");

  $("#place-name").textContent = locationName || "Selected location";
  $("#local-date").textContent = formatDate(current.time?.split("T")[0]);
  $("#current-icon").textContent = icon;
  $("#temperature").innerHTML = `${Math.round(current.temperature_2m)}<span>°C</span>`;
  $("#condition").textContent = condition;
  $("#feels-like").textContent = `Feels like ${Math.round(current.apparent_temperature)}°C`;
  $("#humidity").textContent = `${current.relative_humidity_2m}%`;
  $("#wind").textContent = `${Math.round(current.wind_speed_10m)} km/h`;
  $("#feels-stat").textContent = `${Math.round(current.apparent_temperature)}°C`;
  $("#precipitation").textContent = `${Number(current.precipitation).toFixed(1)} mm`;
  $("#high").textContent = `${Math.round(daily.temperature_2m_max[0])}°`;
  $("#low").textContent = `${Math.round(daily.temperature_2m_min[0])}°`;
  $("#sunrise").textContent = formatTime(daily.sunrise[0]);
  $("#sunset").textContent = formatTime(daily.sunset[0]);

  const [outlookTitle, outlookCopy] = buildOutlook(
    current.temperature_2m, daily.temperature_2m_max[0], daily.temperature_2m_min[0], daily.precipitation_sum[0]
  );
  $("#outlook-title").textContent = outlookTitle;
  $("#outlook-copy").textContent = outlookCopy;

  const forecastGrid = $("#forecast-grid");
  forecastGrid.replaceChildren();
  daily.time.forEach((day, index) => {
    const [description, dayIcon] = getWeather(daily.weather_code[index]);
    const card = document.createElement("article");
    card.className = "forecast-day";
    const date = new Date(`${day}T12:00:00`);
    const dayName = index === 0 ? "Today" : date.toLocaleDateString([], { weekday: "short" });
    card.innerHTML = `
      <div class="forecast-name">${dayName}</div>
      <div class="forecast-icon" aria-hidden="true">${dayIcon}</div>
      <div class="forecast-temps"><span>${Math.round(daily.temperature_2m_max[index])}°</span><span class="forecast-low">${Math.round(daily.temperature_2m_min[index])}°</span></div>
      <p class="forecast-desc">${description}</p>`;
    forecastGrid.appendChild(card);
  });
  setStatus(`Updated with live data for ${locationName}.`);
}

async function loadCity(name) {
  setLoading(true);
  setStatus(`Looking up ${name}…`);
  try {
    const place = await findCity(name);
    setStatus(`Getting the latest weather for ${place.name}…`);
    const forecast = await getForecast(place.latitude, place.longitude, place.timezone || "auto");
    renderForecast(forecast, place);
  } catch (error) {
    setStatus(error.message || "Something went wrong. Please try again.", true);
  } finally {
    setLoading(false);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const city = cityInput.value.trim();
  if (city) loadCity(city);
});

locationButton.addEventListener("click", () => {
  if (!navigator.geolocation) {
    setStatus("Your browser doesn't support location. Search for a city instead.", true);
    return;
  }
  setLoading(true);
  setStatus("Requesting your location…");
  navigator.geolocation.getCurrentPosition(async (position) => {
    try {
      const { latitude, longitude } = position.coords;
      const forecast = await getForecast(latitude, longitude, "auto");
      const place = { name: "Your location", admin1: "", country: "", latitude, longitude };
      renderForecast(forecast, place);
    } catch (error) {
      setStatus(error.message || "Couldn't load weather for your location.", true);
    } finally {
      setLoading(false);
    }
  }, (error) => {
    const message = error.code === 1 ? "Location permission was denied. Search for a city instead." : "Couldn't access your location. Search for a city instead.";
    setStatus(message, true);
    setLoading(false);
  }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
});

// Start with a useful example so the dashboard isn't empty on first launch.
loadCity("Kochi");
