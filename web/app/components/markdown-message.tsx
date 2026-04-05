'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import styles from './markdown-message.module.css'

interface Props {
  content: string
  accentColor?: string
}

function CodeBlock({
  children,
  className,
  ...rest
}: React.ClassAttributes<HTMLElement> & React.HTMLAttributes<HTMLElement> & { node?: unknown }) {
  const isBlock = /language-/.test(className ?? '')
  if (isBlock) {
    return (
      <code className={`${styles.blockCode} ${className ?? ''}`} {...rest}>
        {children}
      </code>
    )
  }
  return (
    <code className={styles.inlineCode} {...rest}>
      {children}
    </code>
  )
}

function PreBlock({ children }: React.HTMLAttributes<HTMLPreElement>) {
  return <pre className={styles.pre}>{children}</pre>
}

export function MarkdownMessage({ content, accentColor }: Props) {
  return (
    <div className={styles.md}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: CodeBlock,
          pre: PreBlock,
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className={styles.link}
                style={accentColor ? { color: accentColor } : undefined}
              >
                {children}
              </a>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
