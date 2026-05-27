import { VolcengineClient, EraseTaskResponse, EraseTaskQueryResponse } from './VolcengineClient';

export class RealVolcengineClient implements VolcengineClient {
  private apiKey: string;
  private baseUrl = 'https://mediakit.cn-beijing.volces.com/api/v1/tools/erase-video-subtitle';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * 提交真实异步字幕擦除任务到火山引擎
   */
  async submitEraseTask(videoUrl: string): Promise<EraseTaskResponse> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          video_url: videoUrl,
        }),
      });

      const data = await response.json();

      // Return unified interface response
      return {
        success: data.success ?? false,
        taskId: data.task_id ?? '',
        requestId: data.request_id ?? '',
        error: data.error,
      };
    } catch (error) {
      // In case of network-level failures or json parsing failures
      return {
        success: false,
        taskId: '',
        requestId: `req-local-err-${Date.now()}`,
        error: {
          code: 'NetworkError',
          message: error instanceof Error ? error.message : 'Failed to connect to Volcengine API',
        },
      };
    }
  }

  /**
   * 查询异步字幕擦除任务状态及结果
   */
  async queryEraseTask(taskId: string): Promise<EraseTaskQueryResponse> {
    try {
      const queryUrl = `https://mediakit.cn-beijing.volces.com/api/v1/tasks/${taskId}`;

      const response = await fetch(queryUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      const data = await response.json();

      return {
        success: data.success ?? false,
        taskId: data.task_id ?? taskId,
        status: data.status ?? 'failed',
        statusCode: response.status,
        result: data.result,
        error: data.error,
      };
    } catch (error) {
      return {
        success: false,
        taskId,
        status: 'failed',
        error: {
          code: 'NetworkError',
          message: error instanceof Error ? error.message : 'Failed to query task status from Volcengine API',
        },
      };
    }
  }
}
