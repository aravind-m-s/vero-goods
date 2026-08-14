import React from 'react';
import Link from 'next/link';
import { BadgeIndianRupee, Headphones, RotateCcw, Truck } from 'lucide-react';

const GUARANTEES = [
  { icon: Truck, title: 'Fast dispatch', body: 'Dispatched within 1–4 working days.' },
  { icon: BadgeIndianRupee, title: 'COD available', body: 'Pay cash when your order arrives.' },
  { icon: RotateCcw, title: '2 days replacement', body: 'Unboxing video required.' },
  { icon: Headphones, title: 'Dedicated customer support', body: 'Fast response & hassle-free assistance.' },
];

/**
 * Trust rail (content, on the page surface) followed by the footer band
 * (graphite — chrome). Together with the utility strip in the header these are
 * the only two band surfaces in the storefront: they bookend the page rather
 * than interrupting it, and stay graphite in both colour schemes.
 */
export function Footer() {
  return (
    <footer className="mt-12">
      <section
        aria-label="Store guarantees"
        className="border-t border-line bg-surface-raised"
      >
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 lg:grid-cols-4 lg:px-8">
          {GUARANTEES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-3">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              <div>
                <p className="text-xs font-semibold text-ink">{title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-subtle">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="bg-band text-band-ink">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-12 sm:px-6 lg:flex-row lg:justify-between lg:px-8">
          <div className="max-w-xs">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-control bg-accent text-xs font-black text-on-accent">
                V
              </span>
              <span className="text-sm font-black tracking-tight">
                VERO<span className="font-light opacity-50">GOODS</span>
              </span>
            </div>
            <p className="mt-3 text-xs leading-relaxed opacity-60">
              Curated kitchenware, smart tools, and home utility essentials delivered across India.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            <FooterColumn
              title="Shop"
              links={[
                { href: '/', label: 'All products' },
                { href: '/checkout', label: 'Cart & checkout' },
              ]}
            />
            <FooterColumn
              title="Help"
              links={[{ href: 'mailto:info@verogoods.in', label: 'Contact support' }]}
            />
            <FooterColumn
              title="Policies"
              links={[
                { href: '/#shipping', label: 'Shipping' },
                { href: '/#returns', label: 'Returns' },
              ]}
            />
          </div>
        </div>

        <div className="border-t border-band-line">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-2xs opacity-50 sm:flex-row sm:px-6 lg:px-8">
            <p>&copy; {new Date().getFullYear()} Vero Goods. All rights reserved.</p>
            <p>Delivery within India only.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <div>
      <h2 className="text-2xs font-semibold uppercase tracking-wide opacity-50">{title}</h2>
      <ul className="mt-3 space-y-2">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="text-xs opacity-80 transition-colors hover:text-accent hover:opacity-100"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
