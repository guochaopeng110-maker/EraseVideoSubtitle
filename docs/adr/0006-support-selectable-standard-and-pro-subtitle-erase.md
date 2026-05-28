# ADR 0006: Support Selectable Standard and Pro Subtitle Erase

## Context

We originally designed the Subtitle Eraser application to consume the Volcano Engine MediaKit Standard API (`erase-video-subtitle`).
However, Volcano Engine also offers a high-precision Pro version (`erase-video-subtitle-pro`) tailored for micro-drama (短剧) scenarios with multi-layered subtitles.
To accommodate different video sources, cost preferences, and precision requirements, we want to support both standard and pro interfaces in the backend and allow the user to select their desired erase mode directly from the Workstation UI.

## Decision

We will:
1. **Extend `VolcengineClient` & Implementations**: Update `VolcengineClient`'s interface `submitEraseTask` to accept an optional `isPro?: boolean` parameter.
   - If `isPro` is false or omitted, `RealVolcengineClient` submits to the standard `/erase-video-subtitle` endpoint.
   - If `isPro` is true, it submits to `/erase-video-subtitle-pro` with `mode: 'Subtitle'` required body payload.
2. **Update API Proxy Route**: Adapt the `/api/tasks` handler to read `isPro` from the incoming JSON request body and pass it to the underlying Volcano Engine client.
3. **Align Mock Client**: Adapt `MockVolcengineClient` to generate different mock task IDs depending on `isPro` (e.g. `amk-mock-erase-task-pro-` vs `amk-mock-erase-task-std-`).
4. **Expose Selectable UI**: Introduce a visually stunning Glassmorphism selector in `MainDashboard` allowing the user to select between "标准版 (Standard)" and "精细化版 (Pro)" modes. Pass this selection through the Home workstation page state to the backend.

## Consequences

- **Higher User Flexibility**: Users can leverage standard mode for general caption erasure or switch to high-fidelity pro mode for micro-dramas and multi-language subtitles.
- **Robust Mocking**: Both modes are fully simulated in `Mock Mode` for seamless showcase and development workflows.
- **Type Safety**: Maintain robust TS compile checks and 100% Vitest test suite success.
