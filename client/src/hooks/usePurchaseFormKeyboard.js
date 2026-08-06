import { useEffect, useRef, useState } from 'react';

/**
 * Keeps purchase-form fields visible above the mobile soft keyboard.
 * Uses visualViewport inset + delayed scrollIntoView (iOS-friendly).
 */
export function usePurchaseFormKeyboard() {
  const formRef = useRef(null);
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;

    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      // Ignore tiny chrome changes; treat ~80px+ as keyboard open.
      const next = inset > 80 ? inset : 0;
      setKeyboardInset(next);
      document.documentElement.classList.toggle('keyboard-open', next > 0);
    };

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('orientationchange', update);
    update();

    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('orientationchange', update);
      document.documentElement.classList.remove('keyboard-open');
    };
  }, []);

  const onFieldFocus = (event) => {
    const el = event.currentTarget;
    if (!el) return;

    const scroll = () => {
      // Keep the focused field in the visible area above the keyboard.
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      // Also nudge the form container if present (helps Android Chrome).
      formRef.current?.scrollIntoView?.({ block: 'nearest' });
    };

    // Soft keyboards open after focus; retry so the field stays on-screen.
    requestAnimationFrame(() => {
      scroll();
      window.setTimeout(scroll, 150);
      window.setTimeout(scroll, 350);
      window.setTimeout(scroll, 550);
    });
  };

  return { formRef, keyboardInset, onFieldFocus, keyboardOpen: keyboardInset > 0 };
}
