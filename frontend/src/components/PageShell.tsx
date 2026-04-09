import { Link } from "react-router-dom"
import type { ReactNode } from "react"

import { BrandMark } from "./BrandMark"
import { getBabyTone } from "../lib/baby"
import type { BabyTone } from "../lib/types"

interface PageShellProps {
  children: ReactNode
  title?: string
  subtitle?: string
  actions?: ReactNode
  tone?: BabyTone | null
  eyebrow?: string
  hideIntro?: boolean
}

export function PageShell({
  children,
  title,
  subtitle,
  actions,
  tone = null,
  eyebrow = "אסתריקה",
  hideIntro = false,
}: PageShellProps) {
  return (
    <div className={`page-shell page-shell--${getBabyTone(tone)}`}>
      <header className="topbar">
        <div className="topbar__actions">{actions}</div>
        <Link to="/" className="topbar__brand">
          <BrandMark compact />
        </Link>
      </header>

      <main className="page-shell__body">
        {!hideIntro ? (
          <section className="hero-card">
            <p className="eyebrow">{eyebrow}</p>
            {title ? <h2>{title}</h2> : null}
            {subtitle ? <p>{subtitle}</p> : null}
          </section>
        ) : null}
        {children}
      </main>
    </div>
  )
}
