const API_BASE =
  "https://pomodoroapp-hyekcsauhufjdgbd.westeurope-01.azurewebsites.net/api";


export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface HttpOptions {
  method?: HttpMethod;
  body?: unknown;
  signal?: AbortSignal;
}

export async function http<T>(
  path: string,
  options: HttpOptions = {}
): Promise<T> {
  const token = localStorage.getItem("auth_token");

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers,
    body:
      options.body !== undefined
        ? JSON.stringify(options.body)
        : undefined,
    signal: options.signal,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}
