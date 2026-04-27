// Domain taxonomy for Guidewire Practice Knowledge Base
// Used for manual labelling and Claude auto-tagging prompts

export const DOC_TYPES = [
  'SoW', 'SLA Framework', 'Runbook', 'Methodology',
  'Estimation Model', 'Proposal', 'Policy', 'Framework',
  'Technical Spec', 'Integration Guide', 'Release Notes',
  'Lessons Learned', 'Project Report', 'Training Material',
  'Client Document', 'Other',
]

export const GW_MODULES = [
  'PolicyCenter', 'ClaimCenter', 'BillingCenter',
  'Digital (Jutro)', 'DataHub', 'InfoCenter',
  'Integration Framework', 'Reinsurance Management',
  'Cloud Platform', 'All Modules',
]

export const CONCEPT_TAGS = [
  // AMS / Service Delivery
  'AMS', 'L1 Support', 'L2 Support', 'L3 Support',
  'SLA', 'MTTR', 'P1 Incident', 'P2 Incident', 'P3 Incident', 'P4 Incident',
  'Incident Management', 'Problem Management', 'Change Management',
  'SLA Credits', 'SLA Penalties', 'KPI', 'KT',
  // Delivery
  'SurePath', 'Agile', 'Sprint', 'Story Points', 'Velocity',
  'Calibration', 'Discovery', 'Implementation', 'Stabilization', 'BAU',
  // Commercial
  'TCV', 'ACV', 'FTE', 'Blended Rate', 'Onsite', 'Offshore', 'Nearshore',
  'SOW', 'MSA', 'Change Request', 'Pricing', 'Margin',
  // Technical
  'Gosu', 'OOTB', 'Configuration', 'Customization', 'Upgrade',
  'Cloud Migration', 'On-Premise', 'API', 'REST', 'Integration',
  'Data Migration', 'Performance Testing', 'Security',
  // Guidewire Cloud
  'InsuranceSuite Cloud', 'GWCP', 'GCP', 'CI/CD', 'DevOps',
]

export const DOMAINS = [
  'Guidewire Practice',
  'NTT DATA Internal',
  'Client Document',
]

export const CLIENT_NAMES = [
  // Matches seed data from portfolio dashboard
  'Northstar Insurance Group', 'Meridian P&C', 'Apex Commercial Lines',
  'Harbor Mutual', 'Southern Cross Insurance', 'Atlantic Specialty',
  'Continental Re', 'Pacific Benefits Group', 'Great Plains Mutual',
  'Alpine Specialty Lines', 'Other / Redacted',
]

// Claude system prompt for auto-tagging
export function buildTaggingPrompt(chunkText, filename, docType) {
  return `You are an expert Guidewire practice knowledge manager at NTT DATA.
Analyse this document chunk and extract structured metadata tags.

Filename: ${filename}
Document type hint: ${docType || 'Unknown'}
Chunk text:
---
${chunkText.slice(0, 1200)}
---

Respond ONLY with a valid JSON object — no markdown, no explanation:
{
  "docType": "<one of: ${DOC_TYPES.join(' | ')}>",
  "modules": ["<from: ${GW_MODULES.join(' | ')}>"],
  "concepts": ["<up to 8 from: ${CONCEPT_TAGS.join(' | ')}>"],
  "domain": "<one of: ${DOMAINS.join(' | ')}>",
  "summary": "<1-2 sentence summary of this chunk>",
  "isClientDocument": <true|false>,
  "confidenceScore": <0.0-1.0>
}`
}
