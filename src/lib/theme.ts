import type { ThemeChoice } from './types'

const QUERY = '(prefers-color-scheme: dark)'

export type ResolvedTheme = 'light' | 'dark'

export function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  if (choice !== 'system') return choice
  return window.matchMedia?.(QUERY).matches ? 'dark' : 'light'
}

/**
 * Stamp the resolved theme on the root element. Every token in `tokens.css`
 * keys off this one attribute, so the whole interface — including the chart
 * palette, which is expressed as custom properties rather than literals —
 * turns over in one paint.
 */
export function applyTheme(choice: ThemeChoice) {
  const theme = resolveTheme(choice)
  document.documentElement.dataset.theme = theme
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#17150f' : '#f4efe7')
  return theme
}

/** Follow the OS while the choice is `system`, and stop when it isn't. */
export function watchSystemTheme(onChange: () => void) {
  const mql = window.matchMedia?.(QUERY)
  if (!mql) return () => {}
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}
