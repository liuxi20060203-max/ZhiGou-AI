import { withRequestOwnerId } from '@/lib/server/agent-runtime/with-owner';
import { createDigitalHumanAdapter, DigitalHumanProviderError } from '@/lib/digital-human/adapters';
import { digitalHumanContext, headerCredentials, ownerJson } from '@/lib/digital-human/server';
import { resolveDigitalHumanCredentials } from '@/lib/digital-human/server-config';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: Params) {
  return withRequestOwnerId(req, async (ownerId, headers) => {
    const { id } = await context.params;
    const { store } = await digitalHumanContext();
    let profile = await store.getProfile(ownerId, id);
    if (!profile) return ownerJson({ success: false, error: '形象不存在' }, 404, headers);
    if (profile.status === 'creating' && profile.remoteJobId) {
      try {
        const credentials = resolveDigitalHumanCredentials(
          profile.providerId,
          headerCredentials(req),
        );
        const status = await createDigitalHumanAdapter(
          profile.providerId,
          credentials,
        ).getProfileStatus(profile.remoteJobId);
        if (status.status === 'succeeded' && status.remoteProfileId)
          await store.updateProfile(ownerId, id, {
            status: 'ready',
            remoteProfileId: status.remoteProfileId,
          });
        else if (status.status === 'failed')
          await store.updateProfile(ownerId, id, {
            status: 'failed',
            errorCode: status.errorCode,
            errorMessage: status.errorMessage,
          });
        profile = await store.getProfile(ownerId, id);
      } catch (error) {
        if (!(error instanceof Error && error.message === 'INVALID_CREDENTIALS')) throw error;
      }
    }
    return ownerJson({ success: true, profile }, 200, headers);
  });
}

export async function PATCH(req: Request, context: Params) {
  return withRequestOwnerId(req, async (ownerId, headers) => {
    const { id } = await context.params;
    const body = (await req.json().catch(() => ({}))) as { name?: string };
    const name = body.name?.trim().slice(0, 80);
    if (!name) return ownerJson({ success: false, error: '名称不能为空' }, 400, headers);
    const { store } = await digitalHumanContext();
    return ownerJson({ success: await store.renameProfile(ownerId, id, name) }, 200, headers);
  });
}

export async function DELETE(req: Request, context: Params) {
  return withRequestOwnerId(req, async (ownerId, headers) => {
    const { id } = await context.params;
    const { provider, store } = await digitalHumanContext();
    const profile = await store.getProfile(ownerId, id);
    if (!profile) return ownerJson({ success: false, error: '形象不存在' }, 404, headers);
    await store.markDeleted(ownerId, id);
    try {
      if (profile.remoteProfileId) {
        const credentials = resolveDigitalHumanCredentials(
          profile.providerId,
          headerCredentials(req),
        );
        await createDigitalHumanAdapter(profile.providerId, credentials).deleteProfile(
          profile.remoteProfileId,
        );
      }
      const assetIds = await store.profileAssetIds(ownerId, id);
      for (const assetId of assetIds) await provider.assetStore.remove({ key: ownerId }, assetId);
      await store.purgeProfileData(ownerId, id);
      await store.finishDelete(ownerId, id);
      return ownerJson({ success: true }, 200, headers);
    } catch (error) {
      const message = error instanceof DigitalHumanProviderError ? error.code : 'provider_failure';
      await store.failDelete(ownerId, id, message);
      return ownerJson({ success: false, error: message, retryable: true }, 502, headers);
    }
  });
}
