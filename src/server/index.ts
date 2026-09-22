import "dotenv/config";
import { createApp } from "./app.js";
const app = await createApp({ logger: true });
const port = Number(process.env.PORT || 3279);
await app.listen({ port, host: process.env.HOST || "127.0.0.1" });
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
