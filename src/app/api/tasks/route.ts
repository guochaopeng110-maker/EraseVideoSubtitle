import { NextResponse } from 'next/server';
import { RealVolcengineClient } from '../../services/volcengine/RealVolcengineClient';
import { CleanupScheduler } from '../../services/storage/CleanupScheduler';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  try {
    // Lazy initialize physical file cleanup scheduler
    CleanupScheduler.start();

    const body = await request.json().catch(() => ({}));
    const { videoUrl, apiKey, isPro } = body;

    // Validate parameters
    if (!videoUrl || typeof videoUrl !== 'string') {
      return NextResponse.json(
        { success: false, error: 'The parameter videoUrl is required and must be a string.' },
        { status: 400 }
      );
    }

    // 1. Perform existence check for local uploaded temporary videos
    if (videoUrl.includes('/uploads/')) {
      const filename = videoUrl.substring(videoUrl.lastIndexOf('/') + 1);
      const filePath = path.join(process.cwd(), 'public', 'uploads', filename);
      
      try {
        await fs.stat(filePath);
      } catch (statError) {
        console.warn(`[API Tasks] Local temporary video file not found: ${filePath}. It might have been physically cleaned up.`);
        return NextResponse.json(
          { 
            success: false, 
            error: '该暂存视频已超过时效被系统物理删除。请在工作台重新选择并上传本地视频文件。' 
          },
          { status: 400 }
        );
      }
    }

    // Resolve the API Key from body or environment variable
    const resolvedKey = apiKey || process.env.VOLCENGINE_API_KEY;

    if (!resolvedKey) {
      return NextResponse.json(
        { success: false, error: 'Volcengine API Key is missing. Please provide it in the request or set the VOLCENGINE_API_KEY environment variable on the server.' },
        { status: 401 }
      );
    }

    // 2. Logging destination endpoints transparently
    const targetUrl = isPro 
      ? 'https://mediakit.cn-beijing.volces.com/api/v1/tools/erase-video-subtitle-pro'
      : 'https://mediakit.cn-beijing.volces.com/api/v1/tools/erase-video-subtitle';
    
    console.log(`[API Tasks] 正在提交字幕擦除任务. 版本: [${isPro ? '精细化版 (Pro)' : '标准版 (Standard)'}], 接口: ${targetUrl}, 视频地址: ${videoUrl}`);

    // Delegate to RealVolcengineClient
    const client = new RealVolcengineClient(resolvedKey);
    const response = await client.submitEraseTask(videoUrl, isPro);

    // If Volcengine returned an API error, forward with the status code or structure
    if (!response.success && response.error) {
      console.error('[API Tasks] 火山引擎返回任务提交失败:', response.error);
      return NextResponse.json(response, { status: 400 });
    }

    console.log(`[API Tasks] 任务提交成功. 分配 TaskID: ${response.taskId}`);
    return NextResponse.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[API Tasks] 接口执行发生严重异常:', error);
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
