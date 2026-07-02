import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.DEV ? 'http://localhost:5000' : 'https://server-mu-six-92.vercel.app');

export const useSocket = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!SOCKET_URL) return undefined;

    const socket = io(SOCKET_URL, { withCredentials: true, transports: ['websocket', 'polling'] });

    socket.on('packages:refresh', () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] });
    });

    socket.on('package:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] });
    });

    socket.on('sliders:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['sliders'] });
    });

    socket.on('settings:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
    });

    return () => socket.disconnect();
  }, [queryClient]);
};
