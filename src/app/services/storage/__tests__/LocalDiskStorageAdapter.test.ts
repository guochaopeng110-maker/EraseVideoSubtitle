import { describe, it, expect, beforeAll } from 'vitest';
import { LocalDiskStorageAdapter } from '../LocalDiskStorageAdapter';
import fs from 'fs/promises';
import path from 'path';

describe('LocalDiskStorageAdapter', () => {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  let adapter: LocalDiskStorageAdapter;

  beforeAll(() => {
    adapter = new LocalDiskStorageAdapter('http://localhost:3000');
  });

  it('should save a file buffer to local disk and return a public URL', async () => {
    const testContent = Buffer.from('test video content');
    const filename = 'test-video-save.mp4';
    const filePath = path.join(uploadDir, filename);
    
    // Clean up if file existed previously
    await fs.unlink(filePath).catch(() => {});
    
    const publicUrl = await adapter.saveFile(testContent, filename);
    
    // 1. Verify the generated public URL format
    expect(publicUrl).toBe('http://localhost:3000/uploads/test-video-save.mp4');
    
    // 2. Verify that the file was physically created on local disk
    const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);

    // Clean up
    await fs.unlink(filePath).catch(() => {});
  });

  it('should physically delete a saved file from disk', async () => {
    const testContent = Buffer.from('test video content for delete');
    const filename = 'test-video-delete.mp4';
    const filePath = path.join(uploadDir, filename);

    // Save the file first
    await adapter.saveFile(testContent, filename);
    const fileExistsBefore = await fs.access(filePath).then(() => true).catch(() => false);
    expect(fileExistsBefore).toBe(true);

    // Delete the file
    await adapter.deleteFile(filename);

    // Verify it is gone
    const fileExistsAfter = await fs.access(filePath).then(() => true).catch(() => false);
    expect(fileExistsAfter).toBe(false);
  });
});
