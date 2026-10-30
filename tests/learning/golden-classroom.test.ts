import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import JSZip from 'jszip';
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import { buildGoldenDemoClassroom, ensureGoldenDemoClassroom } from '@/lib/demo/golden-classroom';
import type { ClassroomManifest } from '@/lib/export/classroom-zip-types';
import { validateAppScene, validateAppStage } from '@/lib/document-store/validators';

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  save: vi.fn(),
  server: vi.fn(),
  task: vi.fn(),
}));
vi.mock('@/lib/utils/stage-storage', () => ({
  loadStageData: mocks.load,
  saveStageData: mocks.save,
}));
vi.mock('@/lib/persistence/bootstrap', () => ({
  isBrowserPersistenceEnabled: mocks.server,
  getPersistenceRequestHeaders: async () => ({}),
}));
vi.mock('@/lib/learning/task-storage', () => ({
  getLearningTask: () => null,
  upsertLearningTask: mocks.task,
}));

const archive = readFileSync(resolve('public/examples/circle-area.maic.zip'));
let manifest: ClassroomManifest;
let storage: Map<string, string>;

beforeAll(async () => {
  const zip = await JSZip.loadAsync(archive);
  expect(Object.keys(zip.files)).toEqual(['manifest.json']);
  manifest = JSON.parse(await zip.file('manifest.json')!.async('string'));
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.load.mockResolvedValue(null);
  mocks.save.mockResolvedValue(undefined);
  mocks.server.mockReturnValue(false);
  storage = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(new Uint8Array(archive))),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('circle area demo classroom', () => {
  it('preserves all twelve scenes, interactions, quizzes and narration', () => {
    const original = structuredClone(manifest);
    const demo = buildGoldenDemoClassroom('demo-stage', manifest, 100);
    expect(buildGoldenDemoClassroom('demo-stage', manifest, 100)).toEqual(demo);
    expect(demo.stage.name).toBe('圆的面积');
    expect(demo.scenes).toHaveLength(12);
    expect(demo.scenes.filter((s) => s.type === 'interactive')).toHaveLength(1);
    expect(demo.scenes.filter((s) => s.type === 'quiz')).toHaveLength(2);
    expect(validateAppStage(demo.stage)).toEqual({ valid: true });
    for (const [index, scene] of demo.scenes.entries()) {
      expect(validateAppScene(scene), scene.title).toEqual({ valid: true });
      expect(scene.title).toBe(manifest.scenes[index].title);
      expect(scene.content).toEqual(manifest.scenes[index].content);
      expect(scene.actions).toEqual(manifest.scenes[index].actions);
    }
    expect(manifest).toEqual(original);
  });

  it('ignores the old demo marker and links a primary-school circle-area task', async () => {
    storage.set(
      'zhigou.demo.linear-function.v1',
      JSON.stringify({
        stageId: 'zhigou-demo-linear-function',
        taskId: 'old-task',
      }),
    );
    const result = await ensureGoldenDemoClassroom();
    expect(result.stageId).toBe('zhigou-demo-circle-area');
    expect(fetch).toHaveBeenCalledWith('/examples/circle-area.maic.zip');
    expect(mocks.save.mock.calls[0][1].stage.name).toBe('圆的面积');
    expect(mocks.task).toHaveBeenCalledWith(
      expect.objectContaining({
        knowledgePoint: '圆的面积',
        courseName: '小学数学',
        classroomId: result.stageId,
      }),
    );
    expect(storage.has('zhigou.demo.circle-area.v1')).toBe(true);
    expect(storage.has('zhigou.demo.linear-function.v1')).toBe(true);
  });

  it('reuses existing content without overwriting learner edits', async () => {
    storage.set(
      'zhigou.demo.circle-area.v1',
      JSON.stringify({
        stageId: 'circle-existing',
        taskId: 'zhigou-demo-circle-area-task',
      }),
    );
    mocks.load.mockResolvedValue({ stage: { name: '我的圆面积笔记' } });
    expect((await ensureGoldenDemoClassroom()).reused).toBe(true);
    expect(mocks.save).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('allows retry after download failure without recording success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 503 }));
    await expect(ensureGoldenDemoClassroom()).rejects.toThrow('503');
    expect(storage.has('zhigou.demo.circle-area.v1')).toBe(false);
    expect(mocks.save).not.toHaveBeenCalled();
    await expect(ensureGoldenDemoClassroom()).resolves.toMatchObject({ reused: false });
  });

  it('shares concurrent launches and uses the server stage ID', async () => {
    mocks.server.mockReturnValue(true);
    vi.mocked(fetch).mockImplementation(async (url) =>
      url === '/api/stages'
        ? Response.json({ stage: { id: 'server-circle' } })
        : new Response(new Uint8Array(archive)),
    );
    const [first, second] = await Promise.all([
      ensureGoldenDemoClassroom(),
      ensureGoldenDemoClassroom(),
    ]);
    expect(first).toEqual(second);
    expect(first.stageId).toBe('server-circle');
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(
      mocks.save.mock.calls[0][1].scenes.every(
        (scene: { stageId: string }) => scene.stageId === 'server-circle',
      ),
    ).toBe(true);
    expect(JSON.parse(vi.mocked(fetch).mock.calls[1][1]!.body as string).name).toBe('圆的面积');
  });
});
