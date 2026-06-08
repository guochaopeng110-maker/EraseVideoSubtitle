import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json(
      { valid: false, error: 'url parameter is required' },
      { status: 400 }
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    return NextResponse.json({
      valid: response.ok,
      statusCode: response.status,
    });
  } catch (error) {
    clearTimeout(timeoutId);
    console.error(`[check-url] Failed to check url validity: ${url}`, error);
    return NextResponse.json({ valid: false });
  }
}
