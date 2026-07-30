import { useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export default function PwaUpdateNotifier() {
  const notifiedRef = useRef(false);
  const registrationRef = useRef(null);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      registrationRef.current = registration;
      if (registration) {
        registration.update();
        // Keep looking for a new build while the app is open (especially on phones).
        setInterval(() => {
          registration.update().catch(() => {});
        }, 30_000);
      }
    },
    onRegisterError(error) {
      console.error('Service worker registration failed:', error);
    },
  });

  useEffect(() => {
    const onVisible = () => {
      registrationRef.current?.update().catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  useEffect(() => {
    if (!needRefresh || notifiedRef.current) return;
    notifiedRef.current = true;
    updateServiceWorker(true).then(() => {
      window.location.reload();
    });
  }, [needRefresh, updateServiceWorker]);

  return null;
}
