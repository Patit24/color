import type { Server } from "socket.io";
import type { CrashEngine } from "../services/crashEngine.js";
import { verifyAccessToken } from "../utils/tokens.js";

export function registerSocketHandlers(io: Server, crashEngine?: CrashEngine) {
  io.use((socket, next) => {
    socket.data.deviceFingerprint = socket.handshake.headers["x-device-fingerprint"] || "unknown";
    next();
  });

  io.on("connection", (socket) => {
    socket.emit("online_users", io.engine.clientsCount);

    // ─── Color Game ──────────────────────────────
    socket.on("join_round", (gameMode: string) => {
      socket.join(`game:${gameMode}`);
    });

    socket.on("leave_round", (gameMode: string) => {
      socket.leave(`game:${gameMode}`);
    });

    socket.on("subscribe_wallet", (userId: string) => {
      socket.join(`wallet:${userId}`);
    });

    // ─── Crash Game ──────────────────────────────
    socket.on("crash:join", () => {
      socket.join("crash");
    });

    socket.on("crash:leave", () => {
      socket.leave("crash");
    });

    socket.on("crash:place_bet", async (data: { amount: number; autoCashout: number; token: string }) => {
      try {
        const payload = verifyAccessToken(data.token);
        const bet = await crashEngine?.placeBet(
          payload.userId,
          data.amount,
          data.autoCashout || 0,
          socket.data.deviceFingerprint,
          socket.handshake.address
        );
        socket.emit("crash:bet_confirmed", { bet });
        socket.join(`wallet:${payload.userId}`);
      } catch (err) {
        socket.emit("crash:error", { message: err instanceof Error ? err.message : "Bet failed" });
      }
    });

    socket.on("crash:cashout", async (data: { token: string }) => {
      try {
        const payload = verifyAccessToken(data.token);
        const result = await crashEngine?.cashout(payload.userId);
        socket.emit("crash:cashout_success", result);
      } catch (err) {
        socket.emit("crash:error", { message: err instanceof Error ? err.message : "Cashout failed" });
      }
    });

    socket.on("disconnect", () => {
      io.emit("online_users", io.engine.clientsCount);
    });
  });
}
