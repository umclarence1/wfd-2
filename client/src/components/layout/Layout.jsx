import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import Navbar from './Navbar';
import Footer from './Footer';
import WhatsAppFloat from './WhatsAppFloat';
import OfflineBanner from '../pwa/OfflineBanner';
import { useSocket } from '../../hooks/useSocket';
import { useSwipeBack } from '../../hooks/useSwipeBack';
import { packagesQueryOptions } from '../../hooks/usePackages';
import { useOnlineStatus } from '../../context/OnlineContext';

export default function Layout() {
  useSocket();
  useSwipeBack();
  const queryClient = useQueryClient();
  const { isOnline } = useOnlineStatus();

  useEffect(() => {
    queryClient.prefetchQuery(packagesQueryOptions);
    queryClient.prefetchQuery({
      queryKey: ['sliders'],
      queryFn: () => api.get('/public/sliders').then((r) => r.data.sliders),
      staleTime: 5 * 60 * 1000,
    });
  }, [queryClient]);

  return (
    <div className="flex min-h-screen flex-col">
      <OfflineBanner />
      <Navbar />
      <main className={`flex-1 ${isOnline ? 'pt-[4.25rem]' : 'pt-[6.75rem]'}`}>
        <Outlet />
      </main>
      <Footer />
      <WhatsAppFloat />
    </div>
  );
}
