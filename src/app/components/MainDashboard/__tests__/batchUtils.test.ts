import { describe, it, expect } from 'vitest';
import { EraseTask } from '../../Sidebar/Sidebar';
import { getBatchStats } from '../batchUtils';

describe('getBatchStats', () => {
  it('should return null if there is no active task', () => {
    const tasks: EraseTask[] = [];
    const stats = getBatchStats(tasks, 'non-existent');
    expect(stats).toBeNull();
  });

  it('should return null if the active task has no batchId', () => {
    const tasks: EraseTask[] = [
      { id: 'task-1', name: 'a.mp4', status: 'processing', createdAt: Date.now() }
    ];
    const stats = getBatchStats(tasks, 'task-1');
    expect(stats).toBeNull();
  });

  it('should return null if the batch has only 1 task (single-file upload)', () => {
    const tasks: EraseTask[] = [
      { id: 'task-1', name: 'a.mp4', status: 'processing', createdAt: Date.now(), batchId: 'batch-1' }
    ];
    const stats = getBatchStats(tasks, 'task-1');
    expect(stats).toBeNull();
  });

  it('should return null if all tasks in the batch are in terminal states', () => {
    const tasks: EraseTask[] = [
      { id: 'task-1', name: 'a.mp4', status: 'completed', createdAt: Date.now(), batchId: 'batch-1' },
      { id: 'task-2', name: 'b.mp4', status: 'failed', createdAt: Date.now(), batchId: 'batch-1' },
      { id: 'task-3', name: 'c.mp4', status: 'cancelled', createdAt: Date.now(), batchId: 'batch-1' }
    ];
    const stats = getBatchStats(tasks, 'task-1');
    expect(stats).toBeNull();
  });

  it('should return correct stats if at least one task is active (uploading or processing)', () => {
    const tasks: EraseTask[] = [
      { id: 'task-1', name: 'a.mp4', status: 'uploading', createdAt: Date.now(), batchId: 'batch-1' },
      { id: 'task-2', name: 'b.mp4', status: 'processing', createdAt: Date.now(), batchId: 'batch-1' },
      { id: 'task-3', name: 'c.mp4', status: 'completed', createdAt: Date.now(), batchId: 'batch-1' },
      { id: 'task-4', name: 'd.mp4', status: 'failed', createdAt: Date.now(), batchId: 'batch-1' },
      { id: 'task-5', name: 'e.mp4', status: 'cancelled', createdAt: Date.now(), batchId: 'batch-1' },
      // Noise task from another batch
      { id: 'task-other', name: 'other.mp4', status: 'processing', createdAt: Date.now(), batchId: 'batch-other' }
    ];

    const stats = getBatchStats(tasks, 'task-1');
    expect(stats).not.toBeNull();
    expect(stats).toEqual({
      total: 5,
      uploaded: 4, // status: processing, completed, failed, cancelled (all except uploading)
      processing: 1,
      completed: 1,
      failed: 1,
    });
  });
});
