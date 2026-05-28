import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { RealVolcengineClient } from '../RealVolcengineClient';

describe('RealVolcengineClient', () => {
  const apiKey = 'test-volcengine-api-key-12345';
  let client: RealVolcengineClient;

  beforeEach(() => {
    client = new RealVolcengineClient(apiKey);
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should call Volcano Engine API with correct Authorization headers and body, returning taskId on success', async () => {
    const mockSuccessResponse = {
      success: true,
      task_id: 'amk-tool-erase-video-subtitle-987654321',
      request_id: 'req-success-123',
    };

    // Setup mock fetch response
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockSuccessResponse,
    });

    const videoUrl = 'http://localhost:3000/uploads/my-source-video.mp4';
    const response = await client.submitEraseTask(videoUrl);

    // 1. Verify fetch was called with correct arguments
    expect(global.fetch).toHaveBeenCalledWith(
      'https://mediakit.cn-beijing.volces.com/api/v1/tools/erase-video-subtitle',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ video_url: videoUrl }),
      }
    );

    // 2. Verify returned response structure maps cleanly
    expect(response.success).toBe(true);
    expect(response.taskId).toBe('amk-tool-erase-video-subtitle-987654321');
    expect(response.requestId).toBe('req-success-123');
    expect(response.error).toBeUndefined();
  });

  it('should call Volcano Engine Pro API when isPro is true, using correct endpoint and mode body parameter', async () => {
    const mockSuccessResponse = {
      success: true,
      task_id: 'amk-tool-erase-video-subtitle-pro-987654321',
      request_id: 'req-success-pro-123',
    };

    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockSuccessResponse,
    });

    const videoUrl = 'http://localhost:3000/uploads/my-source-video.mp4';
    const response = await client.submitEraseTask(videoUrl, true);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://mediakit.cn-beijing.volces.com/api/v1/tools/erase-video-subtitle-pro',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ video_url: videoUrl, mode: 'Subtitle' }),
      }
    );

    expect(response.success).toBe(true);
    expect(response.taskId).toBe('amk-tool-erase-video-subtitle-pro-987654321');
    expect(response.requestId).toBe('req-success-pro-123');
  });

  it('should parse and return structured error if Volcano Engine API returns an error response', async () => {
    const mockErrorResponse = {
      success: false,
      task_id: '',
      request_id: 'req-fail-456',
      error: {
        code: 'InvalidParameter',
        message: 'The parameter `video_url` is required.',
        param: 'video_url',
        type: 'BadRequest',
      },
    };

    // Setup mock fetch error response
    (global.fetch as Mock).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => mockErrorResponse,
    });

    const videoUrl = ''; // empty URL
    const response = await client.submitEraseTask(videoUrl);

    // Verify error propagates to user
    expect(response.success).toBe(false);
    expect(response.taskId).toBe('');
    expect(response.requestId).toBe('req-fail-456');
    expect(response.error).toBeDefined();
    expect(response.error?.code).toBe('InvalidParameter');
    expect(response.error?.message).toBe('The parameter `video_url` is required.');
  });

  it('should call Volcano Engine API with GET method, correct headers and return completed task details on success', async () => {
    const mockQueryCompletedResponse = {
      success: true,
      task_id: 'amk-real-task-777',
      status: 'completed',
      result: {
        video_url: 'https://volcengine-cleaned-bucket.com/output.mp4',
        duration: 120,
      },
    };

    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockQueryCompletedResponse,
    });

    const taskId = 'amk-real-task-777';
    const response = await client.queryEraseTask(taskId);

    // 1. Verify GET fetch is called properly
    expect(global.fetch).toHaveBeenCalledWith(
      `https://mediakit.cn-beijing.volces.com/api/v1/tasks/${taskId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      }
    );

    // 2. Verify returned structure mapping
    expect(response.success).toBe(true);
    expect(response.taskId).toBe(taskId);
    expect(response.status).toBe('completed');
    expect(response.result).toBeDefined();
    expect(response.result?.video_url).toBe('https://volcengine-cleaned-bucket.com/output.mp4');
    expect(response.result?.duration).toBe(120);
    expect(response.error).toBeUndefined();
  });

  it('should return failed query status and map Volcano Engine API error structured responses', async () => {
    const mockQueryErrorResponse = {
      success: false,
      task_id: 'amk-real-task-888',
      status: 'failed',
      error: {
        code: 'TaskNotFound',
        message: 'The requested task ID does not exist.',
      },
    };

    (global.fetch as Mock).mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => mockQueryErrorResponse,
    });

    const taskId = 'amk-real-task-888';
    const response = await client.queryEraseTask(taskId);

    expect(response.success).toBe(false);
    expect(response.taskId).toBe(taskId);
    expect(response.status).toBe('failed');
    expect(response.error).toBeDefined();
    expect(response.error?.code).toBe('TaskNotFound');
    expect(response.error?.message).toBe('The requested task ID does not exist.');
  });
});
