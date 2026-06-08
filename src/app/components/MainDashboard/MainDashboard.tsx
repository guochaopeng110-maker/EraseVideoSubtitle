'use client';

import React, { useRef, useState, useEffect } from 'react';
import styles from './MainDashboard.module.css';
import { EraseTask } from '../Sidebar/Sidebar';
import { getBatchStats } from './batchUtils';

interface MainDashboardProps {
  tasks?: EraseTask[];
  isPro: boolean;
  onIsProChange: (value: boolean) => void;
  videoUrl: string;
  onVideoUrlChange: (url: string) => void;
  onSubmit: () => void;
  onFileSelect: (file: File) => void;
  onFilesSelect?: (files: File[]) => void;
  uploadProgress: number | null;
  uploading: boolean;
  
  taskStatus: 'idle' | 'uploading' | 'processing' | 'completed' | 'failed' | 'cancelled';
  activeTaskId: string;
  currentPollingTaskId?: string | null;
  errorMessage: string;
  onReset: () => void;
  onCancel?: () => void;
  cleanedVideoUrl?: string; // High fidelity AI subtitle erase product url
  
  // Real-time Logs Console
  taskLogs: string[];
  elapsedSeconds: number;
}

export default function MainDashboard({
  tasks = [],
  isPro,
  onIsProChange,
  videoUrl,
  onVideoUrlChange,
  onSubmit,
  onFileSelect,
  onFilesSelect,
  uploadProgress,
  uploading,
  taskStatus,
  activeTaskId,
  currentPollingTaskId,
  errorMessage,
  onReset,
  onCancel,
  cleanedVideoUrl,
  taskLogs = [],
  elapsedSeconds = 0,
}: MainDashboardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  
  // Dual Player Refs & Synchronization Controls
  const sourceVideoRef = useRef<HTMLVideoElement>(null);
  const cleanedVideoRef = useRef<HTMLVideoElement>(null);
  const syncLockRef = useRef<boolean>(false);

  // Auto-scroll terminal box to bottom when new logs arrive
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [taskLogs]);

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

  // Check log message prefixes to apply colorful terminal themes
  const getLineClass = (logLine: string) => {
    // Extracted after timestamp [HH:mm:ss]
    const content = logLine.substring(10);
    if (content.includes('❌') || content.includes('failed') || content.includes('error')) {
      return styles.terminalError;
    }
    if (content.includes('🟢') || content.includes('✨') || content.includes('success') || content.includes('completed')) {
      return styles.terminalSuccess;
    }
    if (content.includes('⚠️') || content.includes('warning') || content.includes('stat')) {
      return styles.terminalWarn;
    }
    return '';
  };

  const isCompleted = taskStatus === 'completed';
  const batchStats = getBatchStats(tasks, activeTaskId);

  return (
    <main className={styles.dashboard}>
      {/* Top Navigation Bar */}
      <div className={styles.topBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginRight: 'auto' }}>
          <span className={styles.logoBadge}>AI</span>
          <h1 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#ffffff', letterSpacing: '0.05em' }}>
            SUBTITLE ERASER
          </h1>
        </div>
        
        {/* Connection status snippet inside Topbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.02)', padding: '0.4rem 0.8rem', borderRadius: '999px', border: '1px solid var(--border-glass)' }}>
          <div className={styles.pulsingDot} style={{ backgroundColor: '#22c55e', boxShadow: '0 0 8px #22c55e' }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>生产环境在线 (Production Ready)</span>
        </div>
      </div>

      {/* Main Workstation Workspace */}
      <div className={styles.workspaceContent}>
        <div className={styles.workstationCard}>
          
          {/* 0. Batch Progress Overview Bar */}
          {batchStats && (
            <div className={styles.batchOverviewBar}>
              <div className={styles.batchOverviewHeader}>
                <div className={styles.batchOverviewTitle}>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className={styles.batchOverviewIcon}
                  >
                    <rect x="3" y="3" width="7" height="9" rx="1" />
                    <rect x="14" y="3" width="7" height="5" rx="1" />
                    <rect x="14" y="12" width="7" height="9" rx="1" />
                    <rect x="3" y="16" width="7" height="5" rx="1" />
                  </svg>
                  <span>批量处理进度概览</span>
                </div>
                <div className={styles.batchOverviewText}>
                  批量上传: <strong className={styles.batchOverviewHighlight}>{batchStats.uploaded}/{batchStats.total}</strong> 已上传 |{' '}
                  <strong className={styles.batchOverviewHighlight}>{batchStats.processing}</strong> 处理中 |{' '}
                  <strong className={styles.batchOverviewHighlight}>{batchStats.completed}</strong> 已完成 |{' '}
                  <strong className={styles.batchOverviewHighlight}>{batchStats.failed}</strong> 失败
                </div>
              </div>
              
              <div className={styles.batchProgressBarTrack}>
                <div
                  className={styles.batchProgressBarUploadFill}
                  style={{ width: `${(batchStats.uploaded / batchStats.total) * 100}%` }}
                />
                <div
                  className={styles.batchProgressBarCompleteFill}
                  style={{ width: `${((batchStats.uploaded - batchStats.processing) / batchStats.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* 1. Processing (AI Log Terminal Console) View */}
          {taskStatus === 'processing' && !isCompleted && (
            <div className={styles.pipelineContainer}>
              <div className={styles.pipelineHeader}>
                <div style={{ textAlign: 'left' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>
                    {activeTaskId === currentPollingTaskId ? '⚡ AI 擦除任务后台分析中' : '⏳ 任务排队中 (Queued)'}
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginTop: '0.25rem' }}>
                    {activeTaskId === currentPollingTaskId 
                      ? '正在实时同步火山引擎 API 异步处理状态流与日志追踪...' 
                      : '等待前序任务处理完成，自动释放轮询通道后开始分析...'}
                  </p>
                </div>
                {activeTaskId && (
                  <span className={styles.pipelineTaskId}>
                    ID: {activeTaskId.substring(0, 18)}...
                  </span>
                )}
              </div>

              {/* 暂存视频公网 URL 栏目 */}
              {videoUrl && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '12px',
                  padding: '0.875rem 1.25rem',
                  marginTop: '-0.5rem',
                  boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.05)'
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', flexGrow: 1, minWidth: 0, textAlign: 'left' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      生成的临时公网视频源 URL：
                    </span>
                    <a
                      href={videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: '0.8125rem',
                        color: 'var(--accent-cyan)',
                        textDecoration: 'underline',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontWeight: 600,
                        outline: 'none'
                      }}
                    >
                      {videoUrl}
                    </a>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(videoUrl);
                      alert('已成功复制临时公网视频 URL 到剪贴板！');
                    }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      padding: '0.4rem 0.8rem',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      flexShrink: 0
                    }}
                  >
                    复制链接
                  </button>
                </div>
              )}


              {/* Terminal Log Console Header */}
              <div className={styles.terminalLogHeader}>
                <span>&gt;_ 任务日志控制台</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div className={styles.stopwatchWrapper}>
                    <div className={styles.pulsingDot} />
                    <span>已耗时: {elapsedSeconds}s</span>
                  </div>
                  {onCancel && (
                    <button
                      onClick={onCancel}
                      style={{
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        borderRadius: '6px',
                        padding: '0.25rem 0.6rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: '#f87171',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      </svg>
                      <span>终止任务</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Scrollable Terminal Console Box */}
              <div className={styles.terminalBox}>
                {taskLogs.length === 0 ? (
                  <div className={styles.terminalLine}>
                    [SYSTEM] 🔍 正在初始化任务分析管道...
                  </div>
                ) : (
                  taskLogs.map((log, index) => (
                    <div key={index} className={`${styles.terminalLine} ${getLineClass(log)}`}>
                      {log}
                    </div>
                  ))
                )}
                <div ref={terminalEndRef} />
              </div>
            </div>
          )}

          {/* 2. Completed (Side-by-side Video Preview Comparison) View */}
          {isCompleted && (
            <div className={styles.comparisonContainer}>
              <div className={styles.comparisonHeader}>
                <div style={{ textAlign: 'left' }}>
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
                    key={videoUrl || 'empty-source'}
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
                    key={cleanedVideoUrl || 'empty-cleaned'}
                    ref={cleanedVideoRef}
                    className={styles.videoPlayer}
                    src={cleanedVideoUrl}
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
                      产物下载时效与清理警告
                    </span>
                    <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', lineHeight: '1.4' }}>
                      火山引擎对生成视频下载链接施加了 24 小时过期机制。为了释放系统空间，我们已物理删除了您在服务器上传的本地暂存文件。请务必在 24 小时内及时下载或保存最终产物。
                    </p>
                  </div>
                </div>

                {/* Cleaned product links */}
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                  <a
                    href={cleanedVideoUrl}
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

          {/* 5. Cancelled State (Archived Terminal Log) View */}
          {taskStatus === 'cancelled' && (
            <div className={styles.pipelineContainer}>
              <div className={styles.pipelineHeader}>
                <div style={{ textAlign: 'left' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'rgba(255,255,255,0.7)' }}>
                    ❌ 任务已终止 (Cancelled)
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: '0.25rem' }}>
                    本任务已于处理中被用户手动中止，轮询连接已关闭。
                  </p>
                </div>
                {activeTaskId && (
                  <span className={styles.pipelineTaskId} style={{
                    color: 'var(--text-muted)',
                    background: 'rgba(255,255,255,0.03)',
                    borderColor: 'rgba(255,255,255,0.08)'
                  }}>
                    ID: {activeTaskId.substring(0, 18)}...
                  </span>
                )}
              </div>

              {/* Terminal Log Console Header */}
              <div className={styles.terminalLogHeader}>
                <span>&gt;_ 归档日志控制台</span>
              </div>

              {/* Scrollable Terminal Console Box (Archived Style) */}
              <div className={styles.terminalBox} style={{
                borderColor: 'rgba(239, 68, 68, 0.15)',
                boxShadow: 'inset 0 2px 10px rgba(239, 68, 68, 0.05)',
                color: 'rgba(255, 255, 255, 0.6)'
              }}>
                {taskLogs.map((log, index) => (
                  <div key={index} className={`${styles.terminalLine} ${getLineClass(log)}`}>
                    {log}
                  </div>
                ))}
              </div>

              {/* Return Button */}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
                <button
                  className={styles.submitBtn}
                  onClick={onReset}
                  style={{
                    background: 'var(--gradient-neon)',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <span>返回工作台重试</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <polyline points="3 3 3 8 8 8" />
                  </svg>
                </button>
              </div>
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

              {/* Erase Version Selector */}
              <div className={styles.versionSelector}>
                <div 
                  className={`${styles.versionCard} ${!isPro ? styles.versionCardActive : ''}`}
                  onClick={() => !uploading && onIsProChange(false)}
                >
                  <div className={styles.versionCardHeader}>
                    <span className={`${styles.versionTitle} ${!isPro ? styles.versionTitleActive : ''}`}>
                      ⚡ 标准版 (Standard)
                    </span>
                    <span className={`${styles.versionBadge} ${!isPro ? styles.versionBadgeActive : ''}`}>
                      推荐
                    </span>
                  </div>
                  <p className={styles.versionDesc}>
                    智能识别视频底层硬字幕区域并融合还原背景。速度快、稳定性高，性价比优异，适合常规 Vlog、电影解说等硬字幕。
                  </p>
                </div>

                <div 
                  className={`${styles.versionCard} ${isPro ? styles.versionCardActive : ''}`}
                  onClick={() => !uploading && onIsProChange(true)}
                >
                  <div className={styles.versionCardHeader}>
                    <span className={`${styles.versionTitle} ${isPro ? styles.versionTitleActive : ''}`}>
                      💎 精细化版 (Pro)
                    </span>
                    <span className={`${styles.versionBadge} ${isPro ? styles.versionBadgeActive : ''}`}>
                      高精度
                    </span>
                  </div>
                  <p className={styles.versionDesc}>
                    专为短剧、多语言（如中英双语）等多层复杂字幕优化。边缘修复更纯净，极小背景细节还原度更高，边缘修饰更细腻。
                  </p>
                </div>
              </div>

              {/* Hidden File Input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="video/*"
                multiple
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
    </main>
  );
}
