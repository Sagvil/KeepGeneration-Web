const MAP_PRESETS = {
  default: { lat: 23.1291, lon: 113.2644 },
  map1: { lat: 23.0973, lon: 113.2982 },
  map2: { lat: 23.0973, lon: 113.2982 },
  map3: { lat: 23.0973, lon: 113.2982 },
  map4: { lat: 23.0973, lon: 113.2982 },
  map5: { lat: 23.0965, lon: 113.3002 },
  map6: { lat: 23.0637, lon: 113.3927 },
  map7: { lat: 23.0637, lon: 113.3927 },
  map8: { lat: 22.3485, lon: 113.5886 },
  map9: { lat: 31.3022, lon: 120.6394 },
  map10: { lat: 39.9605, lon: 116.3448 },
  map11: { lat: 28.1743, lon: 112.9366 },
  map12: { lat: 23.1118, lon: 113.3187 },
  map13: { lat: 23.0537, lon: 113.3972 },
  map14: { lat: 23.1199, lon: 113.3245 },
  map15: { lat: 23.0637, lon: 113.3927 },
  map16: { lat: 23.0637, lon: 113.3927 },
  map17: { lat: 23.0637, lon: 113.3927 },
  map18: { lat: 23.0637, lon: 113.3927 },
  map19: { lat: 23.0637, lon: 113.3927 },
  map20: { lat: 23.0637, lon: 113.3927 },
};

function json(data, init = {}) {
  return Response.json(data, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...(init.headers || {}),
    },
  });
}

function timestampFor(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "") || !/^\d{2}:\d{2}$/.test(time || "")) {
    return null;
  }
  return Math.floor(new Date(`${date}T${time}:00+08:00`).getTime() / 1000);
}

function nearestHourlyPoint(hourly, date, time) {
  const target = `${date}T${String(time || "").slice(0, 2)}:00`;
  const index = hourly?.time?.indexOf(target) ?? -1;
  const safeIndex = index >= 0 ? index : 0;
  if (!hourly?.time?.length || hourly.temperature_2m?.[safeIndex] == null) {
    return null;
  }
  return {
    temp: hourly.temperature_2m[safeIndex],
    code: hourly.weather_code?.[safeIndex],
  };
}

function weatherCodeText(code) {
  if (code === 0) return "晴";
  if ([1, 2, 3].includes(code)) return "多云";
  if ([45, 48].includes(code)) return "雾";
  if ([51, 53, 55, 56, 57].includes(code)) return "毛毛雨";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "雨";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "雪";
  if ([95, 96, 99].includes(code)) return "雷雨";
  return "多云";
}

async function fetchOpenMeteo(preset, date, time, openWeatherStatus = null) {
  const apiUrl = new URL("https://archive-api.open-meteo.com/v1/archive");
  apiUrl.searchParams.set("latitude", String(preset.lat));
  apiUrl.searchParams.set("longitude", String(preset.lon));
  apiUrl.searchParams.set("start_date", date);
  apiUrl.searchParams.set("end_date", date);
  apiUrl.searchParams.set("hourly", "temperature_2m,weather_code");
  apiUrl.searchParams.set("timezone", "Asia/Shanghai");

  const response = await fetch(apiUrl);
  if (!response.ok) {
    return json({ error: "open_meteo_error", status: response.status, openWeatherStatus }, { status: 502 });
  }

  const payload = await response.json();
  const point = nearestHourlyPoint(payload.hourly, date, time);
  if (!point) {
    return json({ error: "unexpected_open_meteo_response", openWeatherStatus }, { status: 502 });
  }

  return json({
    weather: weatherCodeText(Number(point.code)),
    temperature: `${Math.round(Number(point.temp))}°C`,
    source: "open-meteo",
    openWeatherStatus,
  });
}

async function handleWeather(request, env) {
  const url = new URL(request.url);
  const mapId = url.searchParams.get("map") || "map4";
  const date = url.searchParams.get("date");
  const time = url.searchParams.get("time");
  const preset = MAP_PRESETS[mapId];
  const dt = timestampFor(date, time);

  if (!preset || !dt) {
    return json({ error: "invalid_request" }, { status: 400 });
  }
  if (!env.OPENWEATHER_API_KEY) {
    return json({ error: "missing_openweather_secret" }, { status: 500 });
  }

  const apiUrl = new URL("https://api.openweathermap.org/data/3.0/onecall/timemachine");
  apiUrl.searchParams.set("lat", String(preset.lat));
  apiUrl.searchParams.set("lon", String(preset.lon));
  apiUrl.searchParams.set("dt", String(dt));
  apiUrl.searchParams.set("appid", env.OPENWEATHER_API_KEY);
  apiUrl.searchParams.set("units", "metric");
  apiUrl.searchParams.set("lang", "zh_cn");

  const response = await fetch(apiUrl);
  if (!response.ok) {
    return fetchOpenMeteo(preset, date, time, response.status);
  }

  const payload = await response.json();
  const point = Array.isArray(payload.data) ? payload.data[0] : payload.current || payload;
  const description = point?.weather?.[0]?.description || point?.weather?.[0]?.main;
  const temp = point?.temp;

  if (description == null || temp == null) {
    return json({ error: "unexpected_openweather_response" }, { status: 502 });
  }

  return json({
    weather: String(description),
    temperature: `${Math.round(Number(temp))}°C`,
    source: "openweather",
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/weather") {
      return handleWeather(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};
