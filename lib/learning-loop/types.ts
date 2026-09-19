export type LearningEvidenceType =
  | 'scene_visited'
  | 'quiz_reviewed'
  | 'learner_confusion'
  | 'learner_explanation'
  | 'repair_step_completed'
  | 'verification_passed'
  | 'verification_failed';

export type KnowledgeComponentSource = 'scene-derived' | 'outline-derived' | 'authored';

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
