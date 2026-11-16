import type { Metadata, Viewport } from "next";
import {
  Cormorant_Garamond,
  Fraunces,
  Instrument_Serif,
  Inter,
  Nunito,
  Plus_Jakarta_Sans,
  Space_Mono,
  Syne,
} from "next/font/google";
import { PolyfillBootstrap } from "@/components/PolyfillBootstrap";
import "./globals.css";

const editorialSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-editorial-serif",
  display: "swap",
});

const modernSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-modern-sans",
  display: "swap",
});

const expressiveDisplay = Fraunces({
  subsets: ["latin"],
  variable: "--font-expressive-display",
  display: "swap",
});

const sacredClassic = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-sacred-classic",
  display: "swap",
});

const playfulRounded = Nunito({
  subsets: ["latin"],
  variable: "--font-playful-rounded",
  display: "swap",
});

const studioMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-studio-mono",
  display: "swap",
});

const y2kDisplay = Syne({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-y2k-display",
  display: "swap",
});

const uiBody = Inter({
  subsets: ["latin"],
  variable: "--font-ui-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "invited — Simple Event Invites",
  description:
    "Create warm event invites in seconds and collect RSVPs with a single link. No accounts needed.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "invited",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#082556",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const fontVariables = [
    editorialSerif.variable,
    modernSans.variable,
    expressiveDisplay.variable,
    sacredClassic.variable,
    playfulRounded.variable,
    studioMono.variable,
    y2kDisplay.variable,
    uiBody.variable,
  ].join(" ");

  return (
    <html lang="en" className={fontVariables}>
      <body className="min-h-dvh antialiased">
        <PolyfillBootstrap />
        {children}
      </body>
    </html>
  );
}
