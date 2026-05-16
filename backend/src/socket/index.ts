import type { Server } from "socket.io";

export function registerSocketHandlers(io: Server) {
  io.use((socket, next) => {
    socket.data.deviceFingerprint = socket.handshake.headers["x-device-fingerprint"] || "unknown";
    next();
  });

  io.on("connection", (socket) => {
    socket.emit("online_users", io.engine.clientsCount);

    socket.on("join_round", (gameMode: string) => {
      socket.join(`game:${gameMode}`);
    });

    socket.on("leave_round", (gameMode: string) => {
      socket.leave(`game:${gameMode}`);
    });

    socket.on("subscribe_wallet", (userId: string) => {
      socket.join(`wallet:${userId}`);
    });

    socket.on("disconnect", () => {
      io.emit("online_users", io.engine.clientsCount);
    });
  });
}
