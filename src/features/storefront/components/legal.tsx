import React from 'react';
import { STORE_NAME, SUPPORT_EMAIL } from '@/shared/lib/config';

/**
 * Shared building blocks for the static legal pages (/privacy, /terms).
 *
 * They exist so the policies read as one document set: the same reading column,
 * the same clause numbering, and the same type scale on every page. Legal copy
 * gets edited by non-designers, so the pages compose these instead of carrying
 * their own class strings.
 */

export function LegalPage({
  eyebrow = 'Legal',
  title,
  lastUpdated,
  intro,
  children,
  acknowledgement,
}: {
  eyebrow?: string;
  title: string;
  lastUpdated: string;
  intro: React.ReactNode;
  children: React.ReactNode;
  acknowledgement: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <header className="border-b border-line pb-6">
        <p className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">{title}</h1>
        <div className="mt-2 text-sm leading-relaxed text-ink-muted">{intro}</div>
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-xs text-ink-subtle">
          <div className="flex gap-1.5">
            <dt className="font-semibold text-ink">Last updated</dt>
            <dd>{lastUpdated}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="font-semibold text-ink">Contact</dt>
            <dd>
              <SupportEmail />
            </dd>
          </div>
        </dl>
      </header>

      {children}

      <p className="mt-10 border-t border-line pt-6 text-xs leading-relaxed text-ink-subtle">
        {acknowledgement}
      </p>
    </div>
  );
}

/**
 * One numbered clause. The number lives in the heading text rather than an
 * ordered list, so a customer quoting &ldquo;section 4&rdquo; back to support
 * always means the same clause even after copy is edited around it.
 */
export function Section({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 scroll-mt-24">
      <h2 className="text-sm font-semibold text-ink">
        <span className="tabular-nums text-ink-subtle">{n}.</span> {title}
      </h2>
      {children}
    </section>
  );
}

export function Subheading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-4 text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
      {children}
    </h3>
  );
}

export function P({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`mt-3 text-sm leading-relaxed text-ink-muted ${className}`}>{children}</p>;
}

export function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="mt-3 space-y-1.5">
      {items.map((item, index) => (
        <li key={index} className="flex gap-2.5 text-sm leading-relaxed text-ink-muted">
          <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Numbered steps, for lists where the order is part of the requirement. */
export function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="mt-3 space-y-1.5">
      {items.map((item, index) => (
        <li key={index} className="flex gap-2.5 text-sm leading-relaxed text-ink-muted">
          <span className="w-4 shrink-0 tabular-nums font-semibold text-ink-subtle">
            {index + 1}.
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

/** Pulled out because a clause the customer must act on should not be missed. */
export function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-card border border-accent-border bg-accent-soft p-4 text-sm leading-relaxed text-accent-ink">
      {children}
    </div>
  );
}

export function ContactCard() {
  return (
    <address className="mt-4 rounded-card border border-line bg-surface-raised p-4 not-italic">
      <p className="text-sm font-semibold text-ink">{STORE_NAME}</p>
      <SupportEmail className="mt-1 inline-block text-sm text-ink-muted" />
    </address>
  );
}

export function SupportEmail({ className = '' }: { className?: string }) {
  return (
    <a
      href={`mailto:${SUPPORT_EMAIL}`}
      className={`underline underline-offset-2 transition-colors hover:text-accent ${className}`}
    >
      {SUPPORT_EMAIL}
    </a>
  );
}
