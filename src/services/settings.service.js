export class SettingsService {
  constructor({ config }) {
    if (!config) {
      throw new TypeError('SettingsService requires config');
    }

    this.config = config;
  }

  getSettings() {
    const botIps = this.config.detection?.botIps ?? [];

    return {
      server: {
        host: this.config.server?.host,
        port: this.config.server?.port
      },
      detection: {
        suspiciousThreshold: this.config.detection?.suspiciousThreshold,
        botThreshold: this.config.detection?.botThreshold,
        botIpCount: botIps.length,
        botIps: [...botIps]
      },
      repository: {
        driver: this.config.repository?.driver,
        databaseConfigured: Boolean(this.config.repository?.databaseUrl)
      },
      auth: {
        adminTokenConfigured: Boolean(this.config.auth?.adminToken)
      },
      notes: [
        '系统设置来自环境变量，修改后需要重启服务。',
        'ADMIN_TOKEN 和 DATABASE_URL 不会在管理 API 中返回明文。'
      ]
    };
  }
}
