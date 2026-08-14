import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Script from 'next/script';
import '@/shared/styles/globals.css';
import { appUrl } from '@/shared/lib/config';
import { ThemeProvider } from '@/shared/theme/ThemeProvider';
import { THEME_INIT_SCRIPT } from '@/shared/theme/theme';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  // Without metadataBase, relative OG image URLs resolve against localhost when
  // a page is shared.
  metadataBase: new URL(appUrl()),
  title: {
    default: 'Vero Goods — Premium Everyday Home & Utility Essentials',
    template: '%s | Vero Goods',
  },
  description:
    'Shop premium kitchen accessories, smart tools, containers, and home organization essentials. Fast delivery across India with secure online payment and Cash on Delivery.',
  keywords: ['Kitchen accessories', 'Smart tools', 'Containers', 'Ratchet screwdriver', 'Home organization', 'India', 'Vero Goods'],
  icons: {
    // favicon.svg in src/app/ is auto-discovered by Next.js; the entries below
    // also cover browsers that prefer explicit sizes or the apple-touch-icon.
    icon: [
      { url: '/logo.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/logo.svg', sizes: '180x180', type: 'image/svg+xml' },
    ],
    shortcut: '/logo.svg',
  },
  openGraph: {
    siteName: 'Vero Goods',
    type: 'website',
    locale: 'en_IN',
  },
  twitter: { card: 'summary_large_image' },
};

// Tints the browser chrome (Android address bar, iOS PWA header) to match the
// page, so the theme does not stop at the edge of the viewport. These are the
// --surface-sunken values from globals.css.
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f6f4' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0b0d' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the inline script below sets data-theme on this
    // element before React hydrates, and the DOM must win over the server markup.
    <html
      lang="en-IN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Injected into the initial HTML and run before any app code, so a
            visitor who chose dark never sees a flash of the light theme.
            next/script rather than a raw <script>: React never executes a
            script element it renders on the client, and warns about it on every
            client-side navigation. */}
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
      </head>
      <body className="flex min-h-full flex-col bg-surface-sunken text-ink">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
