import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import '@/shared/styles/globals.css';
import { appUrl } from '@/shared/lib/config';

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
    default: 'Vero Goods — Premium 3D Hardware & Filaments',
    template: '%s | Vero Goods',
  },
  description:
    'Shop premium 3D printers, filaments, and accessories. Fast delivery across India with secure Razorpay and Cash on Delivery payment options.',
  keywords: ['3D printer', 'filament', 'India', 'Vero Goods', 'Anycubic', 'Creality', 'Elegoo'],
  openGraph: {
    siteName: 'Vero Goods',
    type: 'website',
    locale: 'en_IN',
  },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-surface-sunken text-ink">
        {children}
      </body>
    </html>
  );
}
