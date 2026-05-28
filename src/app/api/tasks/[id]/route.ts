import { NextResponse } from 'next/server';
import { RealVolcengineClient } from '../../../services/volcengine/RealVolcengineClient';

/**
 * GET /api/tasks/[id]
 * 
 * 用于客户端轮询火山引擎字幕擦除异步任务的状态。
 * 真实模式下，解析授权凭证并发往火山引擎查询。
 * 当任务进入终态后，自动触发对应的暂存视频物理删除以节省磁盘空间。
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const taskId = params.id;

  if (!taskId) {
    return NextResponse.json(
      { success: false, error: 'taskId parameter is required' },
      { status: 400 }
    );
  }

  // 1. 真实模式：解析授权凭证（Header 优先，服务端环境变量备用）
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

  // 2. 委派给 RealVolcengineClient 执行获取并返回
  console.log(`[API Tasks Query] 正在向火山引擎查询任务状态. TaskID: ${taskId}`);
  const realClient = new RealVolcengineClient(apiKey);
  const result = await realClient.queryEraseTask(taskId);

  if (!result.success) {
    // 提取真实的 HTTP status 进行透传响应，并标准化输出 Error 内容
    const status = result.statusCode || 400;
    const errorMessage = result.error?.message || 'Volcengine query failed';
    console.error(`[API Tasks Query] 向火山引擎查询状态失败. TaskID: ${taskId}, Error: ${errorMessage}`);
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status }
    );
  }

  console.log(`[API Tasks Query] 火山任务状态返回 - TaskID: ${taskId}, Status: ${result.status}`);

  // 3. 物理清理：完全交由后台 CleanupScheduler 机制在过期后自动批量清理。
  // 不再在此处立即进行强行物理删除，以确保用户能在工作台无缝预览并双视频同步对比原视频。
  console.log(`[API Tasks Query] 任务已进入终态 [${result.status}]。原视频保留以备工作台效果对比播放，后续由后台 CleanupScheduler 安全自动回收。`);

  return NextResponse.json(result, { status: 200 });
}
