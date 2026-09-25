export async function jget<T = unknown>(path: string): Promise<{ status: number; data: T }> {
  const r = await fetch(path);
  return { status: r.status, data: await r.json().catch(() => ({} as T)) };
}

export async function jpost<T = unknown>(path: string, body?: unknown): Promise<{ status: number; data: T }> {
  const r = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json().catch(() => ({} as T)) };
}
