# Adaptive Polling and Configurable File Retention

We decided to implement an adaptive polling algorithm for query efficiency and make the temporary file retention time fully configurable via environment variables.

## Context

Video subtitle erasing is a compute-intensive process that can take from 10 seconds to several minutes. Fixed short-interval polling (e.g. 3s) wastes server bandwidth and risks hitting API rate limits. Additionally, deleting temporary uploads too quickly (e.g., within 30 minutes) could break slow tasks or affect users under bad network conditions.

## Decision

1. **Adaptive Polling**:
   - The frontend will poll `/api/tasks/[id]` with an increasing interval:
     - 0s - 30s elapsed: poll every 5 seconds.
     - 30s - 120s elapsed: poll every 8 seconds.
     - > 120s elapsed: poll every 12 seconds.
2. **Configurable Retention & Cleanup**:
   - We will introduce two environment variables in `.env`:
     - `TEMP_FILE_MAX_AGE_MINS` (default: `120` minutes / 2 hours): The maximum duration an uploaded video can exist on disk before being forced to delete.
     - `CLEANUP_CRON_INTERVAL_MINS` (default: `15` minutes): How often the background cleanup script scans and purges expired temporary videos.
   - Files associated with successfully completed or failed tasks will still be cleaned up immediately upon the final query to save disk space.
