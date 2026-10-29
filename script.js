"use strict";

const datetime = document.getElementById("datetime");
const timezone = document.getElementById("timezone");
const formatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

timezone.textContent = `端末のタイムゾーン：${formatter.resolvedOptions().timeZone}`;

function updateClock() {
  const now = new Date();
  datetime.dateTime = now.toISOString();
  datetime.textContent = formatter.format(now);
}

updateClock();
setInterval(updateClock, 1000);

const weatherButton = document.getElementById("weather-button");
const weatherResult = document.getElementById("weather-result");
const weatherLocation = document.getElementById("weather-location");

let municipalityData;

async function getCity(coords) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    if (!municipalityData) {
      const response = await fetch("data/municipalities.json", {signal: controller.signal});
      if (!response.ok) return null;
      municipalityData = await response.json();
    }
    return findMunicipality(municipalityData, coords.longitude, coords.latitude);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function describeWeather(code) {
  const descriptions = {
    0: "快晴", 1: "晴れ", 2: "晴れ時々くもり", 3: "くもり",
    45: "霧", 48: "着氷性の霧",
    51: "弱い霧雨", 53: "霧雨", 55: "強い霧雨",
    56: "弱い着氷性の霧雨", 57: "強い着氷性の霧雨",
    61: "小雨", 63: "雨", 65: "強い雨", 66: "弱い着氷性の雨", 67: "強い着氷性の雨",
    71: "小雪", 73: "雪", 75: "強い雪", 77: "雪粒",
    80: "弱いにわか雨", 81: "にわか雨", 82: "激しいにわか雨",
    85: "弱いにわか雪", 86: "強いにわか雪",
    95: "雷雨", 96: "ひょうを伴う雷雨", 99: "強いひょうを伴う雷雨",
  };
  return descriptions[code] ?? "天気不明";
}

weatherButton.addEventListener("click", async () => {
  if (!navigator.geolocation) {
    weatherResult.textContent = "このブラウザは位置情報に対応していません。";
    return;
  }

  weatherButton.disabled = true;
  weatherLocation.textContent = "現在地：確認中…";
  weatherResult.textContent = "現在地を確認しています…";
  let cityPromise;
  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false, timeout: 15000, maximumAge: 300000,
      });
    });
    cityPromise = getCity(position.coords);
    weatherLocation.textContent = "現在地：市区町村名を取得しています…";
    cityPromise.then(city => {
      weatherLocation.textContent = city ? `現在地：${city}` : "現在地：市区町村を判定できませんでした（国内の陸地のみ対応）";
    });
    weatherResult.textContent = "天気を取得しています…";
    const params = new URLSearchParams({
      latitude: position.coords.latitude.toFixed(2),
      longitude: position.coords.longitude.toFixed(2),
      current: "temperature_2m,weather_code",
      temperature_unit: "celsius",
      timezone: "auto",
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let data;
    try {
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
        signal: controller.signal,
        referrerPolicy: "no-referrer",
      });
      if (!response.ok) throw new Error("Weather request failed");
      data = await response.json();
    } finally {
      clearTimeout(timeout);
    }
    const current = data.current;
    if (!Number.isFinite(current?.temperature_2m) || !Number.isInteger(current?.weather_code)) {
      throw new Error("Invalid weather data");
    }
    weatherResult.textContent = `${describeWeather(current.weather_code)} · ${current.temperature_2m.toFixed(1)} °C（現在地付近）`;
    weatherButton.textContent = "天気を更新";
    await cityPromise;
  } catch (error) {
    const messages = {
      1: "位置情報が許可されていません。ブラウザの設定で許可して、もう一度お試しください。",
      2: "現在地を取得できませんでした。端末の位置情報設定を確認してください。",
      3: "現在地の取得がタイムアウトしました。もう一度お試しください。",
    };
    weatherResult.textContent = messages[error.code] ?? "天気を取得できませんでした。通信状況を確認して、もう一度お試しください。";
    if (weatherLocation.textContent === "現在地：確認中…") weatherLocation.textContent = "現在地：未取得";
  } finally {
    await cityPromise;
    weatherButton.disabled = false;
  }
});
