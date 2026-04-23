export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000000';

export const config = {
  detection: {
    suspiciousThreshold: Number(process.env.MIN_CONFIDENCE ?? 60),
    botThreshold: Number(process.env.BOT_CONFIDENCE ?? 80)
  }
};
