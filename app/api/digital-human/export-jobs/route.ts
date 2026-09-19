import { createHash } from 'node:crypto';
import { withRequestOwnerId } from '@/lib/server/agent-runtime/with-owner';
import { createDigitalHumanAdapter } from '@/lib/digital-human/adapters';
import { digitalHumanContext, ownerJson, requestCredentials } from '@/lib/digital-human/server';
import { resolveDigitalHumanCredentials } from '@/lib/digital-human/server-config';

interface ManifestClip {
  actionId: string;
  audioSha256: string;
  mimeType: string;
}
interface Manifest {
  profileId: string;
  width: number;
  height: number;
  fps: number;
  clips: ManifestClip[];
}

export async function POST(req: Request) {
  return withRequestOwnerId(req, async (ownerId, headers) => {
    const form = await req.formData();
    let manifest: Manifest;
    try {
      manifest = JSON.parse(String(form.get('manifest'))) as Manifest;
    } catch {
      return ownerJson({ success: false, error: '无效任务清单' }, 400, headers);
    }
    if (
      !manifest.profileId ||
      !Array.isArray(manifest.clips) ||
      manifest.clips.length === 0 ||
      manifest.clips.length > 500
    )
      return ownerJson({ success: false, error: '任务片段为空或过多' }, 400, headers);
    const { store } = await digitalHumanContext();
    const profile = await store.getProfile(ownerId, manifest.profileId);
    if (!profile || profile.status !== 'ready' || !profile.remoteProfileId)
      return ownerJson({ success: false, error: '数字人形象未就绪或需要重新绑定' }, 409, headers);
    if (profile.providerId === 'volcengine-digital-human' && manifest.clips.length > 1)
      return ownerJson(
        { success: false, error: '火山引擎默认并发为 1，请串行提交片段' },
        429,
        headers,
      );
    const credentials = resolveDigitalHumanCredentials(
      profile.providerId,
      requestCredentials(form),
    );
    const adapter = createDigitalHumanAdapter(profile.providerId, credentials);
    const output = {
      width: manifest.width,
      height: manifest.height,
      fps: manifest.fps,
      codec: 'h264',
      pixelFormat: 'yuv420p',
      muted: true,
    };
    const jobId = await store.createExportJob({
      ownerId,
      profileId: profile.id,
      outputConfig: output,
    });
    for (const clip of manifest.clips) {
      const file = form.get(`audio.${clip.audioSha256}`);
      if (!(file instanceof File))
        return ownerJson({ success: false, error: `缺少音频 ${clip.actionId}` }, 400, headers);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const actualHash = createHash('sha256').update(bytes).digest('hex');
      if (actualHash !== clip.audioSha256)
        return ownerJson({ success: false, error: `音频校验失败 ${clip.actionId}` }, 400, headers);
      const cacheKey = createHash('sha256')
        .update(
          `${ownerId}\0${profile.providerId}\0${profile.remoteProfileId}\0${actualHash}\0${JSON.stringify(output)}`,
        )
        .digest('hex');
      const cached = await store.cachedAsset(ownerId, cacheKey);
      if (cached) {
        await store.addClip({
          jobId,
          ownerId,
          actionId: clip.actionId,
          audioSha256: actualHash,
          cacheKey,
          outputAssetId: cached,
          status: 'succeeded',
        });
        continue;
      }
      const recoverable = await store.recoverableClip(ownerId, cacheKey);
      if (recoverable?.remoteJobId) {
        await store.addClip({
          jobId,
          ownerId,
          actionId: clip.actionId,
          audioSha256: actualHash,
          cacheKey,
          remoteJobId: recoverable.remoteJobId,
          status: recoverable.status,
        });
        continue;
      }
      const submitted = await adapter.submitSpeechVideo({
        remoteProfileId: profile.remoteProfileId,
        audio: bytes,
        mimeType: clip.mimeType,
        idempotencyKey: cacheKey,
        width: manifest.width,
        height: manifest.height,
        fps: manifest.fps,
      });
      await store.addClip({
        jobId,
        ownerId,
        actionId: clip.actionId,
        audioSha256: actualHash,
        cacheKey,
        remoteJobId: submitted.remoteJobId,
        status: 'queued',
      });
    }
    await store.updateJobProgress(ownerId, jobId);
    return ownerJson({ success: true, jobId, pollIntervalMs: 3000 }, 202, headers);
  });
}
