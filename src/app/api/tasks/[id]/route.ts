import { NextRequest, NextResponse } from 'next/server';
import { MockVolcengineClient } from '../../../services/volcengine/MockVolcengineClient';
import { RealVolcengineClient } from '../../../services/volcengine/RealVolcengineClient';
import { LocalDiskStorageAdapter } from '../../../services/storage/LocalDiskStorageAdapter';

/**
 * GET /api/tasks/[id]
 * 
 * 用于客户端轮询火山引擎字幕擦除异步任务的状态。
 * 支持 Mock 与 Real 模式自动智能识别，并处理授权网关代理。
 * 当任务进入终态后，自动触发对应的暂存视频物理删除以节省磁盘空间。
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const taskId = params.id;

  if (!taskId) {
    return NextResponse.json(
      { success: false, error: 'taskId parameter is required' },
      { status: 400 }
    );
  }

  // 1. 智能判定：若任务ID以 amk-mock-erase-task- 开头，自动由 MockClient 响应，无需 API Key
  const isMock = taskId.startsWith('amk-mock-erase-task-');
  let result;

  if (isMock) {
    const mockClient = new MockVolcengineClient();
    result = await mockClient.queryEraseTask(taskId);
  } else {
    // 2. 真实模式：解析授权凭证（Header 优先，服务端环境变量备用）
    let apiKey = '';

    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.substring(7);
    }

    if (!apiKey) {
      apiKey = process.env.VOLCENGINE_API_KEY || '';
    }

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Volcengine API Key is missing. Configure it in the sidebar or server variables.' },
        { status: 401 }
      );
    }

    // 3. 委派给 RealVolcengineClient 执行获取并返回
    const realClient = new RealVolcengineClient(apiKey);
    result = await realClient.queryEraseTask(taskId);

    if (!result.success) {
      // 提取真实的 HTTP status 进行透传响应，并标准化输出 Error 内容
      const status = result.statusCode || 400;
      const errorMessage = result.error?.message || 'Volcengine query failed';
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status }
      );
    }
  }

  // 4. 物理清理：如果任务状态进入终态（completed 或 failed），则对本地的临时视频做物理删除
  if (result.status === 'completed' || result.status === 'failed') {
    const { searchParams } = new URL(request.url);
    const videoUrl = searchParams.get('videoUrl');

    if (videoUrl && videoUrl.includes('/uploads/')) {
      const filename = videoUrl.substring(videoUrl.lastIndexOf('/') + 1);
      const storage = new LocalDiskStorageAdapter('http://localhost');
      await storage.deleteFile(filename);
    }
  }

  return NextResponse.json(result, { status: 200 });
}
