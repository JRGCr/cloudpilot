/**
 * Server-side rendering entry point
 *
 * Note: React Router v7 uses a different SSR approach.
 * For production SSR, consider using their framework integration.
 * This is a basic implementation for compatibility.
 */

import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { App } from './App';

export interface RenderOptions {
  url: string;
}

export interface RenderResult {
  html: string;
}

export function render(options: RenderOptions): RenderResult {
  const html = renderToString(
    <StrictMode>
      <MemoryRouter initialEntries={[options.url]}>
        <App />
      </MemoryRouter>
    </StrictMode>,
  );

  return { html };
}

/**
 * Generate the full HTML document with SSR content
 */
export function renderFullPage(options: RenderOptions, template: string): string {
  const { html } = render(options);

  // Replace the root div placeholder with rendered content
  return template.replace('<div id="root"></div>', `<div id="root">${html}</div>`);
}
