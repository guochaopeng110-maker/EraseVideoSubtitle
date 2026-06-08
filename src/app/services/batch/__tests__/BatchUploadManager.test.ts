import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BatchUploadManager } from '../BatchUploadManager';

// --- XHR Mock Infrastructure ---
class MockXHRUpload {
  onprogress: ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | undefined = undefined;
}

class MockXHR {
  static instances: MockXHR[] = [];
  method = '';
  url = '';
  async = true;
  status = 200;
  responseText = '{}';
  upload = new MockXHRUpload();
  onload: (() => void) | undefined = undefined;
  onerror: (() => void) | undefined = undefined;
  sentFormData: FormData | null = null;

  constructor() {
    MockXHR.instances.push(this);
  }

  open(method: string, url: string, async: boolean) {
    this.method = method;
    this.url = url;
    this.async = async;
  }

  send(formData: FormData) {
    this.sentFormData = formData;
  }

  simulateSuccess(url: string) {
    this.status = 200;
    this.responseText = JSON.stringify({ success: true, url });
    this.onload?.();
  }

  simulateFailure(status: number) {
    this.status = status;
    this.responseText = JSON.stringify({ success: false, error: 'Server error' });
    this.onload?.();
  }

  simulateNetworkError() {
    this.onerror?.();
  }

  simulateProgress(loaded: number, total: number) {
    this.upload.onprogress?.({ lengthComputable: true, loaded, total });
  }

  static reset() {
    MockXHR.instances = [];
  }
}

beforeEach(() => {
  MockXHR.reset();
  vi.stubGlobal('XMLHttpRequest', MockXHR);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeFile(name: string): File {
  return new File(['dummy content'], name, { type: 'video/mp4' });
}

describe('BatchUploadManager', () => {
  it('should initialize all entries as pending and progress 0', () => {
    const files = [makeFile('a.mp4'), makeFile('b.mp4')];
    const mgr = new BatchUploadManager(files);
    const entries = mgr.getEntries();

    expect(entries).toHaveLength(2);
    expect(entries[0].file.name).toBe('a.mp4');
    expect(entries[0].status).toBe('pending');
    expect(entries[0].progress).toBe(0);
    expect(entries[1].status).toBe('pending');
    expect(entries[1].progress).toBe(0);
  });

  it('should limit concurrent uploads to maxConcurrency (default 2)', () => {
    const files = [makeFile('a.mp4'), makeFile('b.mp4'), makeFile('c.mp4')];
    const mgr = new BatchUploadManager(files);
    mgr.start();

    // Only 2 XHR instances should have been created (3rd is pending)
    expect(MockXHR.instances).toHaveLength(2);

    const entries = mgr.getEntries();
    expect(entries[0].status).toBe('uploading');
    expect(entries[1].status).toBe('uploading');
    expect(entries[2].status).toBe('pending');
  });

  it('should start next pending upload when one completes', () => {
    const files = [makeFile('a.mp4'), makeFile('b.mp4'), makeFile('c.mp4')];
    const mgr = new BatchUploadManager(files);
    mgr.start();

    // Complete the first upload
    MockXHR.instances[0].simulateSuccess('http://example.com/a.mp4');

    // Now the 3rd file should have started
    expect(MockXHR.instances).toHaveLength(3);
    const entries = mgr.getEntries();
    expect(entries[0].status).toBe('uploaded');
    expect(entries[0].url).toBe('http://example.com/a.mp4');
    expect(entries[1].status).toBe('uploading');
    expect(entries[2].status).toBe('uploading');
  });

  it('should continue processing when a file upload fails (skip-and-continue)', () => {
    const files = [makeFile('a.mp4'), makeFile('b.mp4'), makeFile('c.mp4')];
    const mgr = new BatchUploadManager(files);
    mgr.start();

    // Fail the first upload
    MockXHR.instances[0].simulateFailure(500);

    // The 3rd file should have started despite the failure
    expect(MockXHR.instances).toHaveLength(3);
    const entries = mgr.getEntries();
    expect(entries[0].status).toBe('failed');
    expect(entries[2].status).toBe('uploading');
  });

  it('should call onFileUploaded with file and url on success', () => {
    const files = [makeFile('a.mp4')];
    const onFileUploaded = vi.fn();
    const mgr = new BatchUploadManager(files, { onFileUploaded });
    mgr.start();

    MockXHR.instances[0].simulateSuccess('http://example.com/a.mp4');

    expect(onFileUploaded).toHaveBeenCalledWith(files[0], 'http://example.com/a.mp4');
  });

  it('should call onFileFailed with error when upload fails', () => {
    const files = [makeFile('a.mp4')];
    const onFileFailed = vi.fn();
    const mgr = new BatchUploadManager(files, { onFileFailed });
    mgr.start();

    MockXHR.instances[0].simulateFailure(500);

    const entries = mgr.getEntries();
    expect(entries[0].status).toBe('failed');
    expect(entries[0].error).toBeTruthy();
    expect(onFileFailed).toHaveBeenCalledWith(files[0], expect.any(String));
  });

  it('should call onBatchComplete when all files reach terminal state', () => {
    const files = [makeFile('a.mp4'), makeFile('b.mp4')];
    const onBatchComplete = vi.fn();
    const mgr = new BatchUploadManager(files, { onBatchComplete });
    mgr.start();

    MockXHR.instances[0].simulateSuccess('http://example.com/a.mp4');
    MockXHR.instances[1].simulateFailure(500);

    expect(onBatchComplete).toHaveBeenCalledTimes(1);
    const resultEntries = onBatchComplete.mock.calls[0][0];
    expect(resultEntries).toHaveLength(2);
    expect(resultEntries[0].status).toBe('uploaded');
    expect(resultEntries[1].status).toBe('failed');
  });

  it('should track upload progress per file and notify state changes', () => {
    const files = [makeFile('a.mp4')];
    const onStateChange = vi.fn();
    const mgr = new BatchUploadManager(files, { onStateChange });
    mgr.start();

    MockXHR.instances[0].simulateProgress(50, 100);

    const entries = mgr.getEntries();
    expect(entries[0].progress).toBe(50);
    expect(onStateChange).toHaveBeenCalled();
  });

  it('should handle network error via onerror', () => {
    const files = [makeFile('a.mp4')];
    const onFileFailed = vi.fn();
    const mgr = new BatchUploadManager(files, { onFileFailed });
    mgr.start();

    MockXHR.instances[0].simulateNetworkError();

    const entries = mgr.getEntries();
    expect(entries[0].status).toBe('failed');
    expect(entries[0].error).toContain('网络异常');
    expect(onFileFailed).toHaveBeenCalled();
  });
});
