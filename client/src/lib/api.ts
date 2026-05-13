const KEY = "ttm_token";

const API_BASE_URL = import.meta.env.VITE_API_URL;

export function getToken(): string | null {
  return localStorage.getItem(KEY);
}

export function setToken(t: string) {
  localStorage.setItem(KEY, t);
}

export function clearToken() {
  localStorage.removeItem(KEY);
}

async function parseJson(res: Response) {
  const text = await res.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function formatApiError(body: unknown): string {
  if (!body || typeof body !== "object") {
    return typeof body === "string" ? body : "Request failed";
  }

  if (!("error" in body)) {
    return JSON.stringify(body);
  }

  const err = (body as { error: unknown }).error;

  if (typeof err === "string") {
    return err;
  }

  if (err && typeof err === "object" && "fieldErrors" in err) {
    const fe = (err as { fieldErrors: Record<string, string[] | undefined> }).fieldErrors;

    const parts = Object.entries(fe).flatMap(([k, arr]) =>
      (arr ?? []).map((m) => `${k}: ${m}`)
    );

    if (parts.length) return parts.join(" ");
  }

  if (err && typeof err === "object" && "formErrors" in err) {
    const fe = (err as { formErrors: string[] }).formErrors;

    if (fe?.length) return fe.join(" ");
  }

  try {
    return JSON.stringify(err);
  } catch {
    return "Request failed";
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const { token, headers, ...rest } = options;

  const h = new Headers(headers);

  h.set("Content-Type", "application/json");

  if (token) {
    h.set("Authorization", `Bearer ${token}`);
  }

  let res: Response;

  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: h
    });
  } catch (e) {
    let msg = e instanceof Error ? e.message : String(e);

    if (
      e &&
      typeof e === "object" &&
      "errors" in e &&
      Array.isArray((e as { errors: unknown[] }).errors)
    ) {
      const parts = (e as { errors: unknown[] }).errors.map((x) =>
        x instanceof Error ? x.message : String(x)
      );

      if (parts.length) {
        msg = parts.join("; ");
      }
    }

    const hint = /ECONNREFUSED|ENOTFOUND|Failed to fetch|ECONNRESET/i.test(msg)
      ? " Set DATABASE_URL in .env at the repo root and ensure backend server is running."
      : "";

    throw new Error(`Cannot reach API (${path}). (${msg})${hint}`);
  }

  const body = await parseJson(res);

  if (!res.ok) {
    throw new Error(formatApiError(body));
  }

  return body as T;
}

export function apiGet<T>(path: string, token: string | null) {
  return apiFetch<T>(path, {
    method: "GET",
    token
  });
}

export function apiPost<T>(path: string, data: unknown, token?: string | null) {
  return apiFetch<T>(path, {
    method: "POST",
    body: JSON.stringify(data),
    token
  });
}

export function apiPatch<T>(path: string, data: unknown, token: string | null) {
  return apiFetch<T>(path, {
    method: "PATCH",
    body: JSON.stringify(data),
    token
  });
}

export function apiDelete(path: string, token: string | null) {
  return apiFetch<null>(path, {
    method: "DELETE",
    token
  });
}