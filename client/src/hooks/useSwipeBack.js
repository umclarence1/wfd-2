import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const EDGE_ZONE = 28;
const MIN_SWIPE = 70;
const MAX_VERTICAL = 60;

/**
 * iPhone-style swipe from the left edge to go back in history.
 */
export function useSwipeBack() {
  const navigate = useNavigate();
  const location = useLocation();
  const startRef = useRef(null);

  useEffect(() => {
    if (location.pathname === '/') return undefined;

    const onTouchStart = (e) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      if (touch.clientX > EDGE_ZONE) {
        startRef.current = null;
        return;
      }
      startRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        startedAt: Date.now(),
      };
    };

    const onTouchMove = (e) => {
      const start = startRef.current;
      if (!start || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const dx = touch.clientX - start.x;
      const dy = Math.abs(touch.clientY - start.y);
      // Lock horizontal edge swipe so the page doesn’t scroll vertically mid-gesture.
      if (dx > 12 && dy < MAX_VERTICAL && e.cancelable) {
        e.preventDefault();
      }
    };

    const onTouchEnd = (e) => {
      const start = startRef.current;
      startRef.current = null;
      if (!start) return;

      const touch = e.changedTouches[0];
      if (!touch) return;

      const dx = touch.clientX - start.x;
      const dy = Math.abs(touch.clientY - start.y);
      const elapsed = Date.now() - start.startedAt;

      if (dx >= MIN_SWIPE && dy < MAX_VERTICAL && elapsed < 800) {
        if (window.history.length > 1) {
          navigate(-1);
        } else {
          navigate('/');
        }
      }
    };

    const onTouchCancel = () => {
      startRef.current = null;
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onTouchCancel, { passive: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [location.pathname, navigate]);
}
