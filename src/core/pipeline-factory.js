import { IpDetector } from '../detectors/ip.detector.js';
import { UserAgentDetector } from '../detectors/ua.detector.js';
import { createBotIpSource } from '../detectors/bot-ip-source.js';
import { DetectionPipeline } from './pipeline.js';

export function createDefaultDetectionPipeline({
  botIps = [],
  botIpSource = createBotIpSource({ botIps })
} = {}) {
  return new DetectionPipeline()
    .register(new IpDetector({ botIpSource }))
    .register(new UserAgentDetector());
}
