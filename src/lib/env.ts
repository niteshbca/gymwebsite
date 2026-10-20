const req = (k: string, fallback = "") => process.env[k] ?? fallback;

export const env = {
  MONGODB_URI: req("MONGODB_URI", "mongodb://127.0.0.1:27017/fitpro"),
  JWT_ACCESS_SECRET: req("JWT_ACCESS_SECRET", "dev-access-secret-do-not-use-in-production-0123456789"),
  JWT_REFRESH_SECRET: req("JWT_REFRESH_SECRET", "dev-refresh-secret-do-not-use-in-production-0123456789"),
  ACCESS_TOKEN_TTL: req("ACCESS_TOKEN_TTL", "15m"),
  REFRESH_TOKEN_TTL: req("REFRESH_TOKEN_TTL", "7d"),
  COOKIE_SECURE: req("COOKIE_SECURE", "false") === "true",
  APP_URL: req("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),
  TIMEZONE: req("APP_TIMEZONE", "Asia/Kolkata"),
  CURRENCY: req("DEFAULT_CURRENCY", "INR"),
  SMTP_HOST: req("SMTP_HOST"),
  SMTP_PORT: Number(req("SMTP_PORT", "587")),
  SMTP_USER: req("SMTP_USER"),
  SMTP_PASS: req("SMTP_PASS"),
  SMTP_FROM: req("SMTP_FROM", "NiteshPro <no-reply@niteshpro.in>"),
  UPLOAD_DRIVER: req("UPLOAD_DRIVER", "local"),
  PAYMENT_GATEWAY: req("PAYMENT_GATEWAY", "manual"),
  PAYMENT_WEBHOOK_SECRET: req("PAYMENT_WEBHOOK_SECRET"),
  ENABLE_SCHEDULER: req("ENABLE_SCHEDULER", "true") === "true",
  EXPIRY_REMINDER_WINDOWS_DAYS: req("EXPIRY_REMINDER_WINDOWS_DAYS", "7,3,1")
    .split(",")
    .map((n) => Number(n.trim()))
    .filter((n) => Number.isFinite(n) && n > 0),
  RATE_LIMIT_LOGIN_PER_MIN: Number(req("RATE_LIMIT_LOGIN_PER_MIN", "5")),
};

export const isProd = process.env.NODE_ENV === "production";
export const usesRealSmtp = Boolean(env.SMTP_HOST);
