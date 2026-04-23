import { randomUUID } from 'node:crypto';

import { DEFAULT_TENANT_ID } from '../../config/index.js';
import { cloneRecord, cloneRecords } from '../clone.js';
import { ACCESS_LOG_COLUMNS, mapAccessLogRow } from './row-mappers.js';

export class PostgresAccessLogRepository {
  constructor({ client, now = () => new Date().toISOString() } = {}) {
    if (!client) {
      throw new Error('PostgresAccessLogRepository requires a client');
    }

    this.client = client;
    this.now = now;
  }

  async create(input) {
    const now = input.createdAt ?? this.now();
    const result = await this.client.query(
      `INSERT INTO access_logs (
        id,
        tenant_id,
        campaign_id,
        ip_address,
        user_agent,
        verdict,
        action,
        confidence,
        detection_reasons,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING ${ACCESS_LOG_COLUMNS}`,
      [
        randomUUID(),
        input.tenantId ?? DEFAULT_TENANT_ID,
        input.campaignId,
        input.ipAddress,
        input.userAgent ?? '',
        input.verdict,
        input.action,
        input.confidence,
        input.detectionReasons ?? [],
        now,
        now
      ]
    );

    return cloneRecord(mapAccessLogRow(result.rows[0]));
  }

  async findByCampaign(campaignId, tenantId = DEFAULT_TENANT_ID) {
    const result = await this.client.query(
      `SELECT ${ACCESS_LOG_COLUMNS}
      FROM access_logs
      WHERE campaign_id = $1 AND tenant_id = $2
      ORDER BY created_at ASC`,
      [campaignId, tenantId]
    );

    return cloneRecords(result.rows.map(mapAccessLogRow));
  }

  async findAllByTenant(tenantId = DEFAULT_TENANT_ID) {
    const result = await this.client.query(
      `SELECT ${ACCESS_LOG_COLUMNS}
      FROM access_logs
      WHERE tenant_id = $1
      ORDER BY created_at ASC`,
      [tenantId]
    );

    return cloneRecords(result.rows.map(mapAccessLogRow));
  }

  async findPageByCampaign(
    campaignId,
    tenantId = DEFAULT_TENANT_ID,
    {
      page = 1,
      pageSize = 20,
      filters = {}
    } = {}
  ) {
    return this.findPage({
      baseConditions: [
        ['campaign_id', '=', campaignId],
        ['tenant_id', '=', tenantId]
      ],
      page,
      pageSize,
      filters
    });
  }

  async findPageByTenant(
    tenantId = DEFAULT_TENANT_ID,
    {
      page = 1,
      pageSize = 20,
      filters = {}
    } = {}
  ) {
    return this.findPage({
      baseConditions: [['tenant_id', '=', tenantId]],
      page,
      pageSize,
      filters
    });
  }

  async deleteByCampaign(campaignId, tenantId = DEFAULT_TENANT_ID) {
    const result = await this.client.query(
      'DELETE FROM access_logs WHERE campaign_id = $1 AND tenant_id = $2',
      [campaignId, tenantId]
    );

    return result.rowCount;
  }

  async findPage({ baseConditions, page, pageSize, filters }) {
    const normalizedPage = positiveInteger(page, 1);
    const normalizedPageSize = positiveInteger(pageSize, 20);
    const offset = (normalizedPage - 1) * normalizedPageSize;
    const { whereClause, params } = buildLogWhereClause(baseConditions, filters);
    const countResult = await this.client.query(
      `SELECT COUNT(*) AS total
      FROM access_logs
      ${whereClause}`,
      params
    );
    const total = Number(countResult.rows[0]?.total ?? 0);
    const dataResult = await this.client.query(
      `SELECT ${ACCESS_LOG_COLUMNS}
      FROM access_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}`,
      [...params, normalizedPageSize, offset]
    );

    return {
      items: cloneRecords(dataResult.rows.map(mapAccessLogRow)),
      total,
      page: normalizedPage,
      pageSize: normalizedPageSize
    };
  }
}

function buildLogWhereClause(baseConditions, filters = {}) {
  const conditions = [];
  const params = [];

  for (const [column, operator, value] of baseConditions) {
    addCondition(conditions, params, column, operator, value);
  }

  addOptionalCondition(conditions, params, 'verdict', '=', filters.verdict);
  addOptionalCondition(conditions, params, 'action', '=', filters.action);
  addOptionalCondition(conditions, params, 'ip_address', '=', filters.ipAddress);
  addOptionalCondition(conditions, params, 'created_at', '>=', filters.from);
  addOptionalCondition(conditions, params, 'created_at', '<=', filters.to);

  return {
    whereClause: `WHERE ${conditions.join(' AND ')}`,
    params
  };
}

function addOptionalCondition(conditions, params, column, operator, value) {
  if (value) {
    addCondition(conditions, params, column, operator, value);
  }
}

function addCondition(conditions, params, column, operator, value) {
  params.push(value);
  conditions.push(`${column} ${operator} $${params.length}`);
}

function positiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}
