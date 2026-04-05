'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './layout.module.css'
import { agents } from './registry'

export default function AgentsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className={styles.shell}>
      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logoMark}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a10 10 0 1 0 10 10H12V2z" />
              <path d="M12 2a10 10 0 0 1 10 10" />
            </svg>
          </div>
          <div>
            <p className={styles.logoTitle}>TechCafe Demo</p>
            <p className={styles.logoSub}>Mastra Agents</p>
          </div>
        </div>

        <nav className={styles.nav}>
          <p className={styles.navLabel}>Agents</p>
          {agents.map((agent) => {
            const active = pathname === `/agents/${agent.id}`
            return (
              <Link
                key={agent.id}
                href={`/agents/${agent.id}`}
                className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
                style={{ '--agent-color': agent.color } as React.CSSProperties}
              >
                <span
                  className={styles.colorDot}
                  style={{ background: agent.color }}
                />
                <div className={styles.navText}>
                  <span className={styles.navName}>{agent.name}</span>
                  <span className={styles.navDesc}>{agent.description}</span>
                </div>
                {active && <span className={styles.activeIndicator} />}
              </Link>
            )
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <p className={styles.footerText}>Powered by Mastra + Next.js</p>
        </div>
      </aside>

      {/* ── Content ── */}
      <main className={styles.content}>
        {children}
      </main>
    </div>
  )
}
