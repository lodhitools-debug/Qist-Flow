let cachedUserPromise: Promise<any> | null = null;
let cachedUserData: any = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60000; // 1 minute client cache for user session

export async function getClientSession(): Promise<any> {
  const now = Date.now();
  if (cachedUserData && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedUserData;
  }

  if (cachedUserPromise) {
    return cachedUserPromise;
  }

  cachedUserPromise = fetch("/api/auth/me")
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      cachedUserData = data;
      lastFetchTime = Date.now();
      cachedUserPromise = null;
      return data;
    })
    .catch(() => {
      cachedUserPromise = null;
      return null;
    });

  return cachedUserPromise;
}

export function clearClientSessionCache() {
  cachedUserData = null;
  cachedUserPromise = null;
  lastFetchTime = 0;
}
