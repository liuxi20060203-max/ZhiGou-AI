import { withRequestOwnerId } from '@/lib/server/agent-runtime/with-owner';
import { createDigitalHumanAdapter, DigitalHumanProviderError } from '@/lib/digital-human/adapters';
import { digitalHumanContext, headerCredentials, ownerJson } from '@/lib/digital-human/server';
import { resolveDigitalHumanCredentials } from '@/lib/digital-human/server-config';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: Params) {
  return withRequestOwnerId(req, async (ownerId, headers) => {
    const { id } = await context.params;
    const { provider, store } = await digitalHumanContext();
    let job = await store.getJob(ownerId, id);
    if (!job) return ownerJson({ success: false, error: '任务不存在' }, 404, headers);
    const profile = await store.getProfile(ownerId, job.profile_id);
    if (!profile) return ownerJson({ success: false, error: '形象不存在' }, 409, headers);
    const clips = await store.listClips(ownerId, id);
    const pending = clips.filter(
      (clip) => clip.remote_job_id && (clip.status === 'queued' || clip.status === 'running'),
    );
    if (pending.length) {
      try {
        const adapter = createDigitalHumanAdapter(
          profile.providerId,
          resolveDigitalHumanCredentials(profile.providerId, headerCredentials(req)),
        );
        for (const clip of pending.slice(
          0,
          profile.providerId === 'volcengine-digital-human' ? 1 : 2,
        )) {
          if (!clip.remote_job_id) continue;
          const remote = await adapter.getJobStatus(clip.remote_job_id);
          if (remote.status === 'succeeded' && remote.downloadUrl) {
            const bytes = await adapter.downloadResult(remote.downloadUrl);
            const assetId = await provider.assetStore.put(
              { key: ownerId },
              new Blob([new Uint8Array(bytes)], { type: 'video/mp4' }),
              { contentType: 'video/mp4', kind: 'digital-human-presenter', generated: true },
            );
            await store.updateClip(ownerId, clip.id, {
              status: 'succeeded',
              progress: 100,
              outputAssetId: assetId,
            });
            await store.cacheClip(ownerId, clip.cache_key, assetId);
          } else if (remote.status === 'failed') {
            await store.updateClip(ownerId, clip.id, {
              status: 'failed',
              progress: remote.progress,
              errorCode: remote.errorCode,
              errorMessage: remote.errorMessage,
            });
          } else
            await store.updateClip(ownerId, clip.id, {
              status: 'running',
              progress: remote.progress,
            });
        }
      } catch (error) {
        if (!(error instanceof Error && error.message === 'INVALID_CREDENTIALS')) {
          const code = error instanceof DigitalHumanProviderError ? error.code : 'provider_failure';
          return ownerJson({ success: false, error: code, retryable: true }, 502, headers);
        }
      }
      await store.updateJobProgress(ownerId, id);
      job = await store.getJob(ownerId, id);
    }
    const fresh = await store.listClips(ownerId, id);
    return ownerJson(
      {
        success: true,
        job: {
          id,
          status: job!.status,
          progress: job!.progress,
          profileId: job!.profile_id,
          clips: fresh.map((clip) => ({
            id: clip.id,
            actionId: clip.action_id,
            status: clip.status,
            progress: clip.progress,
            outputAssetId: clip.output_asset_id || undefined,
            errorCode: clip.error_code || undefined,
            errorMessage: clip.error_message || undefined,
          })),
        },
      },
      200,
      headers,
    );
  });
}
