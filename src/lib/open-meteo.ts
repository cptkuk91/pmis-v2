export type OpenMeteoLocation = {
  query: string;
  displayName: string;
  latitude: number;
  longitude: number;
  timezone: string;
  country?: string;
  admin1?: string;
  admin2?: string;
};

export type OpenMeteoDailyWeather = {
  observedDate: string;
  condition: string;
  temperatureMin: number;
  temperatureMax: number;
  precipitationChance: number;
  windSpeed: number;
  warning: string;
  source: "open-meteo";
};

type OpenMeteoDailyOptions = {
  address?: string | null;
  siteName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  days: number;
};

type OpenMeteoGeocodingResponse = {
  results?: Array<{
    name: string;
    latitude: number;
    longitude: number;
    timezone?: string;
    country?: string;
    admin1?: string;
    admin2?: string;
  }>;
};

type OpenMeteoForecastResponse = {
  timezone?: string;
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_min?: number[];
    temperature_2m_max?: number[];
    precipitation_probability_max?: number[];
    wind_speed_10m_max?: number[];
  };
};

type NominatimSearchResponse = Array<{
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: {
    country?: string;
    state?: string;
    county?: string;
  };
}>;

function makeAddressQueries(address: string | null | undefined, siteName: string | null | undefined): string[] {
  const sanitizedAddress = String(address ?? "").trim();
  const sanitizedSiteName = String(siteName ?? "").trim();

  const candidates = new Set<string>();

  if (sanitizedAddress) {
    candidates.add(sanitizedAddress);

    const withoutDetails = sanitizedAddress
      .replace(/\([^)]*\)/g, "")
      .replace(/\d+[\-\d]*\s*$/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (withoutDetails) {
      candidates.add(withoutDetails);
    }

    const tokens = withoutDetails.split(" ").filter(Boolean);
    if (tokens.length >= 3) {
      candidates.add(tokens.slice(0, 3).join(" "));
    }
    if (tokens.length >= 2) {
      candidates.add(tokens.slice(0, 2).join(" "));
    }
  }

  if (sanitizedSiteName) {
    candidates.add(sanitizedSiteName);
  }

  return [...candidates].filter((value) => value.length >= 2);
}

async function fetchJsonWithTimeout<T>(
  url: string,
  init?: RequestInit,
  timeoutMs = 8000,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      next: { revalidate: 1800 },
    });

    if (!response.ok) {
      throw new Error(`Open-Meteo API 요청 실패: ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveNominatimLocation(query: string): Promise<OpenMeteoLocation | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", query);

  const response = await fetchJsonWithTimeout<NominatimSearchResponse>(
    url.toString(),
    {
      headers: {
        "Accept-Language": "ko",
        "User-Agent": "pmis/1.0 (weather geocoding)",
      },
    },
  );

  const first = response[0];
  const latitude = Number(first?.lat ?? NaN);
  const longitude = Number(first?.lon ?? NaN);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    query,
    displayName: String(first?.display_name ?? query).trim() || query,
    latitude,
    longitude,
    timezone: "Asia/Seoul",
    country: first?.address?.country,
    admin1: first?.address?.state,
    admin2: first?.address?.county,
  };
}

function codeToKoreanCondition(code: number): string {
  if (code === 0) return "맑음";
  if (code === 1) return "대체로 맑음";
  if (code === 2) return "구름 조금";
  if (code === 3) return "흐림";
  if (code === 45 || code === 48) return "안개";
  if ([51, 53, 55, 56, 57].includes(code)) return "이슬비";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "비";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "눈";
  if ([95, 96, 99].includes(code)) return "뇌우";
  return "기상 정보";
}

function buildWarning(code: number, precipitationChance: number, windSpeed: number): string {
  if ([95, 96, 99].includes(code)) {
    return "뇌우 주의";
  }
  if (precipitationChance >= 70) {
    return "강수 주의";
  }
  if (windSpeed >= 12) {
    return "강풍 주의";
  }
  if (code === 45 || code === 48) {
    return "안개 주의";
  }
  return "";
}

export async function resolveOpenMeteoLocation(
  address: string | null | undefined,
  siteName: string | null | undefined,
): Promise<OpenMeteoLocation> {
  const queries = makeAddressQueries(address, siteName);
  if (queries.length === 0) {
    throw new Error("현장 주소가 없어 Open-Meteo 좌표를 조회할 수 없습니다.");
  }

  for (const query of queries) {
    const geocodingUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
    geocodingUrl.searchParams.set("name", query);
    geocodingUrl.searchParams.set("count", "1");
    geocodingUrl.searchParams.set("language", "ko");
    geocodingUrl.searchParams.set("format", "json");

    const geocodingData = await fetchJsonWithTimeout<OpenMeteoGeocodingResponse>(geocodingUrl.toString());
    const first = geocodingData.results?.[0];

    if (!first) {
      continue;
    }

    return {
      query,
      displayName: [first.name, first.admin2, first.admin1, first.country].filter(Boolean).join(", "),
      latitude: first.latitude,
      longitude: first.longitude,
      timezone: first.timezone || "Asia/Seoul",
      country: first.country,
      admin1: first.admin1,
      admin2: first.admin2,
    };
  }

  for (const query of queries) {
    const fallbackLocation = await resolveNominatimLocation(query);
    if (fallbackLocation) {
      return fallbackLocation;
    }
  }

  throw new Error("Open-Meteo 좌표 조회에 실패했습니다.");
}

export async function resolveOpenMeteoSiteLocation(
  options: Omit<OpenMeteoDailyOptions, "days">,
): Promise<OpenMeteoLocation> {
  const latitude = typeof options.latitude === "number" && Number.isFinite(options.latitude)
    ? options.latitude
    : null;
  const longitude = typeof options.longitude === "number" && Number.isFinite(options.longitude)
    ? options.longitude
    : null;

  if (latitude !== null && longitude !== null) {
    const label = String(options.address ?? "").trim() ||
      String(options.siteName ?? "").trim() ||
      `${latitude}, ${longitude}`;

    return {
      query: `${latitude},${longitude}`,
      displayName: label,
      latitude,
      longitude,
      timezone: "Asia/Seoul",
    };
  }

  return resolveOpenMeteoLocation(options.address, options.siteName);
}

export async function fetchOpenMeteoDaily(
  options: OpenMeteoDailyOptions,
): Promise<{ location: OpenMeteoLocation; weather: OpenMeteoDailyWeather[] }> {
  const location = await resolveOpenMeteoSiteLocation(options);

  const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
  forecastUrl.searchParams.set("latitude", String(location.latitude));
  forecastUrl.searchParams.set("longitude", String(location.longitude));
  forecastUrl.searchParams.set("daily", "weather_code,temperature_2m_min,temperature_2m_max,precipitation_probability_max,wind_speed_10m_max");
  forecastUrl.searchParams.set("forecast_days", String(options.days));
  forecastUrl.searchParams.set("timezone", "Asia/Seoul");

  const forecastData = await fetchJsonWithTimeout<OpenMeteoForecastResponse>(forecastUrl.toString());
  const daily = forecastData.daily;

  const times = daily?.time ?? [];
  const codes = daily?.weather_code ?? [];
  const mins = daily?.temperature_2m_min ?? [];
  const maxs = daily?.temperature_2m_max ?? [];
  const rains = daily?.precipitation_probability_max ?? [];
  const winds = daily?.wind_speed_10m_max ?? [];

  const count = Math.min(times.length, codes.length, mins.length, maxs.length, rains.length, winds.length);
  if (count === 0) {
    throw new Error("Open-Meteo 예보 데이터가 비어있습니다.");
  }

  const weather: OpenMeteoDailyWeather[] = Array.from({ length: count }, (_, index) => {
    const code = Number(codes[index] ?? 0);
    const precipitationChance = Math.max(0, Math.min(100, Number(rains[index] ?? 0)));
    const windSpeed = Math.max(0, Number(winds[index] ?? 0));

    return {
      observedDate: `${times[index]}T00:00:00.000Z`,
      condition: codeToKoreanCondition(code),
      temperatureMin: Number(mins[index] ?? 0),
      temperatureMax: Number(maxs[index] ?? 0),
      precipitationChance,
      windSpeed,
      warning: buildWarning(code, precipitationChance, windSpeed),
      source: "open-meteo",
    };
  });

  return { location, weather };
}

export async function fetchOpenMeteoDailyByAddress(options: {
  address: string | null | undefined;
  siteName: string | null | undefined;
  days: number;
}): Promise<{ location: OpenMeteoLocation; weather: OpenMeteoDailyWeather[] }> {
  return fetchOpenMeteoDaily(options);
}
