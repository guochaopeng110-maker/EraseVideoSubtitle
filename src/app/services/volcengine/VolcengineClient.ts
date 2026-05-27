export interface EraseTaskResponse {
  success: boolean;
  taskId: string;
  requestId: string;
  error?: {
    code: string;
    message: string;
    param?: string;
    type?: string;
  };
}

export interface EraseTaskQueryResponse {
  success: boolean;
  taskId: string;
  status: 'processing' | 'completed' | 'failed';
  statusCode?: number;
  result?: {
    video_url: string;
    duration: number;
  };
  error?: {
    code: string;
    message: string;
    param?: string;
    type?: string;
  };
}

export interface VolcengineClient {
  /**
   * 提交异步字幕擦除任务
   * @param videoUrl 待擦除字幕的 Source Video URL
   */
  submitEraseTask(videoUrl: string): Promise<EraseTaskResponse>;

  /**
   * 查询异步字幕擦除任务状态及结果
   * @param taskId 异步任务唯一标识 ID
   */
  queryEraseTask(taskId: string): Promise<EraseTaskQueryResponse>;
}
