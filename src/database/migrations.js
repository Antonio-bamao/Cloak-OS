export function createInitialMigrationSql() {
  return [
    `CREATE TABLE campaigns (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  safe_url TEXT NOT NULL,
  money_url TEXT NOT NULL,
  redirect_mode TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);`,
    `CREATE INDEX idx_campaigns_tenant_created
  ON campaigns (tenant_id, created_at);`,
    `CREATE TABLE access_logs (
  id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  campaign_id UUID NOT NULL,
  ip_address INET NOT NULL,
  user_agent TEXT NOT NULL,
  verdict TEXT NOT NULL,
  action TEXT NOT NULL,
  confidence INTEGER NOT NULL,
  detection_reasons JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);`,
    `CREATE INDEX idx_access_logs_campaign_created
  ON access_logs (campaign_id, created_at);`,
    `CREATE INDEX idx_access_logs_ip
  ON access_logs (ip_address);`
  ].join('\n\n');
}
