import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { WHATSAPP_GROUP_URL } from '../../constants/brand';

const DISMISS_KEY = 'wds_whatsapp_channel_dismissed';

function WhatsAppIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

const PERKS = [
  'Flash deals and price drops',
  'Order and delivery announcements',
  'Free to follow — no private chats',
];

export default function WhatsAppChannelPrompt() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const hideOnRoute = location.pathname.startsWith('/payment');

  useEffect(() => {
    if (hideOnRoute) return undefined;
    if (sessionStorage.getItem(DISMISS_KEY) === '1') return undefined;
    const timer = window.setTimeout(() => setOpen(true), 700);
    return () => window.clearTimeout(timer);
  }, [hideOnRoute]);

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setOpen(false);
  };

  if (!open || hideOnRoute) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="whatsapp-channel-title"
        className="relative w-full max-w-md overflow-hidden rounded-[28px] bg-[#141414] text-white shadow-2xl"
      >
        <div className="relative bg-gradient-to-b from-[#3DDC84] to-[#1FAF5A] px-6 pb-8 pt-6 text-center">
          <button
            type="button"
            onClick={dismiss}
            className="absolute right-4 top-4 rounded-full p-1 text-white/90 hover:bg-white/15"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[22px] bg-white text-[#25D366] shadow-lg">
            <WhatsAppIcon className="h-11 w-11" />
          </div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.28em] text-white/95">
            WhatsApp Channel
          </p>
        </div>

        <div className="px-6 pb-6 pt-7">
          <h2 id="whatsapp-channel-title" className="font-serif text-[1.85rem] font-semibold leading-tight tracking-tight">
            Follow Wilberforce for updates
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-neutral-400">
            One tap to join our official channel — deals, alerts, and support news in one place.
          </p>

          <ul className="mt-5 space-y-3.5 rounded-2xl border border-white/10 bg-black px-4 py-4">
            {PERKS.map((perk) => (
              <li key={perk} className="flex items-center gap-3 text-[15px] font-medium text-neutral-100">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M5 12.5l4.2 4.2L19 7.5" />
                  </svg>
                </span>
                {perk}
              </li>
            ))}
          </ul>

          <a
            href={WHATSAPP_GROUP_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={dismiss}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-3.5 text-base font-bold text-white shadow-[0_8px_24px_rgba(37,211,102,0.35)] hover:bg-[#1ebe5d]"
          >
            <WhatsAppIcon className="h-5 w-5" />
            Join WhatsApp Channel
          </a>
          <button
            type="button"
            onClick={dismiss}
            className="mt-4 w-full py-1 text-sm font-medium text-neutral-500 hover:text-neutral-300"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
