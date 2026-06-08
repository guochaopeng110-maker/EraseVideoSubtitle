import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { GET } from '../route';

describe('GET /api/check-url', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should return a 400 error when no url parameter is provided', async () => {
    const request = new Request('http://localhost:3000/api/check-url');
    const response = await GET(request);
    expect(response.status).toBe(400);

    const json = await response.json();
    expect(json.valid).toBe(false);
    expect(json.error).toContain('url parameter is required');
  });

  it('should return valid: true when HEAD request succeeds with 200', async () => {
    (global.fetch as Mock).mockResolvedValue({
      status: 200,
      ok: true,
    });

    const request = new Request('http://localhost:3000/api/check-url?url=https%3A%2F%2Fexample.com%2Fvideo.mp4');
    const response = await GET(request);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.valid).toBe(true);
    expect(json.statusCode).toBe(200);

    expect(global.fetch).toHaveBeenCalledWith('https://example.com/video.mp4', expect.objectContaining({
      method: 'HEAD',
    }));
  });

  it('should return valid: false when HEAD request returns 404', async () => {
    (global.fetch as Mock).mockResolvedValue({
      status: 404,
      ok: false,
    });

    const request = new Request('http://localhost:3000/api/check-url?url=https%3A%2F%2Fexample.com%2Fexpired.mp4');
    const response = await GET(request);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.valid).toBe(false);
    expect(json.statusCode).toBe(404);
  });

  it('should return valid: false on network error or timeout', async () => {
    (global.fetch as Mock).mockRejectedValue(new Error('Network connection failure'));

    const request = new Request('http://localhost:3000/api/check-url?url=https%3A%2F%2Fexample.com%2Ftimeout.mp4');
    const response = await GET(request);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.valid).toBe(false);
  });
});
