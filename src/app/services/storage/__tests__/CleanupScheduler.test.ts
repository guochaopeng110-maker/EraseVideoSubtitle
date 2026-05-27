import { describe, it, expect, beforeAll } from 'vitest';
import { CleanupScheduler } from '../CleanupScheduler';
import fs from 'fs/promises';
import path from 'path';

describe('CleanupScheduler', () => {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');

  beforeAll(async () => {
    await fs.mkdir(uploadDir, { recursive: true });
  });

  it('should physically delete files exceeding max age and keep newer files intact', async () => {
    const now = Date.now();

    // 1. Create a fresh file (0 mins old)
    const freshFilename = `fresh-temp-${now}.mp4`;
    const freshPath = path.join(uploadDir, freshFilename);
    await fs.writeFile(freshPath, 'fresh video buffer');

    // 2. Create an expired file
    const expiredFilename = `expired-temp-${now}.mp4`;
    const expiredPath = path.join(uploadDir, expiredFilename);
    await fs.writeFile(expiredPath, 'expired video buffer');

    // Manually backdate the modification time (mtime) of the expired file to 3 hours ago (180 mins)
    const threeHoursAgo = new Date(now - 3 * 60 * 60 * 1000);
    await fs.utimes(expiredPath, threeHoursAgo, threeHoursAgo);

    // 3. Trigger manual cleanup run with maxAgeMins = 120 (2 hours)
    const deletedFiles = await CleanupScheduler.runCleanup(120);

    // 4. Assertions
    expect(deletedFiles).toContain(expiredFilename);
    expect(deletedFiles).not.toContain(freshFilename);

    // Verify expired file is physically gone
    const expiredExists = await fs.access(expiredPath).then(() => true).catch(() => false);
    expect(expiredExists).toBe(false);

    // Verify fresh file is still on disk
    const freshExists = await fs.access(freshPath).then(() => true).catch(() => false);
    expect(freshExists).toBe(true);

    // Clean up fresh file
    await fs.unlink(freshPath).catch(() => {});
  });
});
