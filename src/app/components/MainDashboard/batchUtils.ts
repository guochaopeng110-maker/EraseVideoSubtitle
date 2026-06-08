import { EraseTask } from '../Sidebar/Sidebar';

export interface BatchStats {
  total: number;
  uploaded: number;
  processing: number;
  completed: number;
  failed: number;
}

export function getBatchStats(
  tasks: EraseTask[],
  activeTaskId: string
): BatchStats | null {
  if (!activeTaskId || !tasks || tasks.length === 0) {
    return null;
  }

  const activeTask = tasks.find((t) => t.id === activeTaskId);
  if (!activeTask || !activeTask.batchId) {
    return null;
  }

  const batchId = activeTask.batchId;
  const batchTasks = tasks.filter((t) => t.batchId === batchId);

  // The bar should be conditionally rendered — it only appears when there is an active batch 
  // (multiple tasks created within the same batch session).
  if (batchTasks.length <= 1) {
    return null;
  }

  // It auto-hides when all tasks in the batch reach terminal states (completed, failed, cancelled).
  const hasActiveTask = batchTasks.some(
    (t) => t.status === 'uploading' || t.status === 'processing'
  );
  if (!hasActiveTask) {
    return null;
  }

  const total = batchTasks.length;
  const uploaded = batchTasks.filter((t) => t.status !== 'uploading').length;
  const processing = batchTasks.filter((t) => t.status === 'processing').length;
  const completed = batchTasks.filter((t) => t.status === 'completed').length;
  const failed = batchTasks.filter((t) => t.status === 'failed').length;

  return {
    total,
    uploaded,
    processing,
    completed,
    failed,
  };
}
