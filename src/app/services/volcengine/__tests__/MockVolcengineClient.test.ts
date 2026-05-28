import { describe, it, expect } from 'vitest';
import { MockVolcengineClient } from '../MockVolcengineClient';

describe('MockVolcengineClient', () => {
  it('should immediately return a successful mock task response with a valid mock task ID', async () => {
    const client = new MockVolcengineClient();
    const videoUrl = 'http://localhost:3000/uploads/test.mp4';

    const response = await client.submitEraseTask(videoUrl);

    // 1. Verify successful response structure
    expect(response.success).toBe(true);
    expect(response.requestId).toBeDefined();
    expect(typeof response.requestId).toBe('string');

    // 2. Verify mock task id starts with expected prefix
    expect(response.taskId).toContain('amk-mock-erase-task-');
  });

  it('should return mock task IDs with different prefixes depending on isPro parameter', async () => {
    const client = new MockVolcengineClient();
    const videoUrl = 'http://localhost:3000/uploads/test.mp4';

    const responseStd = await client.submitEraseTask(videoUrl, false);
    expect(responseStd.taskId).toContain('amk-mock-erase-task-std-');

    const responsePro = await client.submitEraseTask(videoUrl, true);
    expect(responsePro.taskId).toContain('amk-mock-erase-task-pro-');
  });

  it('should return status processing when query is made within 14 seconds of mock creation timestamp', async () => {
    const client = new MockVolcengineClient();
    // Simulate a taskId created right now
    const now = Date.now();
    const taskId = `amk-mock-erase-task-${now}`;

    const queryResponse = await client.queryEraseTask(taskId);

    expect(queryResponse.success).toBe(true);
    expect(queryResponse.taskId).toBe(taskId);
    expect(queryResponse.status).toBe('processing');
    expect(queryResponse.result).toBeUndefined();
  });

  it('should return status completed with output details when query is made 14+ seconds after mock creation timestamp', async () => {
    const client = new MockVolcengineClient();
    // Simulate a taskId created 15 seconds ago
    const fifteenSecondsAgo = Date.now() - 15000;
    const taskId = `amk-mock-erase-task-${fifteenSecondsAgo}`;

    const queryResponse = await client.queryEraseTask(taskId);

    expect(queryResponse.success).toBe(true);
    expect(queryResponse.taskId).toBe(taskId);
    expect(queryResponse.status).toBe('completed');
    expect(queryResponse.result).toBeDefined();
    expect(queryResponse.result?.video_url).toContain('/uploads/cleaned-');
    expect(queryResponse.result?.duration).toBe(24);
  });
});
