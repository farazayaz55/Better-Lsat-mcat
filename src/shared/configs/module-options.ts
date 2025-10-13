import { ConfigModuleOptions } from '@nestjs/config/dist/interfaces';
import * as Joi from 'joi';

import configuration from './configuration';

export const configModuleOptions: ConfigModuleOptions = {
  envFilePath: '.env',
  load: [configuration],
  validationSchema: Joi.object({
    APP_ENV: Joi.string()
      .valid('development', 'production', 'test')
      .default('development'),
    APP_PORT: Joi.number().required(),
    DB_HOST: Joi.string().required(),
    DB_PORT: Joi.number().optional(),
    DB_NAME: Joi.string().required(),
    DB_USER: Joi.string().required(),
    DB_PASS: Joi.string().required(),
    JWT_PUBLIC_KEY_BASE64: Joi.string().required(),
    JWT_PRIVATE_KEY_BASE64: Joi.string().required(),
    JWT_ACCESS_TOKEN_EXP_IN_SEC: Joi.number().required(),
    JWT_REFRESH_TOKEN_EXP_IN_SEC: Joi.number().required(),
    DEFAULT_ADMIN_USER_PASSWORD: Joi.string().required(),
    STRIPE_SECRET_KEY: Joi.string().required(),
    STRIPE_WEBHOOK_SECRET: Joi.string().required(),
    STRIPE_PUBLISHABLE_KEY: Joi.string().required(),
    FRONTEND_URL: Joi.string().required(),
    VITE_GOOGLE_CLIENT_ID: Joi.string().required(),
    VITE_GOOGLE_CLIENT_SECRET: Joi.string().required(),
    VITE_GOOGLE_REDIRECT_URI: Joi.string().required(),
    GOOGLE_ACCESS_TOKEN: Joi.string().optional(),
    GOOGLE_REFRESH_TOKEN: Joi.string().optional(),
    GOOGLE_CALENDAR_ID: Joi.string().required(),
    GOOGLE_BUSINESS_OWNER_EMAIL: Joi.string().email().required(),
    VITE_DEFAULT_TIMEZONE: Joi.string().default('America/New_York'),
  }),
};
