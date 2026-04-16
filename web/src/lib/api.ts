const API_BASE = '/api';

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...((options?.headers as Record<string, string>) || {}),
  };
  // Only set Content-Type for requests that have a body, otherwise
  // Fastify rejects the empty body with 400
  if (options?.body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
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
