/// <reference types="vite/client" />

// Vite build-time injected constants
declare const __BUILD_VERSION__: string;
declare const __BUILD_TIME__: string;

// For test environment
declare global {
  // biome-ignore lint/style/noVar: Required for globalThis augmentation
  var __BUILD_VERSION__: string;
  // biome-ignore lint/style/noVar: Required for globalThis augmentation
  var __BUILD_TIME__: string;
}
