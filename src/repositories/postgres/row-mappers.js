export const CAMPAIGN_COLUMNS = [
  'id',
  'tenant_id',
  'name',
  'safe_url',
  'money_url',
  'redirect_mode',
  'created_at',
  'updated_at'
].join(', ');

export const ACCESS_LOG_COLUMNS = [
  'id',
  'tenant_id',
  'campaign_id',
  'ip_address',
  'user_agent',
  'verdict',
  'action',
  'confidence',
  'detection_reasons',
  'created_at',
  'updated_at'
].join(', ');

export function mapCampaignRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    safeUrl: row.safe_url,
    moneyUrl: row.money_url,
    redirectMode: row.redirect_mode,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

export function mapAccessLogRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    tenantId: row.tenant_id,
    campaignId: row.campaign_id,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    verdict: row.verdict,
    action: row.action,
    confidence: row.confidence,
    detectionReasons: normalizeJsonArray(row.detection_reasons),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function toIso(value) {
  return value instanceof Date ? value.toISOString() : value;
}

function normalizeJsonArray(value) {
  if (Array.isArray(value)) {
    return [...value];
  }

  if (typeof value === 'string') {
    return JSON.parse(value);
  }

  return [];
}
