'use client';

import Image from 'next/image';
import { useState, useEffect, useSyncExternalStore } from 'react';
import { getThemeCssVars, DEFAULT_THEME_COLOR, DEFAULT_THEME_SURFACE } from '@/lib/theme';

function getPlatform(): 'ios' | 'android' | 'desktop' | 'unknown' {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}
function getInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches;
}
export default function DownloadPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const platform = useSyncExternalStore(
    () => () => {},
    getPlatform,
    () => 'unknown' as const
  );
  const installedFromDisplay = useSyncExternalStore(
    () => () => {},
    getInstalled,
    () => false
  );
  const [installed, setInstalled] = useState(false);
  const isInstalled = installed || installedFromDisplay;
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e); // OK: setState in an event callback
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
  const handleInstallClick = async () => {
    if (!deferredPrompt || !('prompt' in deferredPrompt)) return;
    const promptEvent = deferredPrompt as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: string }>;
    };
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <div className="blocs-theme blocs-page" style={getThemeCssVars(DEFAULT_THEME_COLOR, DEFAULT_THEME_SURFACE)}>
      <div className="blocs-brand">
        <div className="blocs-brand-row">
          <Image src="/blocs-logo.svg" alt="Blocs" width={100} height={100} />
        </div>
        <p className="blocs-brand-tagline">Book by the block.</p>
      </div>

      {isInstalled ? (
        <div className="blocs-card flex flex-col items-center" style={{ padding: '40px 32px', gap: '24px' }}>
          <div className="blocs-check-circle">
            <div className="blocs-check-mark" />
          </div>
          <div className="flex flex-col gap-1.5" style={{ alignItems: 'center', textAlign: 'center' }}>
            <h1 style={{ margin: 0, color: 'var(--blocs-text)', fontSize: '22px', fontWeight: 700 }}>You&apos;re all set</h1>
            <p style={{ margin: 0, color: 'var(--blocs-text-50)', fontSize: '13.5px' }}>The app is already installed on this device.</p>
          </div>
        </div>
      ) : (
        <div className="blocs-card flex flex-col gap-4" style={{ padding: '32px 24px' }}>
          <div className="flex flex-col gap-1.5" style={{ textAlign: 'center' }}>
            <h1 style={{ margin: 0, color: 'var(--blocs-text)', fontSize: '20px', fontWeight: 700, letterSpacing: '-0.01em' }}>
              Get the app
            </h1>
            <p style={{ margin: 0, color: 'var(--blocs-text-50)', fontSize: '13.5px' }}>
              Install Blocs for quick access to your schedule — no App Store needed.
            </p>
          </div>

          {deferredPrompt && (
            <button className="blocs-btn-primary" onClick={handleInstallClick}>
              Install app
            </button>
          )}

          {!deferredPrompt && platform === 'ios' && (
            <div className="flex flex-col gap-2">
              <h3 style={{ margin: 0, color: 'var(--blocs-text)', fontSize: '14.5px', fontWeight: 700 }}>On iPhone/iPad</h3>
              <ol style={{ margin: 0, paddingLeft: '20px', color: 'var(--blocs-text-60)', fontSize: '13.5px', lineHeight: 1.6 }}>
                <li>Open this page in Safari (not Chrome)</li>
                <li>Tap the Share icon (square with an arrow) at the bottom of the screen</li>
                <li>Scroll down and tap &apos;Add to Home Screen&apos;</li>
                <li>Tap &apos;Add&apos; in the top right</li>
              </ol>
            </div>
          )}

          {!deferredPrompt && platform === 'android' && (
            <div className="flex flex-col gap-2">
              <h3 style={{ margin: 0, color: 'var(--blocs-text)', fontSize: '14.5px', fontWeight: 700 }}>On Android</h3>
              <ol style={{ margin: 0, paddingLeft: '20px', color: 'var(--blocs-text-60)', fontSize: '13.5px', lineHeight: 1.6 }}>
                <li>Tap the ⋮ menu in the top right of your browser</li>
                <li>Tap &apos;Install app&apos; or &apos;Add to Home Screen&apos;</li>
              </ol>
            </div>
          )}

          {!deferredPrompt && platform === 'desktop' && (
            <div className="flex flex-col gap-2">
              <h3 style={{ margin: 0, color: 'var(--blocs-text)', fontSize: '14.5px', fontWeight: 700 }}>On Desktop (Chrome/Edge)</h3>
              <ol style={{ margin: 0, paddingLeft: '20px', color: 'var(--blocs-text-60)', fontSize: '13.5px', lineHeight: 1.6 }}>
                <li>Look for the install icon (⊕) in your browser&apos;s address bar</li>
                <li>Click it, then click &apos;Install&apos;</li>
              </ol>
              <p style={{ margin: 0, color: 'var(--blocs-text-40)', fontSize: '12.5px' }}>
                If you don&apos;t see the icon, your browser may not support installing apps — Chrome or Edge work best.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
