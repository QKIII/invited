import type { Metadata } from "next";
import {
  Cormorant_Garamond,
  Fraunces,
  Instrument_Serif,
  Inter,
  Nunito,
  Plus_Jakarta_Sans,
  Space_Mono,
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

const uiBody = Inter({
  subsets: ["latin"],
  variable: "--font-ui-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "invited — Free, Account-Free Event Invitations",
  description:
    "Create expressive, platform-agnostic event invitations with instant RSVPs, guest discussions, and zero accounts required.",
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
    uiBody.variable,
  ].join(" ");

  return (
    <html lang="en" className={fontVariables}>
      <body className="min-h-screen antialiased">
        <PolyfillBootstrap />
        {children}
      </body>
    </html>
  );
}
