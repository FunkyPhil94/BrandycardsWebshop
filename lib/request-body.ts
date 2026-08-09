export class RequestBodyError extends Error {
  readonly status: 400 | 413;

  constructor(status: 400 | 413, message: string) {
    super(message);
    this.status = status;
    this.name = "RequestBodyError";
  }
}

/** Reads a request body without ever buffering more than `maxBytes`. */
export async function readTextBody(request: Request, maxBytes: number): Promise<string> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    if (!/^\d+$/u.test(declaredLength.trim()) || !Number.isSafeInteger(Number(declaredLength))) {
      throw new RequestBodyError(400, "Die angegebene Anfragegröße ist ungültig.");
    }
    if (Number(declaredLength) > maxBytes) {
      throw new RequestBodyError(413, "Die Anfrage ist zu groß.");
    }
  }

  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  const parts: string[] = [];
  let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel("request body too large");
        throw new RequestBodyError(413, "Die Anfrage ist zu groß.");
      }
      parts.push(decoder.decode(chunk.value, { stream: true }));
    }
    parts.push(decoder.decode());
    return parts.join("");
  } finally {
    reader.releaseLock();
  }
}
