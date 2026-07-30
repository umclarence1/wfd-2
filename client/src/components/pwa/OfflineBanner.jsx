import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../context/OnlineContext';
import { OFFLINE_BANNER_MESSAGE } from '../../utils/offline';

export default function OfflineBanner() {
  const { isOnline } = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-amber-500 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-md"
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{OFFLINE_BANNER_MESSAGE}</span>
    </div>
  );
}
