import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { POST } from '../route';

describe('POST /api/tasks', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.stubEnv('VOLCENGINE_API_KEY', '');
  });

  it('should return a 400 error when no videoUrl is provided', async () => {
    const request = new Request('http://localhost:3000/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        mockMode: true,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain('videoUrl is required');
  });

  it('should delegate to MockVolcengineClient and return success when mockMode is true', async () => {
    const request = new Request('http://localhost:3000/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        videoUrl: 'http://localhost:3000/uploads/my-mock-video.mp4',
        mockMode: true,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.taskId).toContain('amk-mock-erase-task-');
    expect(json.requestId).toContain('req-mock-');
  });

  it('should delegate to RealVolcengineClient and return task info when mockMode is false and apiKey is provided in request body', async () => {
    const mockSuccessResponse = {
      success: true,
      task_id: 'amk-tool-erase-video-subtitle-real-111',
      request_id: 'req-real-111',
    };

    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockSuccessResponse,
    });

    const request = new Request('http://localhost:3000/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        videoUrl: 'http://localhost:3000/uploads/my-real-video.mp4',
        mockMode: false,
        apiKey: 'user-provided-key-abc',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.taskId).toBe('amk-tool-erase-video-subtitle-real-111');
    expect(json.requestId).toBe('req-real-111');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('erase-video-subtitle'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer user-provided-key-abc',
        }),
      })
    );
  });

  it('should fallback to server environment variable VOLCENGINE_API_KEY when mockMode is false and request body has no apiKey', async () => {
    vi.stubEnv('VOLCENGINE_API_KEY', 'env-server-key-xyz');

    const mockSuccessResponse = {
      success: true,
      task_id: 'amk-tool-erase-video-subtitle-env-222',
      request_id: 'req-real-222',
    };

    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockSuccessResponse,
    });

    const request = new Request('http://localhost:3000/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        videoUrl: 'http://localhost:3000/uploads/my-real-video.mp4',
        mockMode: false,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.taskId).toBe('amk-tool-erase-video-subtitle-env-222');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('erase-video-subtitle'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer env-server-key-xyz',
        }),
      })
    );
  });

  it('should return a 401 error when in real mode and no API key is provided via body or env variables', async () => {
    const request = new Request('http://localhost:3000/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        videoUrl: 'http://localhost:3000/uploads/my-real-video.mp4',
        mockMode: false,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);

    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain('Volcengine API Key is missing');
  });
});
