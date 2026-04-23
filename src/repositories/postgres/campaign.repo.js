import { randomUUID } from 'node:crypto';

import { DEFAULT_TENANT_ID } from '../../config/index.js';
import { cloneRecord, cloneRecords } from '../clone.js';
import { CAMPAIGN_COLUMNS, mapCampaignRow } from './row-mappers.js';

export class PostgresCampaignRepository {
  constructor({ client, now = () => new Date().toISOString() } = {}) {
    if (!client) {
      throw new Error('PostgresCampaignRepository requires a client');
    }

    this.client = client;
    this.now = now;
  }

  async create(input) {
    const now = input.createdAt ?? this.now();
    const result = await this.client.query(
      `INSERT INTO campaigns (
        id,
        tenant_id,
        name,
        safe_url,
        money_url,
        redirect_mode,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING ${CAMPAIGN_COLUMNS}`,
      [
        randomUUID(),
        input.tenantId ?? DEFAULT_TENANT_ID,
        input.name,
        input.safeUrl,
        input.moneyUrl,
        input.redirectMode ?? 'redirect',
        now,
        now
      ]
    );

    return cloneRecord(mapCampaignRow(result.rows[0]));
  }

  async findById(id, tenantId = DEFAULT_TENANT_ID) {
    const result = await this.client.query(
      `SELECT ${CAMPAIGN_COLUMNS}
      FROM campaigns
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1`,
      [id, tenantId]
    );

    return cloneRecord(mapCampaignRow(result.rows[0]));
  }

  async findAll(tenantId = DEFAULT_TENANT_ID) {
    const result = await this.client.query(
      `SELECT ${CAMPAIGN_COLUMNS}
      FROM campaigns
      WHERE tenant_id = $1
      ORDER BY created_at ASC`,
      [tenantId]
    );

    return cloneRecords(result.rows.map(mapCampaignRow));
  }

  async update(id, tenantId = DEFAULT_TENANT_ID, patch = {}) {
    const existing = await this.findById(id, tenantId);

    if (!existing) {
      return null;
    }

    const result = await this.client.query(
      `UPDATE campaigns
      SET
        name = COALESCE($1, name),
        safe_url = COALESCE($2, safe_url),
        money_url = COALESCE($3, money_url),
        redirect_mode = COALESCE($4, redirect_mode),
        updated_at = $5
      WHERE id = $6 AND tenant_id = $7
      RETURNING ${CAMPAIGN_COLUMNS}`,
      [
        patch.name,
        patch.safeUrl,
        patch.moneyUrl,
        patch.redirectMode,
        this.now(),
        id,
        tenantId
      ]
    );

    return cloneRecord(mapCampaignRow(result.rows[0]));
  }

  async delete(id, tenantId = DEFAULT_TENANT_ID) {
    const result = await this.client.query(
      'DELETE FROM campaigns WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    return result.rowCount > 0;
  }
}
