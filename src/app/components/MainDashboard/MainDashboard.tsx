'use client';

import React, { useRef, useState, useEffect } from 'react';
import styles from './MainDashboard.module.css';

interface MainDashboardProps {
  mockMode: boolean;
  onMockModeToggle: () => void;
  videoUrl: string;
  onVideoUrlChange: (url: string) => void;
  onSubmit: () => void;
  onFileSelect: (file: File) => void;
  uploadProgress: number | null;
  uploading: boolean;
  
  taskStatus: 'idle' | 'uploading' | 'processing' | 'completed' | 'failed';
  activeTaskId: string;
  errorMessage: string;
  onReset: () => void;
  cleanedVideoUrl?: string; // High fidelity AI subtitle erase product url
}

const pipelineSteps = [
  {
    name: '参数规格检查',
    desc: '验证视频 URL 可访问性、分辨率限制及火山引擎服务认证参数',
    icon: '🔍',
  },
  {
    name: '字幕特征帧提取',
    desc: 'AI 智能检测硬字幕区域，分割并追踪文本对应的时间序列帧',
    icon: '🎞️',
  },
  {
    name: 'AI 空间修复',
    desc: '深度像素级多帧联合修复技术，融和并生成与原始背景无缝贴合的画面',
    icon: '🎛️',
  },
  {
    name: '任务渲染导出',
    desc: '重新生成去除硬字幕的 Cleaned Video，导出 1080P 高清 MP4 文件',
    icon: '✨',
  },
];

export default function MainDashboard({
  mockMode,
  onMockModeToggle,
  videoUrl,
  onVideoUrlChange,
  onSubmit,
  onFileSelect,
  uploadProgress,
  uploading,
  taskStatus,
  activeTaskId,
  errorMessage,
  onReset,
  cleanedVideoUrl,
}: MainDashboardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  
  // Dual Player Refs & Synchronization Controls
  const sourceVideoRef = useRef<HTMLVideoElement>(null);
  const cleanedVideoRef = useRef<HTMLVideoElement>(null);
  const syncLockRef = useRef<boolean>(false);

  // Simulated step index for Mock Mode progression
  const [simulatedStepIndex, setSimulatedStepIndex] = useState<number>(0);

  // Set up mock mode dynamic progression timers
  useEffect(() => {
    if (taskStatus === 'processing' && mockMode) {
      setSimulatedStepIndex(0);
      
      const t1 = setTimeout(() => setSimulatedStepIndex(1), 2500);  // Step 2 active
      const t2 = setTimeout(() => setSimulatedStepIndex(2), 6000);  // Step 3 active
      const t3 = setTimeout(() => setSimulatedStepIndex(3), 10000); // Step 4 active
      const t4 = setTimeout(() => setSimulatedStepIndex(4), 14000); // Simulated Completed!

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
      };
    }
  }, [taskStatus, mockMode]);

  // Synchronized Multi-Media Playback controllers with feedback suppression
  const handlePlay = () => {
    if (syncLockRef.current) return;
    syncLockRef.current = true;
    
    const sourceVideo = sourceVideoRef.current;
    const cleanedVideo = cleanedVideoRef.current;

    if (sourceVideo && cleanedVideo) {
      if (sourceVideo.paused) sourceVideo.play().catch(() => {});
      if (cleanedVideo.paused) cleanedVideo.play().catch(() => {});
    }

    setTimeout(() => {
      syncLockRef.current = false;
    }, 50);
  };

  const handlePause = () => {
    if (syncLockRef.current) return;
    syncLockRef.current = true;

    const sourceVideo = sourceVideoRef.current;
    const cleanedVideo = cleanedVideoRef.current;

    if (sourceVideo && cleanedVideo) {
      if (!sourceVideo.paused) sourceVideo.pause();
      if (!cleanedVideo.paused) cleanedVideo.pause();
    }

    setTimeout(() => {
      syncLockRef.current = false;
    }, 50);
  };

  const handleSeeked = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    if (syncLockRef.current) return;
    syncLockRef.current = true;

    const sourceVideo = sourceVideoRef.current;
    const cleanedVideo = cleanedVideoRef.current;
    const target = e.currentTarget;

    if (sourceVideo && cleanedVideo) {
      const targetTime = target.currentTime;
      if (Math.abs(sourceVideo.currentTime - targetTime) > 0.15) {
        sourceVideo.currentTime = targetTime;
      }
      if (Math.abs(cleanedVideo.currentTime - targetTime) > 0.15) {
        cleanedVideo.currentTime = targetTime;
      }
    }

    setTimeout(() => {
      syncLockRef.current = false;
    }, 100);
  };

  const handleDropzoneClick = () => {
    if (uploading || taskStatus === 'processing') return;
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (uploading || taskStatus === 'processing') return;
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (uploading || taskStatus === 'processing') return;
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const isStepCompleted = (index: number) => {
    if (taskStatus === 'completed') return true;
    if (mockMode) return simulatedStepIndex > index;
    return false;
  };

  const isStepActive = (index: number) => {
    if (taskStatus === 'completed') return false;
    if (mockMode) return simulatedStepIndex === index;
    // For real mode, active is decided by processing state
    return taskStatus === 'processing' && index === 0; // simple fallback
  };

  const isCompleted = taskStatus === 'completed' || (mockMode && simulatedStepIndex === 4);

  return (
    <main className={styles.dashboard}>
      {/* Top Navigation / Mode Control Bar */}
      <div className={styles.topBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className={styles.logoBadge}>AI</span>
          <h1 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#ffffff', letterSpacing: '0.05em' }}>
            SUBTITLE ERASER
          </h1>
        </div>

        {/* Global Mock Mode Toggle Switch */}
        <div className={styles.modeToggleContainer}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#ffffff' }}>Mock Mode 演示模式</span>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
              {mockMode ? '🟢 开启（免 API 配置，零成本仿真）' : '🔴 关闭（直连火山引擎付费端）'}
            </span>
          </div>
          <label className={styles.switch} htmlFor="mockModeToggle">
            <input
              id="mockModeToggle"
              type="checkbox"
              checked={mockMode}
              disabled={taskStatus === 'processing' || uploading}
              onChange={onMockModeToggle}
            />
            <span className={styles.slider} />
          </label>
        </div>
      </div>

      {/* Main Workstation Workspace */}
      <div className={styles.workspaceContent}>
        <div className={styles.workstationCard}>
          
          {/* 1. Processing (AI Pipeline checklist) View */}
          {taskStatus === 'processing' && !isCompleted && (
            <div className={styles.pipelineContainer}>
              <div className={styles.pipelineHeader}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>
                    ⚡ AI 字幕擦除分析中...
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginTop: '0.25rem' }}>
                    系统正在通过 Volcano MediaKit 执行无损硬字幕擦除，这通常需要几十秒时间...
                  </p>
                </div>
                {activeTaskId && (
                  <span className={styles.pipelineTaskId}>
                    ID: {activeTaskId.substring(0, 18)}...
                  </span>
                )}
              </div>

              {/* Steps List */}
              <div className={styles.pipelineStepsList}>
                {pipelineSteps.map((step, idx) => {
                  const completed = isStepCompleted(idx);
                  const active = isStepActive(idx);
                  
                  return (
                    <div 
                      key={idx} 
                      className={`${styles.pipelineStep} ${
                        active ? styles.pipelineStepActive : ''
                      } ${
                        completed ? styles.pipelineStepCompleted : ''
                      }`}
                    >
                      <div className={`${styles.pipelineStepIcon} ${
                        active ? styles.pipelineStepIconActive : ''
                      } ${
                        completed ? styles.pipelineStepIconCompleted : ''
                      }`}>
                        {completed ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : active ? (
                          <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="12" y1="2" x2="12" y2="6" />
                            <line x1="12" y1="18" x2="12" y2="22" />
                            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                            <line x1="2" y1="12" x2="6" y2="12" />
                            <line x1="18" y1="12" x2="22" y2="12" />
                            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
                            <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                          </svg>
                        ) : (
                          <span>{step.icon}</span>
                        )}
                      </div>
                      <div className={styles.pipelineStepText}>
                        <span className={`${styles.pipelineStepName} ${
                          active ? styles.pipelineStepNameActive : ''
                        } ${
                          completed ? styles.pipelineStepNameCompleted : ''
                        }`}>
                          {step.name} {active && ' (执行中)'} {completed && ' (完成)'}
                        </span>
                        <p className={`${styles.pipelineStepDesc} ${
                          active ? styles.pipelineStepDescActive : ''
                        }`}>
                          {step.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Completed (Side-by-side Video Preview Comparison) View */}
          {isCompleted && (
            <div className={styles.comparisonContainer}>
              <div className={styles.comparisonHeader}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>
                    ✨ 硬字幕擦除效果对比
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginTop: '0.25rem' }}>
                    左右同步播放，直观确认字幕消除与背景像素融和质量。
                  </p>
                </div>
                {activeTaskId && (
                  <span className={styles.pipelineTaskId}>
                    ID: {activeTaskId.substring(0, 18)}...
                  </span>
                )}
              </div>

              {/* Grid with synchronized comparison players */}
              <div className={styles.comparisonPlayersGrid}>
                {/* Left side: Source Input Video */}
                <div className={styles.videoCard}>
                  <div className={styles.videoTag}>原视频 (Source)</div>
                  <video
                    ref={sourceVideoRef}
                    className={styles.videoPlayer}
                    src={videoUrl}
                    controls
                    playsInline
                    onPlay={handlePlay}
                    onPause={handlePause}
                    onSeeked={handleSeeked}
                  />
                  <div className={styles.videoCardTitle}>原始输入（带硬字幕）</div>
                </div>

                {/* Right side: Cleaned AI Restored Video */}
                <div className={styles.videoCard}>
                  <div className={`${styles.videoTag} ${styles.videoTagCleaned}`}>擦除后 (Cleaned)</div>
                  <video
                    ref={cleanedVideoRef}
                    className={styles.videoPlayer}
                    src={cleanedVideoUrl || (mockMode ? 'https://assets.mixkit.co/videos/preview/mixkit-forest-stream-in-the-sunlight-529-large.mp4' : '')}
                    controls
                    playsInline
                    onPlay={handlePlay}
                    onPause={handlePause}
                    onSeeked={handleSeeked}
                  />
                  <div className={styles.videoCardTitle}>火山 AI MediaKit 无损擦除产物</div>
                </div>
              </div>

              {/* Expiration warning and Action buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '0.5rem', width: '100%' }}>
                
                {/* 24-hour expiration warning card */}
                <div style={{
                  background: 'rgba(245, 158, 11, 0.05)',
                  border: '1px dashed rgba(245, 158, 11, 0.25)',
                  borderRadius: '12px',
                  padding: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  boxShadow: '0 0 15px rgba(245, 158, 11, 0.05)'
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <div style={{ textAlign: 'left' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      产物下载时效警告
                    </span>
                    <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', lineHeight: '1.4' }}>
                      火山引擎对生成视频下载链接施加了 24 小时过期机制。为了释放系统空间，我们已物理删除了您在服务器上传的本地暂存文件。请务必在 24 小时内及时保存最终产物。
                    </p>
                  </div>
                </div>

                {/* Cleaned product links (Mock or real) */}
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                  <a
                    href={cleanedVideoUrl || (mockMode ? 'https://assets.mixkit.co/videos/preview/mixkit-forest-stream-in-the-sunlight-529-large.mp4' : undefined)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.submitBtn}
                    style={{ textDecoration: 'none', background: 'var(--gradient-neon)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                  >
                    <span>下载 Cleaned 视频</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </a>
                  
                  <button className={styles.submitBtn} onClick={onReset} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-glass)' }}>
                    <span>擦除新视频</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3. Failure Error State View */}
          {taskStatus === 'failed' && (
            <div className={styles.errorBox}>
              <div className={styles.errorTitle}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span>提交字幕擦除任务失败</span>
              </div>
              <p className={styles.errorText}>{errorMessage}</p>
              <button className={styles.resetBtn} onClick={onReset}>
                返回工作台重试
              </button>
            </div>
          )}

          {/* 4. Idle and Uploading View */}
          {(taskStatus === 'idle' || taskStatus === 'uploading') && (
            <>
              {/* Section Header */}
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>字幕擦除工作台</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  通过火山引擎 AI MediaKit 技术，智能去除视频硬字幕并融合背景
                </p>
              </div>

              {/* Hidden File Input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="video/*"
                style={{ display: 'none' }}
              />

              {/* Interactive Drag and Drop Upload Area */}
              <div
                className={`${styles.dropzone} ${isDragging ? styles.dropzoneDragging : ''}`}
                onClick={handleDropzoneClick}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{ opacity: uploading ? 0.7 : 1, cursor: uploading ? 'not-allowed' : 'pointer' }}
              >
                <div className={styles.uploadIconWrapper}>
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <h3 className={styles.uploadTitle}>
                  {uploading ? '正在暂存视频文件...' : '选择本地视频文件'}
                </h3>
                <p className={styles.uploadSubtitle}>
                  {uploading ? '上传期间请勿关闭页面...' : '拖拽 MP4, MOV, MKV 文件至此，或点击区域浏览文件'}
                  <br />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    最高支持 2K 输入分辨率，视频暂存并在处理后自动物理删除
                  </span>
                </p>
              </div>

              {/* Realtime Upload Progress Bar */}
              {uploading && uploadProgress !== null && (
                <div className={styles.progressContainer}>
                  <div className={styles.progressHeader}>
                    <span className={styles.progressText}>正在安全上传并暂存到 Local Storage...</span>
                    <span className={styles.progressPercent}>{uploadProgress}%</span>
                  </div>
                  <div className={styles.progressBarTrack}>
                    <div
                      className={styles.progressBarFill}
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Divider */}
              <div className={styles.divider}>或者</div>

              {/* URL Paste Area */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
                <label
                  htmlFor="sourceVideoUrlInput"
                  style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}
                >
                  公网视频 URL 粘贴
                </label>
                <div className={styles.urlInputGroup}>
                  <input
                    id="sourceVideoUrlInput"
                    type="text"
                    className={styles.urlInput}
                    placeholder="https://example.com/video.mp4"
                    value={videoUrl}
                    onChange={(e) => onVideoUrlChange(e.target.value)}
                    disabled={uploading}
                  />
                  <button className={styles.submitBtn} onClick={onSubmit} disabled={uploading || !videoUrl}>
                    <span>开始擦除</span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
      
      {/* Local spinner rotation keyframes */}
      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1.5s linear infinite;
        }
      `}</style>
    </main>
  );
}
