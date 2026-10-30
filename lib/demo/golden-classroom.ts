'use client';

import { canonicalizeLegacyScene } from '@/lib/document-store';
import {
  agentConfigFromManifest,
  CLASSROOM_ZIP_FORMAT_VERSION,
  type ClassroomManifest,
} from '@/lib/export/classroom-zip-types';
import { rewriteAudioRefsToIds } from '@/lib/export/classroom-zip-utils';
import {
  getPersistenceRequestHeaders,
  isBrowserPersistenceEnabled,
} from '@/lib/persistence/bootstrap';
import { createConceptLearningTask } from '@/lib/learning/task-template';
import { getLearningTask, upsertLearningTask } from '@/lib/learning/task-storage';
import { stageDeletionEpoch, unmarkStageDeleted } from '@/lib/utils/deleted-stages';
import { loadStageData, saveStageData, type StageStoreData } from '@/lib/utils/stage-storage';

const DEMO_ARCHIVE_URL = '/examples/circle-area.maic.zip';
const DEMO_MARKER_KEY = 'zhigou.demo.circle-area.v1';
const LOCAL_STAGE_ID = 'zhigou-demo-circle-area';
const TASK_ID = 'zhigou-demo-circle-area-task';

interface DemoMarker {
  stageId: string;
  taskId: string;
}

export interface GoldenDemoResult extends DemoMarker {
  reused: boolean;
}

/** The bundled archive stores its assets inline and has no separate media entries. */
export function buildGoldenDemoClassroom(
  stageId: string,
  manifest: ClassroomManifest,
  now = Date.now(),
): StageStoreData {
  if (
    manifest.formatVersion !== CLASSROOM_ZIP_FORMAT_VERSION ||
    !manifest.stage?.name ||
    !Array.isArray(manifest.scenes) ||
    manifest.scenes.length === 0
  ) {
    throw new Error('Invalid demo classroom manifest');
  }
  if (Object.keys(manifest.mediaIndex ?? {}).length > 0) {
    throw new Error('The bundled demo must contain inline assets only');
  }

  const source = structuredClone(manifest);
  const agentIds = (source.agents ?? []).map((_, index) => `${stageId}-agent-${index}`);
  const agents = (source.agents ?? []).map((agent, index) =>
    agentConfigFromManifest(agent, agentIds[index]),
  );
  const studentIndex = agents.findIndex((agent) => agent.role === 'student');
  const otherIndex = agents.findIndex((agent) => agent.role !== 'teacher');
  const fallbackDiscussionAgentIndex =
    studentIndex >= 0 ? studentIndex : otherIndex >= 0 ? otherIndex : undefined;

  const scenes = source.scenes.map((scene, index) =>
    canonicalizeLegacyScene({
      id: `${stageId}-scene-${index}`,
      stageId,
      title: scene.title,
      order: scene.order ?? index,
      content: scene.content,
      actions: scene.actions
        ? rewriteAudioRefsToIds(scene.actions, new Map(), {
            agentIds,
            fallbackDiscussionAgentIndex,
          })
        : undefined,
      whiteboards: scene.whiteboards,
      multiAgent: scene.multiAgent?.enabled
        ? {
            enabled: true,
            agentIds: (scene.multiAgent.agentIndices ?? [])
              .map((agentIndex) => agentIds[agentIndex])
              .filter(Boolean),
            directorPrompt: scene.multiAgent.directorPrompt,
          }
        : undefined,
      createdAt: now,
      updatedAt: now,
    }),
  );

  return {
    stage: {
      id: stageId,
      name: source.stage.name,
      description: source.stage.description,
      languageDirective: source.stage.language,
      style: source.stage.style,
      videoManifest: source.stage.videoManifest,
      agentIds: agentIds.length ? agentIds : undefined,
      generatedAgentConfigs: agents.length ? agents : undefined,
      createdAt: now,
      updatedAt: now,
    },
    scenes,
    currentSceneId: scenes[0].id,
    chats: [],
    outline: {
      requirement: '理解圆的面积公式 S = πr²，并能解决实际问题',
      generationComplete: true,
      outlines: [],
      createdAt: now,
      updatedAt: now,
    },
  };
}

async function loadDemoManifest(): Promise<ClassroomManifest> {
  const response = await fetch(DEMO_ARCHIVE_URL);
  if (!response.ok) throw new Error(`Unable to load demo classroom (${response.status})`);
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await response.arrayBuffer());
  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) throw new Error('Demo classroom archive has no manifest');
  return JSON.parse(await manifestFile.async('string')) as ClassroomManifest;
}

function readMarker(): DemoMarker | null {
  try {
    const value = localStorage.getItem(DEMO_MARKER_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<DemoMarker>;
    return typeof parsed.stageId === 'string' && typeof parsed.taskId === 'string'
      ? { stageId: parsed.stageId, taskId: parsed.taskId }
      : null;
  } catch {
    return null;
  }
}

async function createServerStage(name: string): Promise<string> {
  const response = await fetch('/api/stages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(await getPersistenceRequestHeaders()) },
    body: JSON.stringify({ name, description: '知构 AI 示例课堂' }),
  });
  if (!response.ok) throw new Error(`Unable to create demo classroom (${response.status})`);
  const payload = (await response.json()) as { stage?: { id?: string } };
  if (!payload.stage?.id) throw new Error('Demo classroom response did not include an id');
  return payload.stage.id;
}

function ensureLinkedTask(stageId: string, now: number): string {
  const existing = getLearningTask(TASK_ID);
  if (existing?.classroomId === stageId) return existing.id;
  const task = createConceptLearningTask(
    {
      courseName: '小学数学',
      knowledgePoint: '圆的面积',
      learningGoal: '理解圆面积公式的推导，并根据半径、直径或周长计算面积',
      priorKnowledge: '圆的半径、直径与周长，长方形面积公式',
    },
    { id: TASK_ID, now },
  );
  upsertLearningTask({ ...task, classroomId: stageId, status: 'ready' });
  return task.id;
}

async function prepareGoldenDemoClassroom(): Promise<GoldenDemoResult> {
  const marker = readMarker();
  if (marker && (await loadStageData(marker.stageId))) {
    const taskId = ensureLinkedTask(marker.stageId, Date.now());
    return { stageId: marker.stageId, taskId, reused: true };
  }

  let stageId = LOCAL_STAGE_ID;
  const existing = isBrowserPersistenceEnabled() ? null : await loadStageData(stageId);
  if (!existing) {
    const manifest = await loadDemoManifest();
    // Validate the bundled content before allocating a server-side stage.
    buildGoldenDemoClassroom(stageId, manifest);
    if (isBrowserPersistenceEnabled()) stageId = await createServerStage(manifest.stage.name);
    unmarkStageDeleted(stageId);
    const result = await saveStageData(
      stageId,
      buildGoldenDemoClassroom(stageId, manifest),
      stageDeletionEpoch(stageId),
    );
    if (result === 'stale-dropped') throw new Error('Demo classroom creation was cancelled');
  }

  const taskId = ensureLinkedTask(stageId, Date.now());
  const nextMarker = { stageId, taskId };
  localStorage.setItem(DEMO_MARKER_KEY, JSON.stringify(nextMarker));
  return { ...nextMarker, reused: Boolean(existing) };
}

let pendingDemo: Promise<GoldenDemoResult> | undefined;

export function ensureGoldenDemoClassroom(): Promise<GoldenDemoResult> {
  pendingDemo ??= prepareGoldenDemoClassroom().finally(() => {
    pendingDemo = undefined;
  });
  return pendingDemo;
}
