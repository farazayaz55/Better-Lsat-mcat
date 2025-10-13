interface AppConfig {
  env: string | undefined;
  port: string | undefined;
  database: {
    host: string | undefined;
    port: number | undefined;
    name: string | undefined;
    user: string | undefined;
    pass: string | undefined;
  };
  jwt: {
    publicKey: string;
    privateKey: string;
    accessTokenExpiresInSec: number;
    refreshTokenExpiresInSec: number;
  };
  defaultAdminUserPassword: string | undefined;
  googleCalendar: {
    clientId: string | undefined;
    clientSecret: string | undefined;
    redirectUri: string | undefined;
    accessToken: string | undefined;
    refreshToken: string | undefined;
    calendarId: string | undefined;
    businessOwnerEmail: string | undefined;
    defaultTimezone: string | undefined;
  };
}

export default (): AppConfig => ({
  env: process.env.APP_ENV,
  port: process.env.APP_PORT,
  database: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT
      ? Number.parseInt(process.env.DB_PORT, 10)
      : undefined,
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    pass: process.env.DB_PASS,
  },
  jwt: {
    publicKey: Buffer.from(
      process.env.JWT_PUBLIC_KEY_BASE64!,
      'base64',
    ).toString('utf8'),
    privateKey: Buffer.from(
      process.env.JWT_PRIVATE_KEY_BASE64!,
      'base64',
    ).toString('utf8'),
    accessTokenExpiresInSec: Number.parseInt(
      process.env.JWT_ACCESS_TOKEN_EXP_IN_SEC!,
      10,
    ),
    refreshTokenExpiresInSec: Number.parseInt(
      process.env.JWT_REFRESH_TOKEN_EXP_IN_SEC!,
      10,
    ),
  },
  defaultAdminUserPassword: process.env.DEFAULT_ADMIN_USER_PASSWORD,
  googleCalendar: {
    clientId: process.env.VITE_GOOGLE_CLIENT_ID,
    clientSecret: process.env.VITE_GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.VITE_GOOGLE_REDIRECT_URI,
    accessToken: process.env.GOOGLE_ACCESS_TOKEN,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
    calendarId: process.env.GOOGLE_CALENDAR_ID,
    businessOwnerEmail: process.env.GOOGLE_BUSINESS_OWNER_EMAIL,
    defaultTimezone: process.env.VITE_DEFAULT_TIMEZONE,
  },
});
