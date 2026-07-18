'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function ConfirmationRedirect({ redirectTo }: { redirectTo: string }) {
  const router = useRouter()

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace(redirectTo)
    }, 5000)
    return () => clearTimeout(timer)
  }, [redirectTo, router])

  return null
}
