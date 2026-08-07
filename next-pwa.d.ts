declare module 'next-pwa' {
  import type { NextConfig } from 'next'

  type PWAOptions = {
    dest?: string
    disable?: boolean
    register?: boolean
    scope?: string
    sw?: string
    skipWaiting?: boolean
    [key: string]: unknown
  }

  export default function withPWA(
    options?: PWAOptions
  ): (config: NextConfig) => NextConfig
}
