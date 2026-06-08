# ADR 0007: Client-Side Batch Processing with FIFO Polling Queue

## Context

Our users often need to process multiple video files in batches. This introduces two key challenges:
1. **API Rate Limiting & Network Congestion**: Concurrently polling Volcano Engine MediaKit API status for multiple active tasks could easily violate API QPS limits, trigger IP-based rate limiting, and consume excessive server bandwidth.
2. **Server Complexity vs. Stateless Architecture**: Building a traditional backend queue (using Redis, Celery, or relational databases) to persist and manage batch states would contradict our lightweight, stateless backend design (where history is kept locally in the client's `localStorage` and no user authentication is required).

We need a design that supports batch upload, concurrent scheduling, and task history management without introducing heavy database dependencies or backend state machines.

## Decision

We decided to implement the **Batch Processing & FIFO Polling Queue entirely on the Client-Side**:

1. **Client-Side Concurrency Controller (`BatchUploadManager`)**:
   - Manages the upload queue entirely in React state / JS runtime.
   - Enforces a client-side concurrency limit of **2 parallel uploads** using a native XHR request pool, protecting both browser resources and server buffer capability.
   - Triggers the Volcano Engine API task creation request instantly as soon as each individual file completes its upload.

2. **FIFO Single-Channel Polling Queue (`scheduleNextPoll`)**:
   - Implements a single-thread mutex in the client (using React refs and states).
   - Only **one** task (the earliest submitted task in `processing` state) is allowed to actively poll Volcano Engine at any given time.
   - Subsequent tasks wait silently in the client-side queue (marked visually as "排队中").
   - When the active task reaches a terminal state (`completed` or `failed`), the mutex is released, and the scheduler recursively advances to the next task in chronological order.

3. **Non-Interruptive Task Switching**:
   - Users can click on any sidebar task to review its historical logs or completed video players at any time.
   - Selecting a different task changes `activeTaskId` for display purposes but **does not affect** the background upload pool or the `currentPollingTaskIdRef` polling engine.
   - Active logs are appended to the task's private history and are fully restored when the user switches back.

4. **Intelligent Auto-Advance (`getNextActiveTaskIdOnQueueAdvance`)**:
   - In `scheduleNextPoll`, when a task finishes and queue advances to the next task:
     - If the user is currently viewing the newly completed task, the active dashboard view automatically shifts to show the logs of the next active polling task.
     - If the user has explicitly navigated away (e.g. inspecting an old completed task), the view remains unchanged to prevent breaking the user's flow.

## Consequences

- **Lightweight & Low Cost**: The backend remains completely stateless and database-free. Deploying the app requires minimal resources, and server storage is only temporarily utilized.
- **Robust API Protection**: The client-side single-channel polling queue guarantees that we never exceed QPS limits, while reusing the adaptive exponential backoff engine.
- **Flawless UX**: Users can upload batches of files without blocking their workspace, switch views freely, and see intelligent transitions as background queue advances.
- **Local Persistence Alignment**: Deduped task metadata and archived log checkpoints are saved to `localStorage` perfectly.
