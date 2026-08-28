import { apiFetch } from "./client";

export async function prLogin(
  code: string,
  password: string,
  clubSlug?: string
): Promise<{ name: string; code: string }> {
  return apiFetch<{ name: string; code: string }>("/api/pr-login", {
    method: "POST",
    body: { code, password, clubSlug },
  });
}
