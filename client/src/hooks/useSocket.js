import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';

// Socket.io needs a persistent Node server. Vercel serverless API does not support it.
const SOCKET_ENABLED = import.meta.env.VITE_ENABLE_SOCKETIO === 'true';
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.DEV ? 'http://localhost:5000' : '');

export const useSocket = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!SOCKET_ENABLED || !SOCKET_URL) return undefined;

    const socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 3,
    });

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
