'use client';

import React, { useState, useEffect } from 'react';
import Sidebar, { EraseTask } from './components/Sidebar/Sidebar';
import MainDashboard from './components/MainDashboard/MainDashboard';
import { PollingEngine } from './services/polling/PollingEngine';

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
  const [mockMode, setMockMode] = useState<boolean>(true);
  const [apiKey, setApiKey] = useState<string>('');
  const [videoUrl, setVideoUrl] = useState<string>('');
  
  // Upload and Erase Task State Management
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const [taskStatus, setTaskStatus] = useState<'idle' | 'uploading' | 'processing' | 'completed' | 'failed'>('idle');
  const [activeTaskId, setActiveTaskId] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Local Task History management
  const [tasks, setTasks] = useState<EraseTask[]>([]);

  // Load history from localStorage on page mount
  useEffect(() => {
    const savedTasks = localStorage.getItem('amk-erase-tasks-history');
    if (savedTasks) {
      try {
        setTasks(JSON.parse(savedTasks));
      } catch (e) {
        console.error('Failed to load tasks history:', e);
      }
    }
  }, []);

  /**
   * Thread-safe functional state updater that persist to localStorage
   */
  const updateTasks = (newTasksOrUpdater: EraseTask[] | ((prev: EraseTask[]) => EraseTask[])) => {
    setTasks((prev) => {
      const next = typeof newTasksOrUpdater === 'function' ? newTasksOrUpdater(prev) : newTasksOrUpdater;
      localStorage.setItem('amk-erase-tasks-history', JSON.stringify(next));
      return next;
    });
  };

  // Adaptive Backoff Polling Mechanism
  useEffect(() => {
    if (taskStatus !== 'processing' || !activeTaskId) return;

    let timerId: NodeJS.Timeout;
    const startTime = Date.now();

    const poll = async () => {
      try {
        const res = await fetch(`/api/tasks/${activeTaskId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(mockMode ? {} : { 'Authorization': `Bearer ${apiKey}` }),
          },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            if (data.status === 'completed') {
              setTaskStatus('completed');
              // Update task history status
              updateTasks((prevTasks) =>
                prevTasks.map((t) =>
                  t.id === activeTaskId
                    ? { ...t, status: 'completed' as const, cleanedVideoUrl: data.result?.video_url }
                    : t
                )
              );
              return; // End polling
            } else if (data.status === 'failed') {
              setTaskStatus('failed');
              setErrorMessage(data.error?.message || '火山引擎字幕擦除任务处理失败。');
              updateTasks((prevTasks) =>
                prevTasks.map((t) =>
                  t.id === activeTaskId ? { ...t, status: 'failed' as const } : t
                )
              );
              return; // End polling
            } else {
              // Still processing - calculate next interval based on elapsed time
              const elapsed = Date.now() - startTime;
              const nextInterval = PollingEngine.getNextInterval(elapsed);
              timerId = setTimeout(poll, nextInterval);
            }
          } else {
            setTaskStatus('failed');
            setErrorMessage(formatError(data.error) || '火山引擎状态查询返回了错误指令。');
            updateTasks((prevTasks) =>
              prevTasks.map((t) =>
                t.id === activeTaskId ? { ...t, status: 'failed' as const } : t
              )
            );
          }
        } else {
          setTaskStatus('failed');
          setErrorMessage(`获取状态接口异常，HTTP 状态码: ${res.status}`);
          updateTasks((prevTasks) =>
            prevTasks.map((t) =>
              t.id === activeTaskId ? { ...t, status: 'failed' as const } : t
            )
          );
        }
      } catch (err) {
        setTaskStatus('failed');
        setErrorMessage(err instanceof Error ? err.message : '状态轮询发生网络异常');
        updateTasks((prevTasks) =>
          prevTasks.map((t) =>
            t.id === activeTaskId ? { ...t, status: 'failed' as const } : t
          )
        );
      }
    };

    // Calculate initial delay
    const elapsed = Date.now() - startTime;
    const initialInterval = PollingEngine.getNextInterval(elapsed);
    timerId = setTimeout(poll, initialInterval);

    return () => {
      clearTimeout(timerId);
    };
  }, [taskStatus, activeTaskId, mockMode, apiKey]);

  const handleMockModeToggle = () => {
    if (taskStatus === 'processing' || uploading) return;
    setMockMode(!mockMode);
    handleReset();
  };

  const handleApiKeyChange = (key: string) => {
    setApiKey(key);
  };

  const handleVideoUrlChange = (url: string) => {
    setVideoUrl(url);
  };

  // Submit Erase Task to /api/tasks Proxy
  const handleStartErase = async (urlToUse?: string) => {
    const targetUrl = urlToUse || videoUrl;
    if (!targetUrl) {
      alert('请先上传视频文件或粘贴公网视频 URL。');
      return;
    }

    if (!mockMode && !apiKey) {
      alert('请先在侧边栏配置火山引擎 API Key，或者开启 Mock 模式。');
      return;
    }

    setTaskStatus('processing');
    setErrorMessage('');

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoUrl: targetUrl,
          mockMode,
          apiKey: mockMode ? '' : apiKey,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        // Handle integration with provisional upload tasks
        updateTasks((prevTasks) => {
          const taskExists = prevTasks.some((t) => t.id === activeTaskId);
          if (taskExists && activeTaskId) {
            // Replace provisional upload task details with real Volcengine taskId
            return prevTasks.map((t) =>
              t.id === activeTaskId
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

        // Set state to start polling on this final taskId
        setActiveTaskId(data.taskId);
      } else {
        setTaskStatus('failed');
        setErrorMessage(formatError(data.error) || '火山引擎字幕擦除服务提交失败。');
        if (activeTaskId) {
          updateTasks((prevTasks) =>
            prevTasks.map((t) => (t.id === activeTaskId ? { ...t, status: 'failed' as const } : t))
          );
        }
      }
    } catch (err) {
      setTaskStatus('failed');
      setErrorMessage(err instanceof Error ? err.message : '与火山引擎代理网关通信失败');
      if (activeTaskId) {
        updateTasks((prevTasks) =>
          prevTasks.map((t) => (t.id === activeTaskId ? { ...t, status: 'failed' as const } : t))
        );
      }
    }
  };

  // Process drag & drop and local file inputs
  const handleFileSelect = (file: File) => {
    if (taskStatus === 'processing' || uploading) return;

    if (mockMode) {
      // Prototyping - Simulate smooth visual upload progress
      setUploading(true);
      setUploadProgress(0);
      setTaskStatus('uploading');
      
      const tempTaskId = `amk-mock-erase-task-${Date.now()}`;
      const newTask: EraseTask = {
        id: tempTaskId,
        name: file.name,
        status: 'uploading',
        createdAt: Date.now(),
      };
      
      updateTasks((prev) => [newTask, ...prev]);
      setActiveTaskId(tempTaskId);
      
      let currentProgress = 0;
      const interval = setInterval(() => {
        currentProgress += 10;
        setUploadProgress(currentProgress);
        
        if (currentProgress >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setUploading(false);
            setUploadProgress(null);
            
            const dummyUrl = `http://localhost:3000/uploads/${file.name}`;
            setVideoUrl(dummyUrl);
            
            // Auto start subtitle erase task submission after upload completes
            handleStartErase(dummyUrl);
          }, 300);
        }
      }, 100);
    } else {
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
    }
  };

  const handleTaskSelect = (task: EraseTask) => {
    setActiveTaskId(task.id);
    setTaskStatus(task.status);
    setVideoUrl(task.videoUrl || '');
    setErrorMessage('');
  };

  const handleReset = () => {
    setTaskStatus('idle');
    setVideoUrl('');
    setActiveTaskId('');
    setErrorMessage('');
  };

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* Left Sidebar */}
      <Sidebar
        mockMode={mockMode}
        apiKey={apiKey}
        onApiKeyChange={handleApiKeyChange}
        tasks={tasks}
        activeTaskId={activeTaskId}
        onTaskSelect={handleTaskSelect}
      />

      {/* Right Workstation Dashboard */}
      <MainDashboard
        mockMode={mockMode}
        onMockModeToggle={handleMockModeToggle}
        videoUrl={videoUrl}
        onVideoUrlChange={handleVideoUrlChange}
        onSubmit={() => handleStartErase()}
        onFileSelect={handleFileSelect}
        uploadProgress={uploadProgress}
        uploading={uploading}
        taskStatus={taskStatus}
        activeTaskId={activeTaskId}
        errorMessage={errorMessage}
        onReset={handleReset}
        cleanedVideoUrl={tasks.find((t) => t.id === activeTaskId)?.cleanedVideoUrl}
      />
    </div>
  );
}
