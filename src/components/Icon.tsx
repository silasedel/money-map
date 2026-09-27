import { useMemo } from 'react'

/**
 * One coherent icon set — 24px grid, 1.7 stroke, round caps and joins.
 * Drawn by hand rather than imported so the weight matches the type.
 */

export type IconName =
  | 'mindmap'
  | 'income'
  | 'goals'
  | 'outlook'
  | 'pencil'
  | 'repeat'
  | 'settings'
  | 'chevron'
  | 'plus'
  | 'minus'
  | 'close'
  | 'trash'
  | 'check'
  | 'arrowUp'
  | 'arrowDown'
  | 'target'
  | 'sparkle'
  | 'link'
  | 'crosshair'
  | 'palette'
  | 'grip'
  | 'home'
  | 'ledger'
  | 'spending'
  | 'subscriptions'
  | 'tax'
  | 'tag'
  | 'search'
  | 'download'
  | 'pause'
  | 'play'
  | 'calendar'
  | 'arrowRight'
  | 'receipt'

const paths: Record<IconName, JSX.Element> = {
  /* A roof over a door — the place you start from. */
  home: (
    <>
      <path d="M4.6 11.2 12 4.8l7.4 6.4" />
      <path d="M6.4 10v8.2c0 .6.5 1.1 1.1 1.1h9c.6 0 1.1-.5 1.1-1.1V10" />
      <path d="M10 19.3v-4.6h4v4.6" opacity="0.6" />
    </>
  ),
  /* Ruled lines with a margin — a ledger page. */
  ledger: (
    <>
      <path d="M6.2 4.4h11.6c.7 0 1.2.5 1.2 1.2v12.8c0 .7-.5 1.2-1.2 1.2H6.2c-.7 0-1.2-.5-1.2-1.2V5.6c0-.7.5-1.2 1.2-1.2Z" />
      <path d="M8.6 9h6.8M8.6 12.2h6.8M8.6 15.4h4.2" opacity="0.62" />
    </>
  ),
  /* A ring, part-filled — the budget figure itself. */
  spending: (
    <>
      <circle cx="12" cy="12" r="7.6" opacity="0.3" />
      <path d="M12 4.4a7.6 7.6 0 0 1 7.4 9.3" />
      <path d="M8.6 12.6l2.2 2.2 4.6-4.8" opacity="0.75" />
    </>
  ),
  /* Two arrows chasing each other around a date. */
  subscriptions: (
    <>
      <path d="M5.2 10.2A7.2 7.2 0 0 1 17.6 7l1.6 1.6M18.8 13.8A7.2 7.2 0 0 1 6.4 17l-1.6-1.6" />
      <path d="M19.2 4.8v3.8h-3.8M4.8 19.2v-3.8h3.8" />
    </>
  ),
  /* A receipt with a torn edge and a total line. */
  tax: (
    <>
      <path d="M6.4 3.8h11.2v15.6l-1.9-1.3-1.9 1.3-1.8-1.3-1.8 1.3-1.9-1.3-1.9 1.3Z" />
      <path d="M9.2 8.2h5.6M9.2 11.4h5.6M11.8 14.6h3" opacity="0.62" />
    </>
  ),
  receipt: (
    <>
      <path d="M6.4 3.8h11.2v15.6l-1.9-1.3-1.9 1.3-1.8-1.3-1.8 1.3-1.9-1.3-1.9 1.3Z" />
      <path d="M9.2 8.2h5.6M9.2 11.4h5.6M11.8 14.6h3" opacity="0.62" />
    </>
  ),
  tag: (
    <>
      <path d="M3.9 12.6V5.4c0-.8.7-1.5 1.5-1.5h7.2c.4 0 .8.2 1.1.4l6.2 6.2c.6.6.6 1.5 0 2.1l-6.4 6.4c-.6.6-1.5.6-2.1 0L4.3 13.7c-.3-.3-.4-.7-.4-1.1Z" />
      <circle cx="8.6" cy="8.6" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.2" />
      <path d="M15.4 15.4 20 20" />
    </>
  ),
  download: (
    <>
      <path d="M12 4.6v10.2M7.6 10.6 12 15l4.4-4.4" />
      <path d="M4.8 16.6v1.6c0 .8.6 1.4 1.4 1.4h11.6c.8 0 1.4-.6 1.4-1.4v-1.6" opacity="0.62" />
    </>
  ),
  pause: <path d="M9 6.2v11.6M15 6.2v11.6" />,
  play: <path d="M8.2 5.8v12.4l9.6-6.2Z" />,
  calendar: (
    <>
      <path d="M5.4 6.6h13.2c.6 0 1.1.5 1.1 1.1v10.2c0 .6-.5 1.1-1.1 1.1H5.4c-.6 0-1.1-.5-1.1-1.1V7.7c0-.6.5-1.1 1.1-1.1Z" />
      <path d="M4.3 10.4h15.4M8.6 4.4v3.4M15.4 4.4v3.4" opacity="0.62" />
    </>
  ),
  arrowRight: <path d="M5 12h13.4M12.8 6.2 18.6 12l-5.8 5.8" />,
  /* A node graph: two bubbles feeding a third, links meeting the circles at
     their edges rather than crossing them. */
  mindmap: (
    <>
      <path d="M9.1 7.9c2.1 1 3.4 1.9 5.5 2.8M8.2 9.9c-.5 1.8-.8 3.2-1.1 4.6" opacity="0.7" />
      <circle cx="6.6" cy="6.7" r="2.9" />
      <circle cx="17.4" cy="12.1" r="2.5" />
      <circle cx="6.8" cy="17.2" r="2.3" />
    </>
  ),
  /* Money in above the line, money out below it — the same figure the cash
     flow chart draws, so the tab and the page agree. */
  income: (
    <>
      <path d="M3.4 12h17.2" opacity="0.45" />
      <path d="M7.2 12V5.6M12 12V8.3M16.8 12V6.9" />
      <path d="M7.2 12v3.1M12 12v5.4M16.8 12v2.4" opacity="0.6" />
    </>
  ),
  /* A progress ring, not a bullseye: the arc says "part of the way there". */
  goals: (
    <>
      <circle cx="12" cy="12" r="8" opacity="0.32" />
      <path d="M12 4a8 8 0 0 1 6.6 12.5" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  /* A measured line that keeps going as a projection. */
  outlook: (
    <>
      <path d="M3.6 16.4l4.6-5 3.4 2.8 3.3-4.6" />
      <path d="M14.9 9.6l2.1 1.5 3.4-4.7" strokeDasharray="2.6 2.6" opacity="0.62" />
      <path d="M3.6 20.2h16.8" opacity="0.32" />
    </>
  ),
  chevron: <path d="M9.5 5.8 15.8 12l-6.3 6.2" />,
  plus: <path d="M12 5.4v13.2M5.4 12h13.2" />,
  minus: <path d="M5.4 12h13.2" />,
  close: <path d="M6.4 6.4l11.2 11.2M17.6 6.4 6.4 17.6" />,
  trash: (
    <>
      <path d="M4.6 6.8h14.8M9.4 6.8V5.2c0-.6.5-1.1 1.1-1.1h3c.6 0 1.1.5 1.1 1.1v1.6" />
      <path d="M6.6 6.8l.8 11.6c0 .8.7 1.5 1.5 1.5h6.2c.8 0 1.5-.7 1.5-1.5l.8-11.6" />
    </>
  ),
  check: <path d="M5.6 12.6 10 17l8.4-9.4" />,
  arrowUp: <path d="M12 19V5.6M6.2 11.2 12 5.4l5.8 5.8" />,
  arrowDown: <path d="M12 5v13.4M6.2 12.8 12 18.6l5.8-5.8" />,
  target: (
    <>
      <circle cx="12" cy="12" r="7.6" />
      <path d="M12 4.4v3M12 16.6v3M4.4 12h3M16.6 12h3" />
    </>
  ),
  sparkle: (
    <path d="M12 4.4c.7 3.9 2.9 6.1 6.8 6.8-3.9.7-6.1 2.9-6.8 6.8-.7-3.9-2.9-6.1-6.8-6.8 3.9-.7 6.1-2.9 6.8-6.8Z" />
  ),
  link: (
    <>
      <path d="M10 13.8a3.6 3.6 0 0 0 5.4.4l2.4-2.4a3.6 3.6 0 1 0-5.1-5.1l-1.3 1.3" />
      <path d="M14 10.2a3.6 3.6 0 0 0-5.4-.4l-2.4 2.4a3.6 3.6 0 1 0 5.1 5.1l1.3-1.3" />
    </>
  ),
  crosshair: (
    <>
      <circle cx="12" cy="12" r="7.4" />
      <path d="M12 2.8v3.4M12 17.8v3.4M2.8 12h3.4M17.8 12h3.4" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3.6c-4.6 0-8.4 3.6-8.4 8.1 0 4.5 3.4 7.4 7 7.4 1.6 0 2.2-.9 2.2-1.8 0-.9-.7-1.3-.7-2.1 0-.8.6-1.5 1.6-1.5h1.8c2.7 0 4.9-2.1 4.9-4.7 0-3-3.1-5.4-8.4-5.4Z" />
      <circle cx="8.1" cy="10.2" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="7.9" r="1" fill="currentColor" stroke="none" />
      <circle cx="15.8" cy="9.9" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  grip: (
    <>
      <path d="M8.4 5.6v12.8M15.6 5.6v12.8" />
    </>
  ),
  pencil: (
    <>
      <path d="M15.6 4.9l3.5 3.5M4.4 19.6l.7-3.9L16.1 4.7a1.6 1.6 0 0 1 2.3 0l.9.9a1.6 1.6 0 0 1 0 2.3L8.3 18.9l-3.9.7Z" />
    </>
  ),
  /* Sliders rather than a cog — this is preferences, not machinery. */
  settings: (
    <>
      <path d="M4 8.2h8.4M17.2 8.2h2.8M4 15.8h2.8M11.6 15.8H20" />
      <circle cx="14.8" cy="8.2" r="2.4" />
      <circle cx="9.2" cy="15.8" r="2.4" />
    </>
  ),
  repeat: (
    <>
      <path d="M4.6 10.4a7.4 7.4 0 0 1 12.6-3.6l2 2M19.4 13.6a7.4 7.4 0 0 1-12.6 3.6l-2-2" />
      <path d="M19.2 4.6v4.2H15M4.8 19.4v-4.2H9" />
    </>
  ),
}

interface Props {
  name: IconName
  size?: number
  strokeWidth?: number
  className?: string
  style?: React.CSSProperties
}

export function Icon({ name, size = 18, strokeWidth = 1.7, className, style }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

/**
 * The app's mark.
 *
 * A solid tile with the figure cut out of it, the way a real app icon is
 * built — the mark is the negative space, so it sits on any ground and never
 * needs a light and a dark version.
 *
 * The figure itself: two routes run down from the top corners and converge on
 * a marker. It reads at once as the brand initial, as a map with a destination
 * on it, and as the app's own mind map — paths meeting at a node. The routes
 * arrive *into* the marker rather than crossing it, which is what stops it
 * reading as a plain zigzag, and at 16px the knockout closes up into a single
 * confident M.
 */
let markSeed = 0

export function Logomark({ size = 34 }: { size?: number }) {
  // Unique ids so several marks on one page can't share a mask.
  const uid = useMemo(() => `mm${++markSeed}`, [])

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${uid}g`} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0%" stopColor="var(--logo-a)" />
          <stop offset="100%" stopColor="var(--logo-b)" />
        </linearGradient>

        <mask id={`${uid}m`}>
          <rect width="40" height="40" rx="11.5" fill="#fff" />
          <g
            stroke="#000"
            strokeWidth="4.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          >
            <path d="M10.4 29.6V13.2l7.1 6.9" />
            <path d="M29.6 29.6V13.2l-7.1 6.9" />
          </g>
          <circle cx="20" cy="24.2" r="4.5" fill="#000" />
        </mask>
      </defs>

      <rect
        width="40"
        height="40"
        rx="11.5"
        fill={`url(#${uid}g)`}
        mask={`url(#${uid}m)`}
      />
    </svg>
  )
}
