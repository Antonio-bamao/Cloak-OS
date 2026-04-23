import { DetectionPipeline } from '../core/pipeline.js';
import { DecisionEngine } from '../core/decision-engine.js';
import { DEFAULT_TENANT_ID } from '../config/index.js';
import { AppError } from '../utils/errors.js';
import { getRedirectStrategy } from '../strategies/index.js';

export class CampaignService {
  constructor({
    repository,
    accessLogRepository,
    pipeline = new DetectionPipeline(),
    decisionEngine = new DecisionEngine()
  } = {}) {
    if (!repository) {
      throw new TypeError('CampaignService requires a repository');
    }

    this.repository = repository;
    this.accessLogRepository = accessLogRepository;
    this.pipeline = pipeline;
    this.decisionEngine = decisionEngine;
  }

  async createCampaign(input) {
    validateCampaignInput(input);
    return this.repository.create({
      ...input,
      tenantId: input.tenantId ?? DEFAULT_TENANT_ID
    });
  }

  async listCampaigns(tenantId = DEFAULT_TENANT_ID) {
    return this.repository.findAll(tenantId);
  }

  async getCampaign(campaignId, tenantId = DEFAULT_TENANT_ID) {
    const campaign = await this.repository.findById(campaignId, tenantId);

    if (!campaign) {
      throw new AppError('Campaign not found', 404, 'CAMPAIGN_NOT_FOUND');
    }

    return campaign;
  }

  async handleVisit(campaignId, ctx, tenantId = DEFAULT_TENANT_ID) {
    const campaign = await this.getCampaign(campaignId, tenantId);

    const detections = await this.pipeline.execute(ctx);
    const decision = this.decisionEngine.decide(detections);
    const targetUrl = decision.action === 'money' ? campaign.moneyUrl : campaign.safeUrl;
    const strategy = getRedirectStrategy(campaign.redirectMode);
    const response = await strategy.execute(targetUrl);

    await this.recordAccessLog({ campaign, ctx, decision });

    return {
      campaign,
      detections,
      decision,
      response
    };
  }

  async recordAccessLog({ campaign, ctx, decision }) {
    if (!this.accessLogRepository) {
      return null;
    }

    return this.accessLogRepository.create({
      tenantId: campaign.tenantId,
      campaignId: campaign.id,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent ?? '',
      verdict: decision.verdict,
      action: decision.action,
      confidence: decision.confidence,
      detectionReasons: decision.reasons
    });
  }
}

function validateCampaignInput(input) {
  if (!input?.name) {
    throw new AppError('Campaign name is required', 400, 'CAMPAIGN_NAME_REQUIRED');
  }

  if (!input.safeUrl) {
    throw new AppError('Safe URL is required', 400, 'SAFE_URL_REQUIRED');
  }

  if (!input.moneyUrl) {
    throw new AppError('Money URL is required', 400, 'MONEY_URL_REQUIRED');
  }
}
