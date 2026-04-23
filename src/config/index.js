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
    }
  };
}

export const config = getConfig();

function parseCsv(value = '') {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
