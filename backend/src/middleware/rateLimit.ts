import rateLimit from "express-rate-limit";

export const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false
});

export const authLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false
});

export const bettingLimiter = rateLimit({
  windowMs: 10_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false
});
