export const databaseSchema = {
  tables: {
    campaigns: {
      tableName: 'campaigns',
      columns: {
        id: { type: 'uuid', primaryKey: true },
        tenantId: { type: 'uuid', nullable: false },
        name: { type: 'text', nullable: false },
        safeUrl: { type: 'text', nullable: false },
        moneyUrl: { type: 'text', nullable: false },
        redirectMode: { type: 'enum(redirect,iframe,loading)', nullable: false },
        createdAt: { type: 'timestamptz', nullable: false },
        updatedAt: { type: 'timestamptz', nullable: false }
      },
      indexes: [
        { name: 'idx_campaigns_tenant_created', columns: ['tenantId', 'createdAt'] }
      ]
    },
    accessLogs: {
      tableName: 'access_logs',
      partitionBy: 'createdAt monthly',
      columns: {
        id: { type: 'uuid', primaryKey: true },
        tenantId: { type: 'uuid', nullable: false },
        campaignId: { type: 'uuid', nullable: false },
        ipAddress: { type: 'inet', nullable: false },
        userAgent: { type: 'text', nullable: false },
        verdict: { type: 'enum(bot,human,suspicious)', nullable: false },
        action: { type: 'enum(safe,money,block)', nullable: false },
        confidence: { type: 'integer', nullable: false },
        detectionReasons: { type: 'jsonb', nullable: false },
        createdAt: { type: 'timestamptz', nullable: false },
        updatedAt: { type: 'timestamptz', nullable: false }
      },
      indexes: [
        { name: 'idx_access_logs_campaign_created', columns: ['campaignId', 'createdAt'] },
        { name: 'idx_access_logs_ip', columns: ['ipAddress'] }
      ]
    }
  }
};
