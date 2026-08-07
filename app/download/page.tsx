'use client';

import { useState, useEffect, useSyncExternalStore } from 'react';
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


  if (installed) {
    return (
      <div>
        <h1>You&apos;re all set!</h1>
        <p>The app is already installed on this device.</p>
      </div>
    );
  }

  return (
    <div>
      <h1>Get the app</h1>
      <p>Install [Your App] for quick access to your schedule — no App Store needed.</p>

      {deferredPrompt && (
        <button onClick={handleInstallClick}>
          Install app
        </button>
      )}

      {!deferredPrompt && platform === 'ios' && (
        <div>
          <h3>On iPhone/iPad:</h3>
          <ol>
            <li>Open this page in Safari (not Chrome)</li>
            <li>Tap the Share icon (square with an arrow) at the bottom of the screen</li>
            <li>Scroll down and tap &apos;Add to Home Screen&apos;</li>
            <li>Tap &apos;Add&apos; in the top right</li>
          </ol>
        </div>
      )}

      {!deferredPrompt && platform === 'android' && (
        <div>
          <h3>On Android:</h3>
          <ol>
            <li>Tap the ⋮ menu in the top right of your browser</li>
            <li>Tap &apos;Install app&apos; or &apos;Add to Home Screen&apos;</li>
          </ol>
        </div>
      )}

      {!deferredPrompt && platform === 'desktop' && (
        <div>
          <h3>On Desktop (Chrome/Edge):</h3>
          <ol>
            <li>Look for the install icon (⊕) in your browser&apos;s address bar</li>
            <li>Click it, then click &apos;Install&apos;</li>
          </ol>
          <p>If you don&apos;t see the icon, your browser may not support installing apps — Chrome or Edge work best.</p>
        </div>
      )}
    </div>
  );
}