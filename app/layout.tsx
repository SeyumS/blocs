import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import type { Viewport } from 'next'
import { createClient } from '@/lib/supabase/server'
import {
  DEFAULT_THEME_COLOR,
  DEFAULT_THEME_SURFACE,
  THEME_PALETTES,
  isThemeColorKey,
  isThemeSurface,
} from '@/lib/theme'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Blocs",
  description: "The schedule that works for you",
  manifest: '/manifest.json',
};

export async function generateViewport(): Promise<Viewport> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // Not logged in → Blocs defaults
  if (!user) {
    return { themeColor: THEME_PALETTES.dark.blue.base }
  }
  const { data: trainer } = await supabase
    .from('trainers')
    .select('theme_color, theme_surface')
    .eq('auth_user_id', user.id)
    .single()
  const surface = isThemeSurface(trainer?.theme_surface)
    ? trainer.theme_surface
    : DEFAULT_THEME_SURFACE
  const color = isThemeColorKey(trainer?.theme_color)
    ? trainer.theme_color
    : DEFAULT_THEME_COLOR
  // Status bar / browser chrome → accent
  return {
    themeColor: THEME_PALETTES[surface][color].base,
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
