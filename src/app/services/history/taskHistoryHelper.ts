import { EraseTask } from '../../components/Sidebar/Sidebar';

export function deleteTask(tasks: EraseTask[], taskId: string): EraseTask[] {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return tasks;
  if (task.status === 'uploading' || task.status === 'processing') {
    return tasks;
  }
  return tasks.filter((t) => t.id !== taskId);
}

export function prepareTasksForStorage(tasks: EraseTask[]): EraseTask[] {
  // Strict ID Deduplication: keep the first (most recent) item if duplicate IDs exist
  const seen = new Set<string>();
  const deduped = tasks.filter((task) => {
    if (seen.has(task.id)) {
      return false;
    }
    seen.add(task.id);
    return true;
  });

  // 💡 核心设计：在写入 localStorage 之前，对任务列表中的任务日志进行持久化瘦身
  return deduped.map((task) => {
    // 如果是正在进行中或上传中的任务，不存储其庞大日志，反正刷新后它们需要被重新处理或重置
    if (task.status === 'processing' || task.status === 'uploading') {
      return { ...task, logs: undefined };
    }
    
    // 如果是已进入终态的任务，我们执行日志裁剪归档，仅保留 4-5 条具备核心业务价值的“里程碑归档日志”
    if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
      let archivedLogs: string[] = [];
      
      if (task.status === 'completed') {
        archivedLogs = [
          `[SYSTEM] ✨ 这是一个已完成的历史任务.`,
          `[SYSTEM] 🟢 火山任务 ID: ${task.id}`,
          `[SYSTEM] 🎞️ 原视频地址: ${task.videoUrl}`,
          `[SYSTEM] 🎬 擦除视频地址: ${task.cleanedVideoUrl}`,
          `[SYSTEM] 🚀 双视频左右同步播放器已装载完成。`,
          `[SYSTEM] 🧹 [系统清理] 任务进入终态，系统已物理删除服务器本地视频暂存文件。`
        ];
      } else if (task.status === 'failed') {
        archivedLogs = [
          `[SYSTEM] ❌ 这是一个已失败的历史任务.`,
          `[SYSTEM] 🔴 火山任务 ID: ${task.id}`,
          `[SYSTEM] ⚠️ 任务执行失败。您可以重新发起任务请求。`
        ];
      } else if (task.status === 'cancelled') {
        archivedLogs = [
          `[SYSTEM] ❌ 这是一个已被用户终止的历史任务.`,
          `[SYSTEM] 🔴 火山任务 ID: ${task.id}`,
          `[SYSTEM] ⚠️ 任务已于处理期间由用户主动点击终止。`,
          `[SYSTEM] 🟢 本地服务器将根据生命周期管理自动回收相关暂存资源。`
        ];
      }
      return { ...task, logs: archivedLogs };
    }
    
    return task;
  });
}

/**
 * 决定在队列自动推进时，主仪表盘是否应该以及如何自动切换到下一个任务。
 * 只有在用户目前处于刚刚完成的任务视图下（即 activeTaskId === finishedTaskId）时，
 * 才自动推进到下一个待轮询（最早创建的 processing 状态）的任务。
 * 如果用户已经切换到了其他任务，则不进行自动切换（返回原 activeTaskId）。
 */
export function getNextActiveTaskIdOnQueueAdvance(
  activeTaskId: string,
  finishedTaskId: string,
  tasks: { id: string; status: string; createdAt: number }[]
): string {
  if (activeTaskId !== finishedTaskId) {
    return activeTaskId;
  }

  // 寻找到下一个最早提交的、且 status 依然为 'processing' 的任务
  const nextTask = [...tasks]
    .filter((t) => t.id !== finishedTaskId) // 排除刚刚完成的任务
    .sort((a, b) => a.createdAt - b.createdAt)
    .find((t) => t.status === 'processing');

  return nextTask ? nextTask.id : activeTaskId;
}

