export interface StorageAdapter {
  /**
   * 暂存视频文件 buffer，返回可播放的公网临时 URL
   */
  saveFile(buffer: Buffer, filename: string): Promise<string>;
  
  /**
   * 物理删除对应的暂存视频文件
   */
  deleteFile(filename: string): Promise<void>;
}
