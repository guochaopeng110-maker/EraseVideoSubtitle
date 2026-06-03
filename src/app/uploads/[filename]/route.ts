import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: Request,
  { params }: { params: { filename: string } }
) {
  // Await params to comply with Next.js 14+ specs
  const { filename } = params;

  if (!filename) {
    return new NextResponse('Filename is missing', { status: 400 });
  }

  // Resolve the physical location of the file in public/uploads
  const filePath = path.join(process.cwd(), 'public', 'uploads', filename);

  try {
    // Check if the file exists physically on disk
    if (!fs.existsSync(filePath)) {
      console.warn(`[UploadsRoute] File not found on disk: ${filePath}`);
      return new NextResponse('File Not Found', { status: 404 });
    }

    // Read file synchronously to return the buffer
    const fileBuffer = fs.readFileSync(filePath);

    // Basic mime-type mapping for video and common assets
    let contentType = 'application/octet-stream';
    if (filename.toLowerCase().endsWith('.mp4')) {
      contentType = 'video/mp4';
    } else if (filename.toLowerCase().endsWith('.mov')) {
      contentType = 'video/quicktime';
    } else if (filename.toLowerCase().endsWith('.avi')) {
      contentType = 'video/x-msvideo';
    } else if (filename.toLowerCase().endsWith('.png')) {
      contentType = 'image/png';
    } else if (filename.toLowerCase().endsWith('.jpg') || filename.toLowerCase().endsWith('.jpeg')) {
      contentType = 'image/jpeg';
    } else if (filename.toLowerCase().endsWith('.webp')) {
      contentType = 'image/webp';
    }

    // Return the file stream/buffer with headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error(`[UploadsRoute] Error while serving static file ${filename}:`, error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
