# Glow and Glassmorphism Dark Mode Dashboard UI

We decided to design the web application UI using a modern, high-fidelity dark mode dashboard theme featuring glassmorphism elements, vibrant neon gradients, and a dual-column layout.

## Context

A simple subtitle erasing utility can easily feel generic. To elevate the application's perceived value and provide a "WOW" effect, the visual layout must feel premium, state-of-the-art, and alive with fluid micro-interactions.

## Decision

1. **Theme**: Deep space dark blue/grey background (`#090C15` to `#0E1326`), with translucent glassmorphic cards (`backdrop-filter: blur(12px)`) and glowing cyan/purple borders.
2. **Layout**:
   - **Left Sidebar**: Displays the Logo, API Key Connection status, and the **Erase Task** history (loaded from local storage) with status indicators.
   - **Right Main Panel**: Seamlessly transitions between:
     - *Upload/Input state*: Upload dropzone and URL paste bar.
     - *Processing state*: Circular glowing progress bar and checklist of AI pipeline sub-steps.
     - *Completed state*: Double player view or before/after toggle view to visually compare the video before and after subtitle erasure.
3. **Typography**: Google Fonts Inter and Outfit. Monospace font for counters to prevent layout shifting.
