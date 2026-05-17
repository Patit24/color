import { env } from "./env.js";

const allowedOrigins = [
  env.CLIENT_ORIGIN,
  "http://localhost",
  "https://localhost",
  "capacitor://localhost"
];

/**
 * Determines whether a given origin is allowed to access the backend API.
 */
export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true; // Allow mobile native HTTP clients, curl, postman, etc.
  
  return (
    allowedOrigins.includes(origin) ||
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:") ||
    origin.startsWith("http://192.168.") // Allow local Wi-Fi IP ranges for testing built APKs
  );
}

/**
 * CORS origin resolver callback for Express cors middleware.
 */
export function corsOriginResolver(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
) {
  if (isOriginAllowed(origin)) {
    callback(null, true);
  } else {
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  }
}
