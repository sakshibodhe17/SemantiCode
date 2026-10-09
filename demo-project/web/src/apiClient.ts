// Thin HTTP client for the shop API.

const BASE_URL = "/api";

/** Retry a failing request with exponential back-off (network errors / 5xx). */
export async function fetchWithRetry(url: string, init: RequestInit = {}, retries = 3): Promise<Response> {
  let delay = 300;
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.status < 500 || attempt >= retries) return res;
    } catch (err) {
      if (attempt >= retries) throw err;
    }
    await new Promise((r) => setTimeout(r, delay));
    delay *= 2;
  }
}

export async function login(email: string, password: string): Promise<string> {
  const res = await fetchWithRetry(`${BASE_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("Login failed");
  const { token } = await res.json();
  localStorage.setItem("token", token);
  return token;
}

export function authHeader(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}
