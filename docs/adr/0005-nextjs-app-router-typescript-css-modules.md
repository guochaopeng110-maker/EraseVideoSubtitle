# Next.js App Router, TypeScript, and CSS Modules

We decided to use Next.js App Router, TypeScript, and CSS Modules (Vanilla CSS) for the implementation of the subtitle eraser web application.

## Context

Using modern standards ensures high maintainability, first-class type safety for handling API payloads, and clean encapsulation of complex premium animations without polluting the HTML structure.

## Decision

1. **Next.js App Router**: Leverage `app/` folder conventions, utilizing Route Handlers for the secure backend proxy.
2. **TypeScript**: Enforce strict typing for all API request/response models to ensure the robust handling of Volcano Engine's schemas.
3. **CSS Modules & Vanilla CSS**: Keep CSS styles modularized and encapsulated. This allows detailed implementation of complex responsive layouts, customized glassmorphic components, and beautiful glowing visual effects with keyframe animations without bloating the DOM with long class lists.
