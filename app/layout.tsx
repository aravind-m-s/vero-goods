import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Vero Goods — Premium 3D Hardware & Filaments",
    template: "%s | Vero Goods",
  },
  description:
    "Shop premium 3D printers, filaments, and accessories. Fast delivery across India with secure Razorpay and Cash on Delivery payment options.",
  keywords: ["3D printer", "filament", "India", "Vero Goods", "Anycubic", "Creality", "Elegoo"],
  openGraph: {
    siteName: "Vero Goods",
    type: "website",
    locale: "en_IN",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        {children}
      </body>
    </html>
  );
}
