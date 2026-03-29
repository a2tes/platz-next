// Lightweight helper to call the Website's on-demand revalidate endpoint
// No external deps; uses Node 18+ global fetch at runtime. Types kept loose to avoid DOM lib requirements.

const DEFAULT_TIMEOUT_MS = 5000;

export async function revalidatePaths(paths: string[], opts?: { timeoutMs?: number }) {
  const fetchFn: any = (global as any).fetch;
  if (typeof fetchFn !== "function") {
    throw new Error("Global fetch is not available in this runtime");
  }

  const baseUrl = process.env.WEBSITE_REVALIDATE_URL || "http://localhost:5052/api/revalidate";
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    throw new Error("REVALIDATE_SECRET env var is required to call revalidate endpoint");
  }

  const url = new URL(baseUrl);
  url.searchParams.set("secret", secret);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetchFn(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths }),
      signal: controller.signal,
    });
    let body: any = null;
    try {
      body = await res.json();
    } catch {}
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(timeout);
  }
}

export type RevalidateFn = typeof revalidatePaths;
