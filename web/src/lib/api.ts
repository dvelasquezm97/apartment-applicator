const API_BASE = '/api';

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      // No auth for now — using X-User-Id header for dev
      ...((options?.headers as Record<string, string>) || {}),
    },
    ...options,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `API error: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function apiUpload<T>(path: string, file: File, params?: Record<string, string>): Promise<T> {
  const queryStr = params ? '?' + new URLSearchParams(params).toString() : '';
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}${path}${queryStr}`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Upload error: ${response.status}`);
  }
  return response.json() as Promise<T>;
}
