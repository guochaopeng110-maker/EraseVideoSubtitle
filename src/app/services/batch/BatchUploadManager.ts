export type BatchFileStatus = 'pending' | 'uploading' | 'uploaded' | 'failed';

export interface BatchFileEntry {
  file: File;
  status: BatchFileStatus;
  url?: string;
  error?: string;
  progress: number;
}

export interface BatchUploadManagerOptions {
  maxConcurrency?: number;
  onStateChange?: (entries: BatchFileEntry[]) => void;
  onFileUploaded?: (file: File, url: string) => void;
  onFileFailed?: (file: File, error: string) => void;
  onBatchComplete?: (entries: BatchFileEntry[]) => void;
}

export class BatchUploadManager {
  private entries: BatchFileEntry[];
  private maxConcurrency: number;
  private activeCount = 0;
  private options: BatchUploadManagerOptions;

  constructor(files: File[], options: BatchUploadManagerOptions = {}) {
    this.maxConcurrency = options.maxConcurrency ?? 2;
    this.options = options;
    this.entries = files.map((file) => ({
      file,
      status: 'pending' as const,
      progress: 0,
    }));
  }

  getEntries(): BatchFileEntry[] {
    return [...this.entries];
  }

  start(): void {
    this.drain();
  }

  private drain(): void {
    while (this.activeCount < this.maxConcurrency) {
      const next = this.entries.find((e) => e.status === 'pending');
      if (!next) break;
      this.activeCount++;
      next.status = 'uploading';
      this.notify();
      this.uploadOne(next);
    }
  }

  private uploadOne(entry: BatchFileEntry): void {
    const formData = new FormData();
    formData.append('file', entry.file);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload', true);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        entry.progress = Math.round((event.loaded / event.total) * 100);
        this.notify();
      }
    };

    xhr.onload = () => {
      this.activeCount--;
      if (xhr.status === 200) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.success && res.url) {
            entry.status = 'uploaded';
            entry.url = res.url;
            entry.progress = 100;
            this.notify();
            this.options.onFileUploaded?.(entry.file, res.url);
          } else {
            entry.status = 'failed';
            entry.error = res.error || '上传响应异常';
            this.notify();
            this.options.onFileFailed?.(entry.file, entry.error || '上传响应异常');
          }
        } catch {
          entry.status = 'failed';
          entry.error = '解析服务器上传响应失败';
          this.notify();
          this.options.onFileFailed?.(entry.file, entry.error || '解析服务器上传响应失败');
        }
      } else {
        entry.status = 'failed';
        entry.error = `服务器状态码: ${xhr.status}`;
        this.notify();
        this.options.onFileFailed?.(entry.file, entry.error || `服务器状态码: ${xhr.status}`);
      }
      this.checkBatchComplete();
      this.drain();
    };

    xhr.onerror = () => {
      this.activeCount--;
      entry.status = 'failed';
      entry.error = '网络异常，上传失败';
      this.notify();
      this.options.onFileFailed?.(entry.file, entry.error || '网络异常，上传失败');
      this.checkBatchComplete();
      this.drain();
    };

    xhr.send(formData);
  }

  private notify(): void {
    this.options.onStateChange?.(this.getEntries());
  }

  private checkBatchComplete(): void {
    const allTerminal = this.entries.every(
      (e) => e.status === 'uploaded' || e.status === 'failed'
    );
    if (allTerminal) {
      this.options.onBatchComplete?.(this.getEntries());
    }
  }
}
