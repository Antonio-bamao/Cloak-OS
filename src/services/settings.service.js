import { AppError } from '../utils/errors.js';

export class SettingsService {
  constructor({ config, botIpSource } = {}) {
    if (!config) {
      throw new TypeError('SettingsService requires config');
    }

    this.config = config;
    this.botIpSource = botIpSource;
  }

  getSettings() {
    const detection = this.getDetectionSettings();

    return {
      server: {
        host: this.config.server?.host,
        port: this.config.server?.port
      },
      detection,
      repository: {
        driver: this.config.repository?.driver,
        databaseConfigured: Boolean(this.config.repository?.databaseUrl)
      },
      auth: {
        adminTokenConfigured: Boolean(this.config.auth?.adminToken)
      },
      notes: [
        '系统设置来自环境变量；文件型 Bot IP 名单可通过重载接口刷新。',
        'ADMIN_TOKEN 和 DATABASE_URL 不会在管理 API 中返回明文。'
      ]
    };
  }

  getDetectionSettings() {
    const botIps = this.getLoadedBotIps();

    return {
      suspiciousThreshold: this.config.detection?.suspiciousThreshold,
      botThreshold: this.config.detection?.botThreshold,
      botIpCount: botIps.length,
      botIps,
      botIpSource: this.getBotIpSourceSettings()
    };
  }

  async reloadBotIpSource() {
    if (typeof this.botIpSource?.reload !== 'function') {
      throw new AppError(
        'Current Bot IP source does not support reload',
        409,
        'BOT_IP_SOURCE_RELOAD_UNSUPPORTED'
      );
    }

    await this.botIpSource.reload();

    return {
      botIpCount: this.getLoadedBotIps().length,
      botIps: this.getLoadedBotIps(),
      botIpSource: this.getBotIpSourceSettings()
    };
  }

  getLoadedBotIps() {
    if (typeof this.botIpSource?.list === 'function') {
      return this.botIpSource.list();
    }

    return [...(this.config.detection?.botIps ?? [])];
  }

  getBotIpSourceSettings() {
    return {
      type: this.config.detection?.botIpSource?.type ?? 'env',
      filePath: this.config.detection?.botIpSource?.filePath ?? ''
    };
  }
}
