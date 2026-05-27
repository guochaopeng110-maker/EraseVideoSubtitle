import fs from 'fs/promises';
import path from 'path';

export class CleanupScheduler {
  private static isRunning = false;

  /**
   * 执行一次过期文件物理扫描与清理
   * @param maxAgeMins 过期时间阈值（分钟）
   */
  static async runCleanup(maxAgeMins = 120): Promise<string[]> {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    const deletedFiles: string[] = [];

    try {
      // Ensure uploads directory exists
      await fs.access(uploadDir);
    } catch {
      return [];
    }

    try {
      const files = await fs.readdir(uploadDir);
      const now = Date.now();
      const maxAgeMs = maxAgeMins * 60 * 1000;

      for (const file of files) {
        // Skip default gitkeep or configuration readmes
        if (file === '.gitkeep' || file === 'README.md') continue;

        const filePath = path.join(uploadDir, file);
        try {
          const stats = await fs.stat(filePath);
          const age = now - stats.mtimeMs;

          if (age > maxAgeMs) {
            await fs.unlink(filePath);
            console.log(`[CleanupScheduler] Deleted expired temporary file: ${file} (Age: ${Math.round(age / 1000 / 60)} mins)`);
            deletedFiles.push(file);
          }
        } catch (err) {
          console.error(`[CleanupScheduler] Failed to process stats or delete file ${file}:`, err);
        }
      }
    } catch (err) {
      console.error('[CleanupScheduler] Error reading uploads directory:', err);
    }

    return deletedFiles;
  }

  /**
   * 启动定期扫描后台任务（在主应用初始化/加载时调用）
   */
  static start() {
    if (this.isRunning) return;

    // Resolve configurations from environment
    const maxAgeMins = parseInt(process.env.TEMP_FILE_MAX_AGE_MINS || '120', 10);
    const cronIntervalMins = parseInt(process.env.CLEANUP_CRON_INTERVAL_MINS || '15', 10);
    const intervalMs = cronIntervalMins * 60 * 1000;

    console.log(`[CleanupScheduler] Initializing periodic cleanup timer. Max Age: ${maxAgeMins} mins, Interval: ${cronIntervalMins} mins.`);

    // Run first scanning cycle immediately upon startup
    this.runCleanup(maxAgeMins).catch((err) => {
      console.error('[CleanupScheduler] Initial cleanup run failed:', err);
    });

    // Handle dev hot-reloading duplicate timer registers
    const g = globalThis as unknown as { cleanupIntervalTimer?: NodeJS.Timeout };
    if (g.cleanupIntervalTimer) {
      clearInterval(g.cleanupIntervalTimer);
    }

    g.cleanupIntervalTimer = setInterval(() => {
      console.log('[CleanupScheduler] Running scheduled file cleanup scan...');
      this.runCleanup(maxAgeMins).catch((err) => {
        console.error('[CleanupScheduler] Scheduled cleanup run failed:', err);
      });
    }, intervalMs);

    this.isRunning = true;
  }
}
