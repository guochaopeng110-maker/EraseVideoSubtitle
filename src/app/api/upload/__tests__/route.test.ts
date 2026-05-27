import { describe, it, expect } from 'vitest';
import { POST } from '../route';
import fs from 'fs/promises';
import path from 'path';

describe('POST /api/upload', () => {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');

  it('should accept a video file in multipart/form-data and return success with url', async () => {
    const fileContent = Buffer.from('mock video content');
    const blob = new Blob([fileContent], { type: 'video/mp4' });
    
    // Construct mock FormData
    const formData = new FormData();
    formData.append('file', blob, 'test-route-upload.mp4');

    // Construct mock Request
    const request = new Request('http://localhost:3000/api/upload', {
      method: 'POST',
      body: formData,
    });

    // Invoke the route handler
    const response = await POST(request);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.url).toContain('/uploads/test-route-upload.mp4');
    expect(json.filename).toBe('test-route-upload.mp4');

    // Verify that the file was physically created on local disk
    const filePath = path.join(uploadDir, 'test-route-upload.mp4');
    const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);

    // Clean up
    await fs.unlink(filePath).catch(() => {});
  });

  it('should return a 400 error when no file is uploaded', async () => {
    const formData = new FormData();

    const request = new Request('http://localhost:3000/api/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain('No file uploaded');
  });
});
