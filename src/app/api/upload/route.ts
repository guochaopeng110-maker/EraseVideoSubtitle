import { NextResponse } from 'next/server';
import { LocalDiskStorageAdapter } from '../../services/storage/LocalDiskStorageAdapter';
import { CleanupScheduler } from '../../services/storage/CleanupScheduler';
import path from 'path';

export async function POST(request: Request) {
  try {
    // Lazy initialize physical file cleanup scheduler
    CleanupScheduler.start();

    const formData = await request.formData();
    const file = formData.get('file');

    // Behavior 4: Return 400 if file is missing or invalid
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { success: false, error: 'No file uploaded or invalid file format.' },
        { status: 400 }
      );
    }

    // Convert the uploaded file Blob to a binary Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Safely extract the original filename (fallback to timestamp if name is missing)
    const originalName = file instanceof File ? file.name : `upload_${Date.now()}.mp4`;
    const safeName = path.basename(originalName);

    // Resolve the active request origin dynamically to build the public URL
    // Supports reverse proxies like cpolar / ngrok by reading x-forwarded headers
    // Priority: 1. PUBLIC_URL env variable (explicit override for packaging) -> 2. Forwarded Host -> 3. Request Origin
    const hostHeader = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const protoHeader = request.headers.get('x-forwarded-proto') || 'http';
    const origin = process.env.PUBLIC_URL || (hostHeader ? `${protoHeader}://${hostHeader}` : new URL(request.url).origin);

    // Use our LocalDiskStorageAdapter deep module
    const storage = new LocalDiskStorageAdapter(origin);
    const publicUrl = await storage.saveFile(buffer, safeName);

    // Behavior 3: Return success response
    return NextResponse.json({
      success: true,
      url: publicUrl,
      filename: safeName,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
