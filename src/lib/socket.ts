import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket() {
  if (!socket) {
    const isDev = process.env.NODE_ENV === "development";
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || (
      isDev
        ? "http://localhost:8080"
        : "https://color-backend-api.onrender.com"
    );
    socket = io(socketUrl, {
      autoConnect: false,
      transports: ["websocket"],
      extraHeaders: {
        "x-device-fingerprint":
          typeof window === "undefined"
            ? "server"
            : window.localStorage.getItem("colorProDeviceFingerprint") || "unknown",
      },
    });
  }

  return socket;
}

export const realtimeEvents = {
  client: ["join_round", "place_bet", "subscribe_wallet"],
  server: ["countdown_update", "result_declared", "wallet_update", "bet_status"],
};
