'use client';

import React, { useState } from 'react';
import styles from './Sidebar.module.css';

export interface EraseTask {
  id: string;
  name: string;
  status: 'uploading' | 'processing' | 'completed' | 'failed' | 'cancelled';
  videoUrl?: string;
  cleanedVideoUrl?: string;
  createdAt: number;
  logs?: string[];
  pollCount?: number;
  elapsedSeconds?: number;
  batchId?: string;
}

interface SidebarProps {
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  tasks?: EraseTask[];
  activeTaskId?: string;
  currentPollingTaskId?: string | null;
  onTaskSelect?: (task: EraseTask) => void;
  onDeleteTask?: (taskId: string) => void;
  onClearHistory?: () => void;
}

export default function Sidebar({
  apiKey,
  onApiKeyChange,
  tasks = [],
  activeTaskId,
  currentPollingTaskId,
  onTaskSelect,
  onDeleteTask,
  onClearHistory,
}: SidebarProps) {
  const [checkingTaskIds, setCheckingTaskIds] = useState<Record<string, boolean>>({});
  return (
    <aside className={styles.sidebar}>
      {/* Logo Section */}
      <div className={styles.logoContainer}>
        <div className={styles.logoIcon}>
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: '#ffffff' }}
          >
            <path d="M20 20H4" />
            <path d="M4 4h16c1.1 0 2 .9 2 2v8c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <path d="M7 8l3 3 3-3" />
          </svg>
        </div>
        <div>
          <h1 className={styles.logoTitle}>SUBTITLE</h1>
          <div className={styles.logoSub}>Eraser AI</div>
        </div>
      </div>

      {/* Volcengine API Connection Settings */}
      <div className={styles.connectionCard}>
        <div className={styles.connHeader}>
          <span className={styles.connTitle}>火山引擎连接状态</span>
          <div className={styles.statusIndicator}>
            <div
              className={`${styles.statusDot} ${
                apiKey
                  ? styles.statusDotConnected
                  : styles.statusDotDisconnected
              }`}
            />
            <span
              style={{
                color: apiKey
                  ? 'var(--accent-green)'
                  : 'var(--text-muted)',
              }}
            >
              {apiKey ? '已连接' : '未配置'}
            </span>
          </div>
        </div>

        <div className={styles.keyInputWrapper}>
          <label className={styles.keyInputLabel} htmlFor="apiKeyInput">
            火山引擎 API Key
          </label>
          <input
            id="apiKeyInput"
            type="password"
            className={styles.keyInput}
            placeholder="输入 Authorization Bearer Key"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
          />
        </div>
      </div>

      {/* Erase Task History Section */}
      <div className={styles.historySection}>
        <h2 className={styles.historyTitle}>
          任务历史 
          <span className={styles.historyCount}>{tasks.length}</span>
        </h2>
        <div className={styles.historyList}>
          {tasks.length === 0 ? (
            <div className={styles.emptyHistory}>
              <svg
                className={styles.emptyIcon}
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
              <div className={styles.emptyText}>无历史处理任务</div>
              <div className={styles.emptySubtext}>开始上传视频或粘贴链接以创建字幕擦除任务</div>
            </div>
          ) : (
            tasks.map((task) => {
              const isActive = task.id === activeTaskId;
              
              // Map status labels & style classes
              let statusLabel = '上传中';
              let statusClass = styles.tagUploading;
              
              if (task.status === 'uploading') {
                statusLabel = '上传中';
                statusClass = styles.tagUploading;
              } else if (task.status === 'processing') {
                if (task.id === currentPollingTaskId) {
                  statusLabel = '处理中';
                  statusClass = styles.tagProcessing;
                } else {
                  statusLabel = '排队中';
                  statusClass = styles.tagQueued;
                }
              } else if (task.status === 'completed') {
                statusLabel = '已完成';
                statusClass = styles.tagCompleted;
              } else if (task.status === 'failed') {
                statusLabel = '失败';
                statusClass = styles.tagFailed;
              } else if (task.status === 'cancelled') {
                statusLabel = '已取消';
                statusClass = styles.tagCancelled;
              }

              const formattedTime = new Date(task.createdAt).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
              });

              const formattedDate = new Date(task.createdAt).toLocaleDateString('zh-CN', {
                month: 'numeric',
                day: 'numeric',
              });

              const isTerminal = task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled';

              return (
                <div
                  key={task.id}
                  className={`${styles.taskCard} ${isActive ? styles.taskCardActive : ''}`}
                  onClick={() => onTaskSelect?.(task)}
                >
                  {isTerminal && (
                    <button
                      className={styles.deleteBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteTask?.(task.id);
                      }}
                      title="删除任务"
                      aria-label="Delete task"
                    >
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                  <div className={`${styles.taskCardHeader} ${isTerminal ? styles.taskCardHeaderWithDelete : ''}`}>
                    <span className={styles.taskName} title={task.name}>
                      {task.name.length > 22 ? `${task.name.substring(0, 20)}...` : task.name}
                    </span>
                    <span className={`${styles.taskStatusTag} ${statusClass}`}>
                      {statusLabel}
                    </span>
                  </div>
                  <div className={styles.taskMeta}>
                    <span className={styles.taskTime}>
                      {formattedDate} {formattedTime}
                    </span>
                  </div>
                  {task.status === 'completed' && task.cleanedVideoUrl && (
                    <div className={styles.taskActions}>
                      <button
                        className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (checkingTaskIds[task.id]) return;

                          setCheckingTaskIds((prev) => ({ ...prev, [task.id]: true }));
                          try {
                            const res = await fetch(`/api/check-url?url=${encodeURIComponent(task.cleanedVideoUrl || '')}`);
                            const data = await res.json();
                            if (res.ok && data.valid) {
                              window.open(task.cleanedVideoUrl, '_blank');
                            } else {
                              alert('Cleaned Video 链接已过期，请重新上传视频并发起擦除任务。');
                            }
                          } catch {
                            alert('Cleaned Video 链接已过期，请重新上传视频并发起擦除任务。');
                          } finally {
                            setCheckingTaskIds((prev) => ({ ...prev, [task.id]: false }));
                          }
                        }}
                        disabled={checkingTaskIds[task.id]}
                      >
                        {checkingTaskIds[task.id] ? (
                          <>
                            <span className={styles.spinner} />
                            <span>校验中...</span>
                          </>
                        ) : (
                          <>
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            <span>重新下载</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
        {tasks.length > 0 && (
          <button
            className={styles.clearHistoryBtn}
            onClick={onClearHistory}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginRight: '6px' }}
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
            清空所有历史
          </button>
        )}
      </div>
    </aside>
  );
}
