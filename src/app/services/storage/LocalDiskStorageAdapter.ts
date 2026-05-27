import { StorageAdapter } from './StorageAdapter';
import fs from 'fs/promises';
import path from 'path';

export class LocalDiskStorageAdapter implements StorageAdapter {
  private baseDir: string;
  private baseUrl: string;

  constructor(baseUrl: string) {
    // Remove trailing slash if present
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.baseDir = path.join(process.cwd(), 'public', 'uploads');
  }

  async saveFile(buffer: Buffer, filename: string): Promise<string> {
    // 1. Ensure target public/uploads directory exists recursively
    await fs.mkdir(this.baseDir, { recursive: true });
    
    // 2. Write file buffer to local disk
    const filePath = path.join(this.baseDir, filename);
    await fs.writeFile(filePath, buffer);
    
    // 3. Return the dynamic public temporary URL
    return `${this.baseUrl}/uploads/${filename}`;
  }

  async deleteFile(filename: string): Promise<void> {
    const filePath = path.join(this.baseDir, filename);
    await fs.unlink(filePath).catch(() => {});
  }
}
