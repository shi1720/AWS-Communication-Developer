export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: options.method || "GET",
    credentials: "same-origin",
    signal: options.signal,
    headers:
      options.body !== undefined ? { "Content-Type": "application/json" } : {},
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const data = await res
    .json()
    .catch(() => ({ error: `Request failed (${res.status})` }));
  if (!res.ok)
    throw new ApiError(
      data.error || data.message || `Request failed (${res.status})`,
      res.status,
      data.code,
    );
  return data as T;
}
export const money = (n: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
  }).format(n);
export const clockTime = (d: string) =>
  new Date(d).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
export const timeLeft = (d: string) => {
  const mins = Math.max(
    0,
    Math.ceil((new Date(d).getTime() - Date.now()) / 60000),
  );
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
};
