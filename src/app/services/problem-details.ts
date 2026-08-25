import { HttpErrorResponse } from '@angular/common/http';

export async function problemDetail(error: unknown, fallback: string): Promise<string> {
  if (!(error instanceof HttpErrorResponse)) {
    return fallback;
  }
  if (error.status === 0) {
    return 'Cannot reach the server. Check that the backend is running.';
  }
  const body = await readBody(error);
  const detail = extractDetail(body);
  return detail ?? fallback;
}

async function readBody(error: HttpErrorResponse): Promise<unknown> {
  const body = error.error;
  if (body instanceof Blob) {
    try {
      return JSON.parse(await body.text());
    } catch {
      return null;
    }
  }
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }
  return body;
}

function extractDetail(body: unknown): string | null {
  if (body && typeof body === 'object') {
    const detail = (body as { detail?: unknown }).detail;
    if (typeof detail === 'string' && detail.trim().length > 0) {
      return detail;
    }
  }
  return null;
}
