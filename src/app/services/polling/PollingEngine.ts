export class PollingEngine {
  /**
   * 根据已流逝时间（毫秒）返回下一次轮询的状态间隔（毫秒）
   * 
   * - 已流逝 < 30秒 (30000ms)：每 5秒 (5000ms) 轮询一次
   * - 30秒 <= 已流逝 < 120秒 (120000ms)：每 8秒 (8000ms) 轮询一次
   * - 已流逝 >= 120秒 (120000ms)：每 12秒 (12000ms) 轮询一次
   */
  static getNextInterval(elapsedTimeMs: number): number {
    if (elapsedTimeMs < 30000) {
      return 5000;
    }
    if (elapsedTimeMs < 120000) {
      return 8000;
    }
    return 12000;
  }
}
