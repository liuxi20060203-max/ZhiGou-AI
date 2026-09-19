export type LearningEvidenceType =
  | 'scene_visited'
  | 'quiz_reviewed'
  | 'learner_confusion'
  | 'learner_explanation'
  | 'repair_step_completed'
  | 'verification_passed'
  | 'verification_failed';

export type KnowledgeComponentSource = 'scene-derived' | 'outline-derived' | 'authored';

export type LearningComponentStatus =
  | 'not_started'
  | 'in_progress'
  | 'evidence_available'
  | 'needs_revisit'
  | 'verified';

export type LearningEvidenceOutcome = 'neutral' | 'supports' | 'contradicts';
export type LearningEvidenceStrength = 'weak' | 'medium' | 'strong';
export type LearningEvidenceSource = 'playback' | 'quiz' | 'learner' | 'tutor' | 'repair';

export interface LearningEvidence {
  eventId: string;
  stageId: string;
  learnerKey: string;
  componentId: string;
  sceneId?: string;
  type: LearningEvidenceType;
  outcome: LearningEvidenceOutcome;
  strength: LearningEvidenceStrength;
  source: LearningEvidenceSource;
  payload: Record<string, unknown>;
  occurredAt: string;
  schemaVersion: 1;
}

export type LearningEvidencePayload = Omit<LearningEvidence, 'stageId' | 'learnerKey'>;

export interface LearningEvidenceRecordPayload {
  payloadVersion: 1;
  recordType: 'evidence';
  evidence: LearningEvidencePayload;
}

export interface KnowledgeComponent {
  id: string;
  stageId: string;
  title: string;
  objective?: string;
  keyPoints: string[];
  sceneIds: string[];
  prerequisiteIds: string[];
  verification: {
    requiredEvidenceCount: number;
    acceptedEvidenceTypes: LearningEvidenceType[];
  };
  source: KnowledgeComponentSource;
  version: 1;
}

export interface KnowledgeModel {
  stageId: string;
  components: KnowledgeComponent[];
  version: 1;
}
