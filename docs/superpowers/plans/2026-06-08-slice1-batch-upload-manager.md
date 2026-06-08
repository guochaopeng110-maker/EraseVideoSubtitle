# Slice 1: BatchUploadManager + Multi-file Upload with Auto Erase Trigger

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建客户端 BatchUploadManager 模块，支持多文件并发受限上传（最多 2 并行），上传成功即自动触发擦除任务，单文件失败不阻塞批次。

**Architecture:** BatchUploadManager 是一个纯 TypeScript 类，维护一个并发池（最多 2 个 XHR 同时上传）。每个文件独立追踪状态 (`pending` → `uploading` → `uploaded` | `failed`)。上传成功后通过回调委托给 page.tsx 中已有的 `handleStartErase` 流程。MainDashboard 的 `<input>` 添加 `multiple` 属性，拖放处理器接受多文件，多文件走 BatchUploadManager，单文件保持原有流程不变。

**Tech Stack:** TypeScript, Vitest (单元测试), React (MainDashboard / page.tsx 集成)

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `src/app/services/batch/BatchUploadManager.ts` | 并发受限的批量上传管理器核心类 |
| Create | `src/app/services/batch/__tests__/BatchUploadManager.test.ts` | BatchUploadManager 单元测试 |
| Modify | `src/app/components/MainDashboard/MainDashboard.tsx` | 文件输入添加 `multiple`、拖放支持多文件、新增 `onFilesSelect` 回调 |
| Modify | `src/app/page.tsx` | 集成 BatchUploadManager，多文件分发逻辑，每个文件独立创建侧边栏任务 |

---

## Task 1: BatchUploadManager 类型定义与核心构造

**Files:**
- Create: `src/app/services/batch/BatchUploadManager.ts`

- [ ] **Step 1: 创建 BatchUploadManager 模块，定义类型与类骨架**

```typescript
// src/app/services/batch/BatchUploadManager.ts

export type BatchFileStatus = 'pending' | 'uploading' | 'uploaded' | 'failed';

export interface BatchFileEntry {
  file: File;
  status: BatchFileStatus;
  /** Server-returned public URL after successful upload */
  url?: string;
  /** Error message if upload failed */
  error?: string;
  /** XHR upload progress 0–100 */
  progress: number;
}

export interface BatchUploadManagerOptions {
  /** Maximum number of concurrent uploads (default: 2) */
  maxConcurrency?: number;
  /** Called when any file entry status changes — UI should re-render */
  onStateChange?: (entries: BatchFileEntry[]) => void;
  /** Called when a single file uploads successfully — triggers erase submission */
  onFileUploaded?: (file: File, url: string) => void;
  /** Called when a single file upload fails — skip-and-continue */
  onFileFailed?: (file: File, error: string) => void;
  /** Called when ALL files in the batch have reached a terminal state (uploaded or failed) */
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

  /** Start processing the upload queue */
  start(): void {
    this.drain();
  }

  /** Return a snapshot of current entries */
  getEntries(): BatchFileEntry[] {
    return [...this.entries];
  }

  /** Internal: pull next pending entries up to concurrency limit */
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

  /** Internal: upload a single file via XHR to /api/upload */
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
            this.options.onFileFailed?.(entry.file, entry.error);
          }
        } catch {
          entry.status = 'failed';
          entry.error = '解析服务器上传响应失败';
          this.notify();
          this.options.onFileFailed?.(entry.file, entry.error);
        }
      } else {
        entry.status = 'failed';
        entry.error = `服务器状态码: ${xhr.status}`;
        this.notify();
        this.options.onFileFailed?.(entry.file, entry.error);
      }

      this.checkBatchComplete();
      this.drain();
    };

    xhr.onerror = () => {
      this.activeCount--;
      entry.status = 'failed';
      entry.error = '网络异常，上传失败';
      this.notify();
      this.options.onFileFailed?.(entry.file, entry.error);
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
```

- [ ] **Step 2: 验证文件无 TypeScript 编译错误**

Run: `npx tsc --noEmit src/app/services/batch/BatchUploadManager.ts`
Expected: 无错误输出

- [ ] **Step 3: Commit**

```bash
git add src/app/services/batch/BatchUploadManager.ts
git commit -m "feat: add BatchUploadManager core with concurrency pool and state tracking"
```

---

## Task 2: BatchUploadManager 单元测试

**Files:**
- Create: `src/app/services/batch/__tests__/BatchUploadManager.test.ts`

- [ ] **Step 1: 编写测试 — 并发控制、失败跳过、状态转换**

```typescript
// src/app/services/batch/__tests__/BatchUploadManager.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BatchUploadManager, BatchFileEntry } from '../BatchUploadManager';

// --- XHR Mock Infrastructure ---

interface MockXHRCallbacks {
  onprogress?: (event: { lengthComputable: boolean; loaded: number; total: number }) => void;
  onload?: () => void;
  onerror?: () => void;
}

class MockXHRUpload {
  onprogress: MockXHRCallbacks['onprogress'] = undefined;
}

class MockXHR {
  static instances: MockXHR[] = [];
  method = '';
  url = '';
  async = true;
  status = 200;
  responseText = '{}';
  upload = new MockXHRUpload();
  onload: MockXHRCallbacks['onload'] = undefined;
  onerror: MockXHRCallbacks['onerror'] = undefined;
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

  // Test helpers
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

// Replace global XMLHttpRequest
beforeEach(() => {
  MockXHR.reset();
  vi.stubGlobal('XMLHttpRequest', MockXHR);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// --- Helper ---
function makeFile(name: string): File {
  return new File(['dummy content'], name, { type: 'video/mp4' });
}

// --- Tests ---

describe('BatchUploadManager', () => {
  it('should initialize all entries as pending', () => {
    const files = [makeFile('a.mp4'), makeFile('b.mp4'), makeFile('c.mp4')];
    const mgr = new BatchUploadManager(files);
    const entries = mgr.getEntries();

    expect(entries).toHaveLength(3);
    expect(entries.every((e) => e.status === 'pending')).toBe(true);
    expect(entries.every((e) => e.progress === 0)).toBe(true);
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
    expect(entries[1].status).toBe('uploading');
    expect(entries[2].status).toBe('uploading');
  });

  it('should continue processing when a file upload fails (skip-and-continue)', () => {
    const files = [makeFile('a.mp4'), makeFile('b.mp4'), makeFile('c.mp4')];
    const onFileFailed = vi.fn();
    const mgr = new BatchUploadManager(files, { onFileFailed });
    mgr.start();

    // Fail the first upload
    MockXHR.instances[0].simulateFailure(500);

    // The 3rd file should have started despite the failure
    expect(MockXHR.instances).toHaveLength(3);
    const entries = mgr.getEntries();
    expect(entries[0].status).toBe('failed');
    expect(entries[0].error).toBeTruthy();
    expect(entries[2].status).toBe('uploading');
    expect(onFileFailed).toHaveBeenCalledWith(files[0], expect.any(String));
  });

  it('should call onFileUploaded with file and url on success', () => {
    const files = [makeFile('a.mp4')];
    const onFileUploaded = vi.fn();
    const mgr = new BatchUploadManager(files, { onFileUploaded });
    mgr.start();

    MockXHR.instances[0].simulateSuccess('http://example.com/a.mp4');

    expect(onFileUploaded).toHaveBeenCalledWith(files[0], 'http://example.com/a.mp4');
  });

  it('should call onBatchComplete when all files reach terminal state', () => {
    const files = [makeFile('a.mp4'), makeFile('b.mp4')];
    const onBatchComplete = vi.fn();
    const mgr = new BatchUploadManager(files, { onBatchComplete });
    mgr.start();

    MockXHR.instances[0].simulateSuccess('http://example.com/a.mp4');
    MockXHR.instances[1].simulateFailure(500);

    expect(onBatchComplete).toHaveBeenCalledTimes(1);
    const resultEntries: BatchFileEntry[] = onBatchComplete.mock.calls[0][0];
    expect(resultEntries).toHaveLength(2);
    expect(resultEntries[0].status).toBe('uploaded');
    expect(resultEntries[1].status).toBe('failed');
  });

  it('should track upload progress per file', () => {
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

  it('should respect custom maxConcurrency', () => {
    const files = [makeFile('a.mp4'), makeFile('b.mp4'), makeFile('c.mp4'), makeFile('d.mp4')];
    const mgr = new BatchUploadManager(files, { maxConcurrency: 3 });
    mgr.start();

    expect(MockXHR.instances).toHaveLength(3);
    const entries = mgr.getEntries();
    expect(entries.filter((e) => e.status === 'uploading')).toHaveLength(3);
    expect(entries[3].status).toBe('pending');
  });
});
```

- [ ] **Step 2: 运行测试并验证全部通过**

Run: `npx vitest run src/app/services/batch/__tests__/BatchUploadManager.test.ts`
Expected: 所有测试 PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/services/batch/__tests__/BatchUploadManager.test.ts
git commit -m "test: add BatchUploadManager unit tests for concurrency, skip-continue, state transitions"
```

---

## Task 3: MainDashboard 多文件输入支持

**Files:**
- Modify: `src/app/components/MainDashboard/MainDashboard.tsx`

- [ ] **Step 1: 扩展 Props 接口，新增 `onFilesSelect` 回调**

在 `MainDashboardProps` interface 中添加：

```typescript
// 在 onFileSelect 之后添加
onFilesSelect?: (files: File[]) => void;
```

在组件解构中添加：

```typescript
// 在 onFileSelect 之后解构
onFilesSelect,
```

- [ ] **Step 2: 为 `<input>` 添加 `multiple` 属性并修改 `handleFileChange`**

修改隐藏文件输入元素，添加 `multiple` 属性：

```tsx
<input
  type="file"
  ref={fileInputRef}
  onChange={handleFileChange}
  accept="video/*"
  multiple
  style={{ display: 'none' }}
/>
```

修改 `handleFileChange` 处理函数以区分单文件/多文件：

```typescript
const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  if (e.target.files && e.target.files.length > 0) {
    const fileList = Array.from(e.target.files);
    if (fileList.length === 1) {
      onFileSelect(fileList[0]);
    } else if (fileList.length > 1 && onFilesSelect) {
      onFilesSelect(fileList);
    } else {
      onFileSelect(fileList[0]);
    }
    // Reset input so same files can be re-selected
    e.target.value = '';
  }
};
```

- [ ] **Step 3: 修改拖放处理器 `handleDrop` 支持多文件**

```typescript
const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
  e.preventDefault();
  setIsDragging(false);
  if (uploading || taskStatus === 'processing') return;
  
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    const fileList = Array.from(e.dataTransfer.files);
    if (fileList.length === 1) {
      onFileSelect(fileList[0]);
    } else if (fileList.length > 1 && onFilesSelect) {
      onFilesSelect(fileList);
    } else {
      onFileSelect(fileList[0]);
    }
  }
};
```

- [ ] **Step 4: 验证 TypeScript 编译无错误**

Run: `npx tsc --noEmit`
Expected: 无错误输出

- [ ] **Step 5: Commit**

```bash
git add src/app/components/MainDashboard/MainDashboard.tsx
git commit -m "feat: MainDashboard supports multi-file input and drag-drop"
```

---

## Task 4: page.tsx 集成 BatchUploadManager

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: 导入 BatchUploadManager**

在 page.tsx 顶部 imports 区域添加：

```typescript
import { BatchUploadManager } from './services/batch/BatchUploadManager';
```

- [ ] **Step 2: 添加 `handleFilesSelect` 批量上传处理函数**

在 `handleFileSelect` 函数之后添加：

```typescript
// Batch multi-file upload with concurrency control
const handleFilesSelect = (files: File[]) => {
  if (taskStatus === 'processing' || uploading) return;

  // Mark UI as in batch upload mode (reuse uploading state)
  setUploading(true);
  setUploadProgress(null); // No single progress for batch

  // Create provisional sidebar entries for each file
  const tempEntries: { tempId: string; file: File }[] = files.map((file) => {
    const tempId = `amk-batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newTask: EraseTask = {
      id: tempId,
      name: file.name,
      status: 'uploading',
      createdAt: Date.now(),
    };
    updateTasks((prev) => [newTask, ...prev]);
    return { tempId, file };
  });

  // Build tempId → file lookup for callbacks
  const tempIdByFile = new Map<File, string>();
  tempEntries.forEach(({ tempId, file }) => tempIdByFile.set(file, tempId));

  const batchManager = new BatchUploadManager(files, {
    maxConcurrency: 2,

    onFileUploaded: (file, url) => {
      const tempId = tempIdByFile.get(file);
      if (!tempId) return;

      // Update sidebar entry: store uploaded URL temporarily
      updateTasks((prev) =>
        prev.map((t) =>
          t.id === tempId ? { ...t, videoUrl: url } : t
        )
      );

      // Delegate to erase submission — this replaces the provisional ID with the real Volcengine taskId
      // We need to set activeTaskIdRef so handleStartErase knows which provisional task to replace
      activeTaskIdRef.current = tempId;
      setActiveTaskId(tempId);
      handleStartErase(url);
    },

    onFileFailed: (file, error) => {
      const tempId = tempIdByFile.get(file);
      if (!tempId) return;

      updateTasks((prev) =>
        prev.map((t) =>
          t.id === tempId ? { ...t, status: 'failed' as const } : t
        )
      );
    },

    onBatchComplete: () => {
      setUploading(false);
    },
  });

  batchManager.start();
};
```

- [ ] **Step 3: 将 `handleFilesSelect` 传递给 MainDashboard**

在 `<MainDashboard>` 组件调用中添加 `onFilesSelect` prop：

```tsx
<MainDashboard
  isPro={isPro}
  onIsProChange={setIsPro}
  videoUrl={videoUrl}
  onVideoUrlChange={handleVideoUrlChange}
  onSubmit={() => handleStartErase()}
  onFileSelect={handleFileSelect}
  onFilesSelect={handleFilesSelect}
  uploadProgress={uploadProgress}
  uploading={uploading}
  taskStatus={taskStatus}
  activeTaskId={activeTaskId}
  errorMessage={errorMessage}
  onReset={handleReset}
  onCancel={handleCancel}
  cleanedVideoUrl={tasks.find((t) => t.id === activeTaskId)?.cleanedVideoUrl}
  taskLogs={taskLogs}
  elapsedSeconds={elapsedSeconds}
/>
```

- [ ] **Step 4: 确保单文件流程向后兼容**

验证现有的 `handleFileSelect`（单文件上传）逻辑未被修改。单文件仍走原有的 `onFileSelect` → `handleFileSelect` → XHR → `handleStartErase` 路径。

- [ ] **Step 5: 验证 TypeScript 编译与全量测试通过**

Run: `npx tsc --noEmit`
Expected: 无错误输出

Run: `npx vitest run`
Expected: 全部测试 PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: integrate BatchUploadManager for multi-file upload with auto erase trigger"
```

---

## Task 5: 端到端集成验证

**Files:** (no new files — verification only)

- [ ] **Step 1: 运行全量测试套件**

Run: `npx vitest run`
Expected: 所有测试 PASS，包括新的 BatchUploadManager 测试

- [ ] **Step 2: 运行 ESLint 检查**

Run: `npx next lint`
Expected: 无错误

- [ ] **Step 3: 运行生产构建**

Run: `npx next build`
Expected: 构建成功无报错

- [ ] **Step 4: 手动功能验证清单**

启动开发服务器 (`npm run dev`) 并逐项验证：

1. **多文件选择**：点击拖放区 → 文件选择器中选择 2+ 视频文件 → 确认侧边栏立即出现多个「上传中」条目
2. **拖放多文件**：从文件管理器拖放 2+ 视频文件到拖放区 → 同上
3. **并发限制**：在浏览器 DevTools Network 面板中确认同时最多 2 个 `/api/upload` 请求
4. **上传成功即触发擦除**：单个文件上传完成后，其侧边栏条目从「上传中」变为「处理中」，无需等待其他文件
5. **单文件失败不阻塞**：模拟一个文件上传失败（如断开网络），确认批次中其他文件继续上传
6. **单文件向后兼容**：选择/拖放恰好 1 个文件 → 走原有单文件上传流程，行为不变

- [ ] **Step 5: Final commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix: resolve integration issues from Slice 1 batch upload"
```
