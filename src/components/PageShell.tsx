import type { ReactNode } from 'react'

interface Props {
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
}

/** Scaffold for scrolling pages: sticky, softly-masked header over content. */
export function PageShell({ title, subtitle, actions, children }: Props) {
  return (
    <div className="page">
      <header className="page__head">
        <div className="page__titles">
          <h1 className="t-page-title">{title}</h1>
          {subtitle && <p className="page__sub">{subtitle}</p>}
        </div>
        {actions && <div className="page__actions">{actions}</div>}
      </header>
      <div className="page__body">{children}</div>
    </div>
  )
}
