import { VolcengineClient, EraseTaskResponse, EraseTaskQueryResponse } from './VolcengineClient';

export class MockVolcengineClient implements VolcengineClient {
  /**
   * 模拟提交异步字幕擦除任务
   */
  async submitEraseTask(_videoUrl: string, isPro?: boolean): Promise<EraseTaskResponse> {
    // Reference parameter to satisfy strict eslint rule in all build setups
    console.log(`[MockVolcengineClient] Simulating task submission for video: ${_videoUrl} (isPro: ${isPro})`);
    const timestamp = Date.now();
    const taskId = isPro
      ? `amk-mock-erase-task-pro-${timestamp}`
      : `amk-mock-erase-task-std-${timestamp}`;
    const requestId = `req-mock-${Math.random().toString(36).substring(2, 11)}`;

    return {
      success: true,
      taskId,
      requestId,
    };
  }

  /**
   * 模拟查询异步字幕擦除任务状态及结果
   * 基于无状态的确定性时间差算法：
   * 提取任务ID尾部时间戳，若与当前时间差小于14秒，返回 'processing'，否则返回 'completed' 并带出产物。
   */
  async queryEraseTask(taskId: string): Promise<EraseTaskQueryResponse> {
    const timestampPart = taskId
      .replace('amk-mock-erase-task-pro-', '')
      .replace('amk-mock-erase-task-std-', '')
      .replace('amk-mock-erase-task-', '');
    const timestamp = parseInt(timestampPart, 10) || Date.now();
    const elapsed = Date.now() - timestamp;

    if (elapsed < 14000) {
      return {
        success: true,
        taskId,
        status: 'processing',
      };
    }

    return {
      success: true,
      taskId,
      status: 'completed',
      result: {
        video_url: 'http://localhost:3000/uploads/cleaned-mock-output.mp4',
        duration: 24,
      },
    };
  }
}
