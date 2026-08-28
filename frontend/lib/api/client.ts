export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "production"
    ? "/api"
    : "http://localhost:5000/api");

export const REVALIDATE_60 = { next: { revalidate: 60 } } as const;

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
}

export async function readJsonResponse<T>(res: Response): Promise<T> {
  return res.json().catch(() => ({} as T));
}

export async function apiFetch<T>(
  pathOrUrl: string,
  options: RequestOptions = {}
): Promise<T> {
  const { body, params, headers: customHeaders, ...customInit } = options;

  let url: string;
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    url = pathOrUrl;
  } else if (pathOrUrl.startsWith("/api/")) {
    url = pathOrUrl;
  } else {
    const cleanPath = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
    url = `${API_URL}${cleanPath}`;
  }

  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        searchParams.set(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes("?") ? "&" : "?") + queryString;
    }
  }

  const headers: Record<string, string> = {
    ...((customHeaders as Record<string, string>) || {}),
  };

  let requestBody: BodyInit | undefined;
  if (body !== undefined) {
    if (body instanceof FormData) {
      requestBody = body;
    } else if (typeof body === "string") {
      requestBody = body;
    } else {
      headers["Content-Type"] = "application/json";
      requestBody = JSON.stringify(body);
    }
  }

  const res = await fetch(url, {
    ...customInit,
    headers,
    body: requestBody,
  });

  const data = await readJsonResponse<T & { error?: string }>(res);

  if (!res.ok) {
    const errorMessage =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : `Request failed with status ${res.status}`;
    throw new Error(errorMessage);
  }

  return data as T;
}
