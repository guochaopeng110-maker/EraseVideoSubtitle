'use client';

import React, { useState, useEffect, useRef } from 'react';
import Sidebar, { EraseTask } from './components/Sidebar/Sidebar';
import MainDashboard from './components/MainDashboard/MainDashboard';
import { PollingEngine } from './services/polling/PollingEngine';
import { BatchUploadManager } from './services/batch/BatchUploadManager';

const formatError = (err: unknown): string => {
  if (!err) return '';
  if (typeof err === 'string') return err;
  if (typeof err === 'object' && err !== null) {
    const errorObj = err as Record<string, unknown>;
    return String(errorObj.message || errorObj.code || JSON.stringify(err));
  }
  return String(err);
};

export default function Home() {
  const [isPro, setIsPro] = useState<boolean>(true);
  const [apiKey, setApiKey] = useState<string>('');
  const [videoUrl, setVideoUrl] = useState<string>('');
  
  // Upload and Erase Task State Management
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const [taskStatus, setTaskStatus] = useState<'idle' | 'uploading' | 'processing' | 'completed' | 'failed' | 'cancelled'>('idle');
  const [activeTaskId, setActiveTaskId] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Create a ref to store the latest activeTaskId to resolve stale closure issues in upload callback
  const activeTaskIdRef = useRef<string>('');
  useEffect(() => {
    activeTaskIdRef.current = activeTaskId;
  }, [activeTaskId]);

  // Real-time Logging & Stopwatch States
  const [taskLogs, setTaskLogs] = useState<string[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Local Task History management
  const [tasks, setTasks] = useState<EraseTask[]>([]);

  // Helper: Append a new formatted, timestamped log entry
  const addLog = (message: string) => {
    const timeStr = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    setTaskLogs((prev) => [...prev, `[${timeStr}] ${message}`]);
  };

  // Load history & API Key from localStorage on page mount safely
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedApiKey = localStorage.getItem('amk-volcengine-api-key');
      if (savedApiKey) {
        setApiKey(savedApiKey);
      }
    }

    const savedTasks = localStorage.getItem('amk-erase-tasks-history');
    if (savedTasks) {
      try {
        const parsed = JSON.parse(savedTasks);
        if (Array.isArray(parsed)) {
          const seen = new Set<string>();
          const deduped = parsed.filter((task) => {
            if (!task.id || seen.has(task.id)) {
              return false;
            }
            seen.add(task.id);
            return true;
          });
          setTasks(deduped);
        }
      } catch (e) {
        console.error('Failed to load tasks history:', e);
      }
    }
  }, []);

  /**
   * Thread-safe functional state updater with ID deduplication that persist to localStorage
   */
  const updateTasks = (newTasksOrUpdater: EraseTask[] | ((prev: EraseTask[]) => EraseTask[])) => {
    setTasks((prev) => {
      const next = typeof newTasksOrUpdater === 'function' ? newTasksOrUpdater(prev) : newTasksOrUpdater;
      
      // Strict ID Deduplication: keep the first (most recent) item if duplicate IDs exist
      const seen = new Set<string>();
      const deduped = next.filter((task) => {
        if (seen.has(task.id)) {
          return false;
        }
        seen.add(task.id);
        return true;
      });

      // 💡 核心设计：在写入 localStorage 之前，对任务列表中的任务日志进行持久化瘦身
      const tasksToSave = deduped.map((task) => {
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

      localStorage.setItem('amk-erase-tasks-history', JSON.stringify(tasksToSave));
      return deduped;
    });
  };

  // 同步引用 tasks 状态以防异步定时器因闭包机制拿到旧值
  const tasksRef = useRef<EraseTask[]>(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // 后台排队轮询相关的全局调度 refs
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentPollingTaskIdRef = useRef<string | null>(null);
  const taskPollStatsRef = useRef<Record<string, { pollCount: number; startTime: number; elapsedSeconds: number }>>({});

  // 为特定任务追加日志，如果该任务是当前正激活的任务，同步更新前台实时显示的 logs 状态
  const addLogForTask = (taskId: string, message: string) => {
    const timeStr = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    const logEntry = `[${timeStr}] ${message}`;

    // 1. 如果该任务是当前激活的任务，更新前台展示
    if (activeTaskIdRef.current === taskId) {
      setTaskLogs((prev) => [...prev, logEntry]);
    }

    // 2. 更新内存中 tasks 对象的专属日志数组
    setTasks((prevTasks) =>
      prevTasks.map((t) =>
        t.id === taskId
          ? { ...t, logs: [...(t.logs || []), logEntry] }
          : t
      )
    );
  };

  // 后台单任务串行轮询调度函数 (FIFO 排队管理器)
  const scheduleNextPoll = () => {
    // 1. 检查是否有任务正在被轮询，如果是，为保证 QPS 频控，不发起并发线程
    if (currentPollingTaskIdRef.current) {
      return;
    }

    // 2. 从当前最新的任务列表里，寻找最早提交（按 createdAt 升序）且状态为 'processing' 的任务
    const nextTask = [...tasksRef.current]
      .sort((a, b) => a.createdAt - b.createdAt)
      .find((t) => t.status === 'processing');

    if (!nextTask) {
      return;
    }

    const taskId = nextTask.id;
    currentPollingTaskIdRef.current = taskId;
    console.log(`[Queue Manager] 后台队列已激活并独占轮询通道，目标 TaskID: ${taskId}`);

    // 3. 初始化或恢复该任务 of 轮询状态统计
    if (!taskPollStatsRef.current[taskId]) {
      taskPollStatsRef.current[taskId] = {
        pollCount: nextTask.pollCount || 0,
        startTime: Date.now() - (nextTask.elapsedSeconds || 0) * 1000, // 逆向恢复相对开始时间
        elapsedSeconds: nextTask.elapsedSeconds || 0,
      };
    }

    const stats = taskPollStatsRef.current[taskId];

    // 4. 计时累加器：为当前被轮询的任务每秒递增耗时
    let stopwatchTimer: NodeJS.Timeout | null = null;
    if (activeTaskIdRef.current === taskId) {
      setElapsedSeconds(stats.elapsedSeconds);
    }
    
    stopwatchTimer = setInterval(() => {
      stats.elapsedSeconds += 1;
      
      // 如果当前正处于该任务视图，同步更新前台秒数
      if (activeTaskIdRef.current === taskId) {
        setElapsedSeconds(stats.elapsedSeconds);
      }
      
      // 保持 tasks 数据集内的耗时同步，方便在切出时保留数据
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, elapsedSeconds: stats.elapsedSeconds } : t
        )
      );
    }, 1000);

    // 5. 递归自适应退避轮询请求体
    const runPoll = async () => {
      // 安全保障：验证当前任务在轮询期间是否依然处于队列活跃头部（可能被手动终止置 null）
      if (currentPollingTaskIdRef.current !== taskId) {
        if (stopwatchTimer) clearInterval(stopwatchTimer);
        return;
      }

      stats.pollCount += 1;
      
      // 同步专属计数到 tasks
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, pollCount: stats.pollCount } : t
        )
      );

      addLogForTask(taskId, `🔍 第 ${stats.pollCount} 次轮询火山引擎，正在拉取最新处理进度...`);

      // 6. 队列死锁熔断熔丝：判断任务是否已经超过 8 分钟（480 秒）硬时限
      if (stats.elapsedSeconds >= 480) {
        if (stopwatchTimer) clearInterval(stopwatchTimer);
        addLogForTask(taskId, `❌ 错误：字幕擦除任务执行已超过 8 分钟（480秒）硬超时限制。`);
        addLogForTask(taskId, `⚠️ 队列防死锁保护已自动熔断，本任务将被强制标记为失败。正在释放通道调度下一位...`);

        updateTasks((prevTasks) =>
          prevTasks.map((t) => (t.id === taskId ? { ...t, status: 'failed' as const } : t))
        );

        if (activeTaskIdRef.current === taskId) {
          setTaskStatus('failed');
          setErrorMessage('任务处理超时，火山引擎任务可能异常。队列安全调度器已自动熔断。');
        }

        // 释放独占，递归自我驱动唤醒队列下一位
        currentPollingTaskIdRef.current = null;
        scheduleNextPoll();
        return;
      }

      try {
        const res = await fetch(`/api/tasks/${taskId}?videoUrl=${encodeURIComponent(nextTask.videoUrl || '')}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            if (data.status === 'completed') {
              if (stopwatchTimer) clearInterval(stopwatchTimer);
              addLogForTask(taskId, '🟢 火山引擎分析与渲染成功！');
              addLogForTask(taskId, '✨ 硬字幕已被无损还原，高保真 MP4 视频导出就绪！');
              addLogForTask(taskId, '🧹 [系统清理] 任务进入终态，系统已物理删除服务器本地视频暂存文件。');

              updateTasks((prevTasks) =>
                prevTasks.map((t) =>
                  t.id === taskId
                    ? { ...t, status: 'completed' as const, cleanedVideoUrl: data.result?.video_url }
                    : t
                )
              );

              if (activeTaskIdRef.current === taskId) {
                setTaskStatus('completed');
              }

              // 释放独占，唤醒下一个排队任务
              currentPollingTaskIdRef.current = null;
              scheduleNextPoll();
              return;
            } else if (data.status === 'failed') {
              if (stopwatchTimer) clearInterval(stopwatchTimer);
              const errText = data.error?.message || '未知异常';
              addLogForTask(taskId, `❌ 火山引擎端任务执行失败，反馈详情: ${errText}`);

              updateTasks((prevTasks) =>
                prevTasks.map((t) =>
                  t.id === taskId ? { ...t, status: 'failed' as const } : t
                )
              );

              if (activeTaskIdRef.current === taskId) {
                setTaskStatus('failed');
                setErrorMessage(errText);
              }

              // 释放独占，唤醒下一个排队任务
              currentPollingTaskIdRef.current = null;
              scheduleNextPoll();
              return;
            } else {
              // 仍处于处理中
              addLogForTask(taskId, '⏳ 火山引擎处理状态: [processing] (分析字幕特征并执行多帧联合像素级空间修复中...)');
              
              const elapsedMs = Date.now() - stats.startTime;
              const nextInterval = PollingEngine.getNextInterval(elapsedMs);
              pollingTimerRef.current = setTimeout(runPoll, nextInterval);
            }
          } else {
            if (stopwatchTimer) clearInterval(stopwatchTimer);
            const errText = formatError(data.error) || '未知错误';
            addLogForTask(taskId, `❌ 状态查询异常: ${errText}`);

            updateTasks((prevTasks) =>
              prevTasks.map((t) =>
                t.id === taskId ? { ...t, status: 'failed' as const } : t
              )
            );

            if (activeTaskIdRef.current === taskId) {
              setTaskStatus('failed');
              setErrorMessage(errText);
            }

            currentPollingTaskIdRef.current = null;
            scheduleNextPoll();
            return;
          }
        } else {
          if (stopwatchTimer) clearInterval(stopwatchTimer);
          const data = await res.json().catch(() => ({}));
          const errText = data.error || `HTTP 异常 (${res.status})`;
          addLogForTask(taskId, `❌ 接口响应异常: ${errText}`);

          updateTasks((prevTasks) =>
            prevTasks.map((t) =>
              t.id === taskId ? { ...t, status: 'failed' as const } : t
            )
          );

          if (activeTaskIdRef.current === taskId) {
            setTaskStatus('failed');
            setErrorMessage(errText);
          }

          currentPollingTaskIdRef.current = null;
          scheduleNextPoll();
          return;
        }
      } catch (err) {
        // 网络通信抖动容错：输出警告但不要终止任务，保留并在下一个退避周期中进行自动重试
        addLogForTask(taskId, `⚠️ 网络通信出现短暂抖动: ${err instanceof Error ? err.message : '网络异常'}。将在下一轮自动恢复重试查询...`);
        const elapsedMs = Date.now() - stats.startTime;
        const nextInterval = PollingEngine.getNextInterval(elapsedMs);
        pollingTimerRef.current = setTimeout(runPoll, nextInterval);
      }
    };

    // 触发第一轮自适应间隔延时查询
    const elapsedMs = Date.now() - stats.startTime;
    const initialInterval = PollingEngine.getNextInterval(elapsedMs);
    pollingTimerRef.current = setTimeout(runPoll, initialInterval);
  };

  // 监听任务队列的变化，一旦发生状态转移，自发唤醒队列调度机制
  useEffect(() => {
    scheduleNextPoll();
  }, [tasks]);

  const handleApiKeyChange = (key: string) => {
    setApiKey(key);
    if (typeof window !== 'undefined') {
      localStorage.setItem('amk-volcengine-api-key', key);
    }
  };

  const handleVideoUrlChange = (url: string) => {
    setVideoUrl(url);
  };

  // Submit Erase Task to /api/tasks Proxy
  const handleStartErase = async (urlToUse?: string, provisionalTaskId?: string) => {
    const targetUrl = urlToUse || videoUrl;
    if (!targetUrl) {
      alert('请先上传视频文件或粘贴公网视频 URL。');
      return;
    }

    if (!apiKey) {
      alert('请在侧边栏配置您的火山引擎 API Key 以供认证。');
      return;
    }

    const currentActiveTaskId = provisionalTaskId || activeTaskIdRef.current;
    const isCurrentView = !provisionalTaskId || activeTaskIdRef.current === provisionalTaskId;

    if (isCurrentView) {
      setTaskStatus('processing');
      setErrorMessage('');
      setTaskLogs([]);
      setElapsedSeconds(0);
    }

    const logMsg = (msg: string) => {
      if (currentActiveTaskId) {
        addLogForTask(currentActiveTaskId, msg);
      } else {
        addLog(msg);
      }
    };

    logMsg(`🚀 正在发起向火山引擎的字幕擦除处理请求...`);
    logMsg(`⚙️ 版本选择: [${isPro ? '精细化 Pro 版' : '标准 Standard 版'}]`);
    logMsg(`📦 视频地址: ${targetUrl.substring(0, 50)}${targetUrl.length > 50 ? '...' : ''}`);

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoUrl: targetUrl,
          apiKey: apiKey,
          isPro,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        // Handle integration with provisional upload tasks
        updateTasks((prevTasks) => {
          const taskExists = prevTasks.some((t) => t.id === currentActiveTaskId);
          if (taskExists && currentActiveTaskId) {
            // Replace provisional upload task details with real Volcengine taskId
            return prevTasks.map((t) =>
              t.id === currentActiveTaskId
                ? { ...t, id: data.taskId, status: 'processing' as const, videoUrl: targetUrl }
                : t
            );
          } else {
            // Direct URL submission task creation
            const rawName = targetUrl.substring(targetUrl.lastIndexOf('/') + 1) || `video_${Date.now()}`;
            const cleanName = rawName.split('?')[0] || `video_${Date.now()}`;
            const newTask: EraseTask = {
              id: data.taskId,
              name: cleanName,
              status: 'processing',
              videoUrl: targetUrl,
              createdAt: Date.now(),
            };
            return [newTask, ...prevTasks];
          }
        });

        const timeStr = new Date().toLocaleTimeString('zh-CN', { hour12: false });
        const successLog1 = `[${timeStr}] 🔑 任务提交成功！火山引擎分配 TaskID: ${data.taskId}`;
        const successLog2 = `[${timeStr}] 🔍 开始轮询查询处理进度 (采用自适应指数退避延时算法)...`;
        
        setTasks((prevTasks) =>
          prevTasks.map((t) =>
            t.id === data.taskId
              ? { ...t, logs: [...(t.logs || []), successLog1, successLog2] }
              : t
          )
        );

        if (isCurrentView) {
          setTaskLogs((prev) => [...prev, successLog1, successLog2]);
          setActiveTaskId(data.taskId);
        }
      } else {
        const errorMsg = formatError(data.error) || '火山引擎字幕擦除服务提交失败。';
        logMsg(`❌ 任务提交被拒绝: ${errorMsg}`);
        
        if (isCurrentView) {
          setTaskStatus('failed');
          setErrorMessage(errorMsg);
        }
        if (currentActiveTaskId) {
          updateTasks((prevTasks) =>
            prevTasks.map((t) => (t.id === currentActiveTaskId ? { ...t, status: 'failed' as const } : t))
          );
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '与火山引擎代理网关通信失败';
      logMsg(`❌ 严重网络异常: ${errorMsg}`);
      
      if (isCurrentView) {
        setTaskStatus('failed');
        setErrorMessage(errorMsg);
      }
      if (currentActiveTaskId) {
        updateTasks((prevTasks) =>
          prevTasks.map((t) => (t.id === currentActiveTaskId ? { ...t, status: 'failed' as const } : t))
        );
      }
    }
  };

  // Process drag & drop and local file inputs
  const handleFileSelect = (file: File) => {
    if (taskStatus === 'processing' || uploading) return;

    // Production - Trigger real multipart API upload with progress tracking
    setUploading(true);
    setUploadProgress(0);
    setTaskStatus('uploading');

    const tempTaskId = `amk-uploading-task-${Date.now()}`;
    const newTask: EraseTask = {
      id: tempTaskId,
      name: file.name,
      status: 'uploading',
      createdAt: Date.now(),
    };

    updateTasks((prev) => [newTask, ...prev]);
    setActiveTaskId(tempTaskId);

    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload', true);

    // Listen to native browser upload progress
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percent);
      }
    };

    xhr.onload = () => {
      setUploading(false);
      setUploadProgress(null);

      if (xhr.status === 200) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.success) {
            setVideoUrl(res.url);
            
            // Auto start subtitle erase task submission after upload completes
            handleStartErase(res.url);
          } else {
            setTaskStatus('failed');
            setErrorMessage(formatError(res.error) || '上传文件暂存失败。');
            updateTasks((prevTasks) =>
              prevTasks.map((t) => (t.id === tempTaskId ? { ...t, status: 'failed' as const } : t))
            );
          }
        } catch {
          setTaskStatus('failed');
          setErrorMessage('解析服务器上传响应数据失败。');
          updateTasks((prevTasks) =>
            prevTasks.map((t) => (t.id === tempTaskId ? { ...t, status: 'failed' as const } : t))
          );
        }
      } else {
        setTaskStatus('failed');
        setErrorMessage(`视频上传失败，服务器状态码: ${xhr.status}`);
        updateTasks((prevTasks) =>
          prevTasks.map((t) => (t.id === tempTaskId ? { ...t, status: 'failed' as const } : t))
        );
      }
    };

    xhr.onerror = () => {
      setUploading(false);
      setUploadProgress(null);
      setTaskStatus('failed');
      setErrorMessage('网络异常，上传视频失败。');
      updateTasks((prevTasks) =>
        prevTasks.map((t) => (t.id === tempTaskId ? { ...t, status: 'failed' as const } : t))
      );
    };

    xhr.send(formData);
  };

  // Process multiple drag & drop and local files batch uploads
  const handleFilesSelect = (files: File[]) => {
    if (taskStatus === 'processing' || uploading) return;

    if (!apiKey) {
      alert('请在侧边栏配置您的火山引擎 API Key 以供认证。');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setTaskStatus('uploading');

    // 1. Prepare tasks and store their temporary IDs
    const batchId = `batch-${Date.now()}`;
    const fileEntries: { file: File; tempId: string }[] = files.map((file, idx) => {
      const tempId = `amk-batch-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 8)}`;
      return { file, tempId };
    });

    const newTasks: EraseTask[] = fileEntries.map((entry) => ({
      id: entry.tempId,
      name: entry.file.name,
      status: 'uploading',
      createdAt: Date.now(),
      batchId,
      logs: [`[SYSTEM] 📂 [批处理] 文件加入上传队列，等待分配上传通道...`],
    }));

    // Insert tasks into sidebar task list
    updateTasks((prev) => [...newTasks, ...prev]);

    // Active the first task in UI
    const firstTempId = fileEntries[0].tempId;
    setActiveTaskId(firstTempId);

    // Map files to tempIds for tracking callbacks
    const tempIdMap = new Map<File, string>();
    fileEntries.forEach((entry) => {
      tempIdMap.set(entry.file, entry.tempId);
    });

    // 2. Instantiate BatchUploadManager
    const manager = new BatchUploadManager(files, {
      maxConcurrency: 2,
      onStateChange: (entries) => {
        // Synchronously reflect upload progress changes in UI state
        // For the currently viewed task, update uploadProgress
        const currentActiveId = activeTaskIdRef.current;
        const currentEntry = entries.find((e) => tempIdMap.get(e.file) === currentActiveId);
        if (currentEntry) {
          if (currentEntry.status === 'uploading') {
            setUploadProgress(currentEntry.progress);
            setTaskStatus('uploading');
          } else if (currentEntry.status === 'uploaded') {
            setUploadProgress(null);
          } else if (currentEntry.status === 'failed') {
            setUploadProgress(null);
            setTaskStatus('failed');
            setErrorMessage(currentEntry.error || '上传失败');
          }
        }
      },
      onFileUploaded: (file, url) => {
        const tempId = tempIdMap.get(file);
        if (!tempId) return;

        // Add logs to this specific task
        addLogForTask(tempId, `🟢 文件上传暂存成功！开始发起擦除请求...`);

        // Trigger Volcengine client subtitle erasing API
        handleStartErase(url, tempId);
      },
      onFileFailed: (file, error) => {
        const tempId = tempIdMap.get(file);
        if (!tempId) return;

        addLogForTask(tempId, `❌ 文件上传失败: ${error}`);

        updateTasks((prevTasks) =>
          prevTasks.map((t) => (t.id === tempId ? { ...t, status: 'failed' as const } : t))
        );

        // If this is current view, show error state in UI
        if (activeTaskIdRef.current === tempId) {
          setTaskStatus('failed');
          setErrorMessage(error);
          setUploadProgress(null);
        }
      },
      onBatchComplete: () => {
        setUploading(false);
        setUploadProgress(null);
        // If the current active task is still showing uploading, transition to processing/idle
        const currentActiveId = activeTaskIdRef.current;
        const currentTask = tasksRef.current.find((t) => t.id === currentActiveId);
        if (currentTask && currentTask.status === 'uploading') {
          setTaskStatus('idle');
        }
      },
    });

    manager.start();
  };

  const handleTaskSelect = (task: EraseTask) => {
    setActiveTaskId(task.id);
    setTaskStatus(task.status);
    setVideoUrl(task.videoUrl || '');
    setErrorMessage('');
    
    // 💡 核心设计：加载该任务专属的日志列表，保证在后台静默产生的新日志能完美展现
    setTaskLogs(task.logs || []);

    // 💡 核心设计：如果切换回了正在处理的任务，恢复其真实的已耗时秒数
    if (task.status === 'processing') {
      const stats = taskPollStatsRef.current[task.id];
      if (stats) {
        setElapsedSeconds(stats.elapsedSeconds);
      } else {
        setElapsedSeconds(task.elapsedSeconds || 0);
      }
    } else {
      setElapsedSeconds(task.elapsedSeconds || 0);
    }
  };

  const handleReset = () => {
    setTaskStatus('idle');
    setVideoUrl('');
    setActiveTaskId('');
    setErrorMessage('');
    setTaskLogs([]);
    setElapsedSeconds(0);
  };

  const handleCancel = () => {
    if (!activeTaskId) return;

    const currentActiveId = activeTaskId;
    
    // 1. 终止解套：如果被终止的任务正是当前后台占道轮询的任务，强行切断当前查询定时器并释放锁
    if (currentPollingTaskIdRef.current === currentActiveId) {
      if (pollingTimerRef.current) {
        clearTimeout(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
      currentPollingTaskIdRef.current = null;
      console.log(`[Queue Manager] 用户手动终止了正在活跃轮询的任务: ${currentActiveId}。已强行掐断并释放锁。`);
    }

    // 2. 将其状态置为 cancelled
    updateTasks((prevTasks) =>
      prevTasks.map((t) =>
        t.id === currentActiveId ? { ...t, status: 'cancelled' as const } : t
      )
    );

    // 3. 重置前台页面到 idle
    handleReset();

    // 4. 瞬时释放队列流转：异步触发一次排队调度，去轮询队列中的下一位！
    setTimeout(() => {
      scheduleNextPoll();
    }, 50);
  };

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* Left Sidebar */}
      <Sidebar
        apiKey={apiKey}
        onApiKeyChange={handleApiKeyChange}
        tasks={tasks}
        activeTaskId={activeTaskId}
        onTaskSelect={handleTaskSelect}
      />

      {/* Right Workstation Dashboard */}
      <MainDashboard
        tasks={tasks}
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
    </div>
  );
}
