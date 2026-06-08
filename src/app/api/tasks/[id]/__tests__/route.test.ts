import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { GET } from '../route';
import fs from 'fs/promises';

describe('GET /api/tasks/[id]', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.stubEnv('VOLCENGINE_API_KEY', '');
  });

  it('should delegate to RealVolcengineClient when apiKey is supplied in Authorization header', async () => {
    const mockSuccessResponse = {
      success: true,
      task_id: 'amk-real-task-111',
      status: 'completed',
      result: {
        video_url: 'http://localhost/output.mp4',
        duration: 45,
      },
    };

    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockSuccessResponse,
    });

    const taskId = 'amk-real-task-111';
    const request = new Request(`http://localhost:3000/api/tasks/${taskId}`, {
      headers: {
        'Authorization': 'Bearer user-header-key-999',
      },
    });

    const response = await GET(request, { params: { id: taskId } });
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.taskId).toBe(taskId);
    expect(json.status).toBe('completed');
    expect(json.result?.video_url).toBe('http://localhost/output.mp4');

    expect(global.fetch).toHaveBeenCalledWith(
      `https://mediakit.cn-beijing.volces.com/api/v1/tasks/${taskId}`,
      expect.objectContaining({
        method: 'GET',
        headers: {
          'Authorization': 'Bearer user-header-key-999',
        },
      })
    );
  });

  it('should fallback to server environment variable VOLCENGINE_API_KEY when no header is supplied', async () => {
    vi.stubEnv('VOLCENGINE_API_KEY', 'env-server-key-888');

    const mockSuccessResponse = {
      success: true,
      task_id: 'amk-real-task-222',
      status: 'processing',
    };

    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockSuccessResponse,
    });

    const taskId = 'amk-real-task-222';
    const request = new Request(`http://localhost:3000/api/tasks/${taskId}`);

    const response = await GET(request, { params: { id: taskId } });
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.status).toBe('processing');

    expect(global.fetch).toHaveBeenCalledWith(
      `https://mediakit.cn-beijing.volces.com/api/v1/tasks/${taskId}`,
      expect.objectContaining({
        headers: {
          'Authorization': 'Bearer env-server-key-888',
        },
      })
    );
  });

  it('should return a 401 error if no API Key is provided in headers or environment', async () => {
    const taskId = 'amk-real-task-333';
    const request = new Request(`http://localhost:3000/api/tasks/${taskId}`);

    const response = await GET(request, { params: { id: taskId } });
    expect(response.status).toBe(401);

    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain('Volcengine API Key is missing');
  });

  it('should return 400 or other mapped errors from Volcengine Client failures', async () => {
    vi.stubEnv('VOLCENGINE_API_KEY', 'env-key-999');

    const mockErrorResponse = {
      success: false,
      task_id: 'amk-real-task-444',
      status: 'failed',
      error: {
        code: 'TaskExpired',
        message: 'The task result has expired and was cleaned up.',
      },
    };

    (global.fetch as Mock).mockResolvedValue({
      ok: false,
      status: 410,
      json: async () => mockErrorResponse,
    });

    const taskId = 'amk-real-task-444';
    const request = new Request(`http://localhost:3000/api/tasks/${taskId}`);

    const response = await GET(request, { params: { id: taskId } });
    expect(response.status).toBe(410);

    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain('The task result has expired');
  });

  it('should not immediately trigger physical cleanup of local uploaded file when task reaches completed state to preserve it for comparison', async () => {
    vi.stubEnv('VOLCENGINE_API_KEY', 'env-key-999');

    // 1. Spy on fs.unlink
    const unlinkSpy = vi.spyOn(fs, 'unlink').mockResolvedValue(undefined);

    // 2. Mock Volcengine query to return completed
    const mockSuccessResponse = {
      success: true,
      task_id: 'amk-real-task-555',
      status: 'completed',
      result: {
        video_url: 'http://localhost/output.mp4',
        duration: 45,
      },
    };

    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockSuccessResponse,
    });

    const taskId = 'amk-real-task-555';
    const request = new Request(`http://localhost:3000/api/tasks/${taskId}?videoUrl=http://localhost:3000/uploads/123-source-video.mp4`);

    const response = await GET(request, { params: { id: taskId } });
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.status).toBe('completed');

    // 3. Assert that fs.unlink was NOT called to preserve the source video for workbench comparison
    expect(unlinkSpy).not.toHaveBeenCalled();

    unlinkSpy.mockRestore();
  });
});
