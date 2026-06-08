import { describe, it, expect } from 'vitest';
import { deleteTask, prepareTasksForStorage, getNextActiveTaskIdOnQueueAdvance } from '../taskHistoryHelper';
import { EraseTask } from '../../../components/Sidebar/Sidebar';

describe('deleteTask', () => {
  it('should remove a terminal-state task from the list', () => {
    const tasks: EraseTask[] = [
      { id: 'task-1', name: 'video1.mp4', status: 'completed', createdAt: 1000 },
      { id: 'task-2', name: 'video2.mp4', status: 'processing', createdAt: 2000 },
    ];
    const result = deleteTask(tasks, 'task-1');
    expect(result).toEqual([
      { id: 'task-2', name: 'video2.mp4', status: 'processing', createdAt: 2000 },
    ]);
  });

  it('should NOT remove an uploading task', () => {
    const tasks: EraseTask[] = [
      { id: 'task-1', name: 'video1.mp4', status: 'uploading', createdAt: 1000 },
    ];
    const result = deleteTask(tasks, 'task-1');
    expect(result).toEqual(tasks);
  });

  it('should NOT remove a processing task', () => {
    const tasks: EraseTask[] = [
      { id: 'task-1', name: 'video1.mp4', status: 'processing', createdAt: 1000 },
    ];
    const result = deleteTask(tasks, 'task-1');
    expect(result).toEqual(tasks);
  });

  it('should return the original list if task is not found', () => {
    const tasks: EraseTask[] = [
      { id: 'task-1', name: 'video1.mp4', status: 'completed', createdAt: 1000 },
    ];
    const result = deleteTask(tasks, 'non-existent');
    expect(result).toEqual(tasks);
  });
});

describe('prepareTasksForStorage', () => {
  it('should deduplicate tasks by ID keeping the first (most recent)', () => {
    const tasks: EraseTask[] = [
      { id: 'task-1', name: 'video1.mp4', status: 'completed', createdAt: 1000 },
      { id: 'task-1', name: 'video1-dup.mp4', status: 'completed', createdAt: 2000 },
    ];
    const result = prepareTasksForStorage(tasks);
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('video1.mp4');
  });

  it('should remove logs for uploading or processing tasks', () => {
    const tasks: EraseTask[] = [
      { id: 'task-1', name: 'v1.mp4', status: 'uploading', logs: ['log1', 'log2'], createdAt: 1000 },
      { id: 'task-2', name: 'v2.mp4', status: 'processing', logs: ['log1', 'log2'], createdAt: 2000 },
    ];
    const result = prepareTasksForStorage(tasks);
    expect(result[0].logs).toBeUndefined();
    expect(result[1].logs).toBeUndefined();
  });

  it('should archive logs for completed, failed, and cancelled tasks', () => {
    const tasks: EraseTask[] = [
      { id: 'task-1', name: 'v1.mp4', status: 'completed', videoUrl: 'url1', cleanedVideoUrl: 'url2', logs: ['log1'], createdAt: 1000 },
      { id: 'task-2', name: 'v2.mp4', status: 'failed', logs: ['log1'], createdAt: 2000 },
      { id: 'task-3', name: 'v3.mp4', status: 'cancelled', logs: ['log1'], createdAt: 3000 },
    ];
    const result = prepareTasksForStorage(tasks);

    // Completed task logs check
    expect(result[0].logs).toContain('[SYSTEM] ✨ 这是一个已完成的历史任务.');
    expect(result[0].logs).toContain('[SYSTEM] 🟢 火山任务 ID: task-1');
    expect(result[0].logs).toContain('[SYSTEM] 🎬 擦除视频地址: url2');

    // Failed task logs check
    expect(result[1].logs).toContain('[SYSTEM] ❌ 这是一个已失败的历史任务.');

    // Cancelled task logs check
    expect(result[2].logs).toContain('[SYSTEM] ❌ 这是一个已被用户终止的历史任务.');
  });
});

describe('getNextActiveTaskIdOnQueueAdvance', () => {
  it('should NOT change the active task if the user has already switched to a different task', () => {
    const tasks: EraseTask[] = [
      { id: 'task-1', name: 'v1.mp4', status: 'completed', createdAt: 1000 },
      { id: 'task-2', name: 'v2.mp4', status: 'processing', createdAt: 2000 },
    ];
    // user is currently viewing 'task-2', but 'task-1' has just finished.
    const result = getNextActiveTaskIdOnQueueAdvance('task-2', 'task-1', tasks);
    expect(result).toBe('task-2');
  });

  it('should switch to the next processing task in FIFO order if user was viewing the finished task', () => {
    const tasks: EraseTask[] = [
      { id: 'task-1', name: 'v1.mp4', status: 'completed', createdAt: 1000 },
      { id: 'task-2', name: 'v2.mp4', status: 'processing', createdAt: 2000 },
      { id: 'task-3', name: 'v3.mp4', status: 'processing', createdAt: 3000 },
    ];
    // user was viewing 'task-1', which just completed. Queue should auto-advance to 'task-2' because it has earlier createdAt than 'task-3'.
    const result = getNextActiveTaskIdOnQueueAdvance('task-1', 'task-1', tasks);
    expect(result).toBe('task-2');
  });

  it('should return the original active task if there are no more processing tasks in queue', () => {
    const tasks: EraseTask[] = [
      { id: 'task-1', name: 'v1.mp4', status: 'completed', createdAt: 1000 },
      { id: 'task-2', name: 'v2.mp4', status: 'completed', createdAt: 2000 },
    ];
    // user was viewing 'task-1', which completed. No more tasks are processing.
    const result = getNextActiveTaskIdOnQueueAdvance('task-1', 'task-1', tasks);
    expect(result).toBe('task-1');
  });
});


