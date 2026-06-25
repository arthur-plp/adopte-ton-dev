"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

/**
 * Connexion Socket.IO unique vers la Gateway (push serveur→client uniquement,
 * cf. CLAUDE.md §15). Réutilisée entre les composants qui montent/démontent
 * au fil de la navigation (pas de layout partagé dans cette app) plutôt que
 * de rouvrir une connexion à chaque changement de page.
 */
function getRealtimeSocket(): Socket {
  if (!socket) {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
    const gatewayOrigin = apiUrl.replace(/\/api\/v1\/?$/, "");
    socket = io(gatewayOrigin, { withCredentials: true });
  }
  return socket;
}

export function useRealtimeEvent<T = unknown>(
  event: string,
  handler: (payload: T) => void,
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const s = getRealtimeSocket();
    const listener = (payload: T) => handlerRef.current(payload);
    s.on(event, listener);
    return () => {
      s.off(event, listener);
    };
  }, [event]);
}
