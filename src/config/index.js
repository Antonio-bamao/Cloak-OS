import { AppError } from '../utils/errors.js';

export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000000';

export function getConfig(env = process.env) {
  return {
    server: {
      host: env.HOST ?? '0.0.0.0',
      port: Number(env.PORT ?? 3000)
    },
    detection: {
      suspiciousThreshold: Number(env.MIN_CONFIDENCE ?? 60),
      botThreshold: Number(env.BOT_CONFIDENCE ?? 80),
      botIps: parseCsv(env.BOT_IPS)
    },
    auth: {
      adminToken: env.ADMIN_TOKEN ?? 'dev-admin-token'
    },
    repository: {
      driver: env.REPOSITORY_DRIVER ?? 'memory',
      databaseUrl: env.DATABASE_URL ?? ''
    }
  };
}

export const config = getConfig();

export function validateConfig(runtimeConfig) {
  const errors = [];

  if (!runtimeConfig.server?.host) {
    errors.push('server.host is required');
  }

  if (!Number.isInteger(runtimeConfig.server?.port) || runtimeConfig.server.port < 0 || runtimeConfig.server.port > 65535) {
    errors.push('server.port must be an integer between 0 and 65535');
  }

  if (!isPercentage(runtimeConfig.detection?.suspiciousThreshold)) {
    errors.push('detection.suspiciousThreshold must be between 1 and 100');
  }

  if (!isPercentage(runtimeConfig.detection?.botThreshold)) {
    errors.push('detection.botThreshold must be between 1 and 100');
  }

  if (!runtimeConfig.auth?.adminToken) {
    errors.push('auth.adminToken is required');
  }

  if (!['memory', 'postgres'].includes(runtimeConfig.repository?.driver)) {
    errors.push('repository.driver must be memory or postgres');
  }

  if (runtimeConfig.repository?.driver === 'postgres' && !runtimeConfig.repository?.databaseUrl) {
    errors.push('repository.databaseUrl is required when repository.driver is postgres');
  }

  if (errors.length > 0) {
    throw new AppError(errors.join('; '), 500, 'CONFIG_INVALID');
  }

  return runtimeConfig;
}

export function mergeConfig(baseConfig, overrideConfig = {}) {
  return {
    ...baseConfig,
    ...overrideConfig,
    server: {
      ...baseConfig.server,
      ...overrideConfig.server
    },
    detection: {
      ...baseConfig.detection,
      ...overrideConfig.detection
    },
    auth: {
      ...baseConfig.auth,
      ...overrideConfig.auth
    },
    repository: {
      ...baseConfig.repository,
      ...overrideConfig.repository
    }
  };
}

function parseCsv(value = '') {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isPercentage(value) {
  return Number.isInteger(value) && value >= 1 && value <= 100;
}
