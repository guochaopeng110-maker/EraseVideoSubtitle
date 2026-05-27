import { NextResponse } from 'next/server';
import { MockVolcengineClient } from '../../services/volcengine/MockVolcengineClient';
import { RealVolcengineClient } from '../../services/volcengine/RealVolcengineClient';
import { CleanupScheduler } from '../../services/storage/CleanupScheduler';

export async function POST(request: Request) {
  try {
    // Lazy initialize physical file cleanup scheduler
    CleanupScheduler.start();

    const body = await request.json().catch(() => ({}));
    const { videoUrl, mockMode, apiKey } = body;

    // Behavior 4: Validate parameters
    if (!videoUrl || typeof videoUrl !== 'string') {
      return NextResponse.json(
        { success: false, error: 'The parameter videoUrl is required and must be a string.' },
        { status: 400 }
      );
    }

    // Behavior 5: If Mock Mode is active, delegate to MockVolcengineClient
    if (mockMode) {
      const client = new MockVolcengineClient();
      const response = await client.submitEraseTask(videoUrl);
      return NextResponse.json(response);
    }

    // Behavior 6: If Real Mode is active, resolve the API Key
    const resolvedKey = apiKey || process.env.VOLCENGINE_API_KEY;

    if (!resolvedKey) {
      return NextResponse.json(
        { success: false, error: 'Volcengine API Key is missing. Please provide it in the request or set the VOLCENGINE_API_KEY environment variable on the server.' },
        { status: 401 }
      );
    }

    // Delegate to RealVolcengineClient
    const client = new RealVolcengineClient(resolvedKey);
    const response = await client.submitEraseTask(videoUrl);

    // If Volcengine returned an API error, forward with the status code or structure
    if (!response.success && response.error) {
      return NextResponse.json(response, { status: 400 });
    }

    return NextResponse.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
