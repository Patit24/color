import http from "node:http";
import { Server } from "socket.io";
import { connectMongo } from "./config/db.js";
import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { corsOriginResolver } from "./config/cors.js";
import { registerSocketHandlers } from "./socket/index.js";
import { GameEngine } from "./services/gameEngine.js";
import { seedDefaultAccounts } from "./services/bootstrapService.js";

async function bootstrap() {
  await connectMongo();
  await seedDefaultAccounts();
  const app = createApp();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: corsOriginResolver,
      credentials: true
    }
  });

  registerSocketHandlers(io);
  const engine = new GameEngine(io);
  engine.start();

  server.listen(env.PORT, () => {
    console.log(`API and realtime engine running on :${env.PORT}`);
  });

  process.on("SIGTERM", () => {
    engine.stop();
    server.close(() => process.exit(0));
  });
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
