const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: init?.credentials ?? "include",
  });
}
