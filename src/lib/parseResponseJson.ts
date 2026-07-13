/**
 * Read fetch() body as JSON. If the server returned HTML or plain text (e.g. "Error occurred..."),
 * throws a readable Error instead of JSON.parse failing with "Unexpected token".
 */
export async function readResponseJson<T = unknown>(res: Response): Promise<T> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) {
    if (!res.ok) {
      throw new Error(`Request failed (${res.status})`);
    }
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    const preview = trimmed.replace(/\s+/g, ' ').slice(0, 200);
    throw new Error(
      res.ok
        ? `Server returned non-JSON (${res.status}): ${preview}`
        : `Request failed (${res.status}): ${preview}`
    );
  }
}
