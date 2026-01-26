/**
 * Configuration
 * Environment variables and app config
 */

import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

// Load environment variables
loadDotenv({ path: '.env.local' });

const envSchema = z.object({
  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // LLM
  OPENAI_API_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),

  // Google (optional for now)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_KEY: z.string().optional(),
  GOOGLE_DRIVE_FOLDER_ID: z.string().optional(),

  // WhatsApp (optional for now)
  GREENAPI_INSTANCE_ID: z.string().optional(),
  GREENAPI_API_TOKEN: z.string().optional(),

  // ClickUp (optional)
  CLICKUP_API_TOKEN: z.string().optional(),
  CLICKUP_WORKSPACE_ID: z.string().optional(),

  // Apify (optional)
  APIFY_TOKEN: z.string().optional(),

  // App
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  DEFAULT_USER_EMAIL: z.string().email().optional(),

  // API Server
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  
  // Auth
  JWT_SECRET: z.string().optional(),
  COOKIE_SECRET: z.string().optional(),
  ALLOWED_DOMAIN: z.string().default('ldrsgroup.com'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
});

type EnvConfig = z.infer<typeof envSchema>;

let cachedConfig: EnvConfig | null = null;

export function getConfig(): EnvConfig {
  if (cachedConfig) return cachedConfig;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Invalid environment configuration:');
    console.error(result.error.format());
    throw new Error('Invalid environment configuration');
  }

  cachedConfig = result.data;
  return cachedConfig;
}

// Export config as a convenience alias
export const config = getConfig();

// Google Service Account helper
export function getGoogleServiceAccountKey() {
  const keyString = config.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyString) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not configured');
  }
  
  try {
    return JSON.parse(keyString);
  } catch (error) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON');
  }
}

// App constants
export const APP_CONFIG = {
  // Job Queue
  MAX_RETRIES: 2,
  JOB_TIMEOUT_MS: 60000,

  // LLM
  DEFAULT_TEMPERATURE: 0.3,
  MAX_TOKENS: 4096,

  // Knowledge
  CHUNK_SIZE: 1000,
  CHUNK_OVERLAP: 200,
  TOP_K_CHUNKS: 5,
  EMBEDDING_DIMENSION: 1536,

  // Routing
  DEFAULT_CONFIDENCE_THRESHOLD: 0.6,

  // Quality
  MIN_VALIDATION_SCORE: 0.7,
} as const;

