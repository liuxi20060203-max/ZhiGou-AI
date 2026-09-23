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

export type RepairPlanStatus = 'proposed' | 'active' | 'completed' | 'dismissed' | 'expired';

export interface RepairVerification {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

/** App-owned course content, persisted with the scene rather than learner runtime. */
export interface AuthoredKnowledgeContent {
  version: 1;
  revision: string;
  updatedAt: string;
  objective: string;
  keyPoints: string[];
  verification?: RepairVerification;
}

export interface RepairStep {
  id: string;
  type: 'explanation' | 'example' | 'verification';
  title: string;
  content: string;
  verification?: RepairVerification;
}

export interface RepairPlan {
  id: string;
  stageId: string;
  componentId: string;
  componentRevision?: string;
  triggerEvidenceIds: string[];
  rationale: string;
  steps: RepairStep[];
  status: RepairPlanStatus;
  contentVersion: 1;
  createdAt: string;
  updatedAt: string;
}

export interface RepairPlanRecordPayload {
  payloadVersion: 1;
  recordType: 'repair_plan';
  plan: RepairPlan;
}

export type LearningJourneyRecordPayload = LearningEvidenceRecordPayload | RepairPlanRecordPayload;

export interface KnowledgeComponent {
  id: string;
  stageId: string;
  title: string;
  objective?: string;
  keyPoints: string[];
  contentRevision?: string;
  authoredVerification?: RepairVerification;
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

export interface TutorLearningContext {
  currentComponent: {
    id: string;
    title: string;
    objective?: string;
    sceneId: string;
  };
  status: LearningComponentStatus;
  recentEvidence: Array<{
    type: LearningEvidenceType;
    outcome: LearningEvidenceOutcome;
    source: LearningEvidenceSource;
    occurredAt: string;
  }>;
  activeRepairPlan?: {
    id: string;
    rationale: string;
    status: RepairPlanStatus;
  };
}

export interface KnowledgeConstructionReport {
  stageId: string;
  generatedAt: string;
  components: Array<{
    componentId: string;
    title: string;
    status: LearningComponentStatus;
    evidenceIds: string[];
    explanation: string;
    suggestedNextAction?: string;
  }>;
  repairedComponentIds: string[];
  unresolvedComponentIds: string[];
}
