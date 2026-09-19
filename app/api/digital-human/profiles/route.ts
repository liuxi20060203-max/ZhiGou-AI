import { createHash } from 'node:crypto';
import { withRequestOwnerId } from '@/lib/server/agent-runtime/with-owner';
import { createDigitalHumanAdapter, DigitalHumanProviderError } from '@/lib/digital-human/adapters';
import { DIGITAL_HUMAN_CAPABILITIES } from '@/lib/digital-human/types';
import {
  credentialFingerprint,
  digitalHumanFeatureAvailable,
  resolveDigitalHumanCredentials,
} from '@/lib/digital-human/server-config';
import {
  digitalHumanContext,
  ownerJson,
  parseProviderId,
  requestCredentials,
} from '@/lib/digital-human/server';

export async function GET(req: Request) {
  return withRequestOwnerId(req, async (ownerId, headers) => {
    if (!digitalHumanFeatureAvailable())
      return ownerJson({ success: false, error: '数字人导出不可用' }, 503, headers);
    const { store } = await digitalHumanContext();
    return ownerJson({ success: true, profiles: await store.listProfiles(ownerId) }, 200, headers);
  });
}

export async function POST(req: Request) {
  return withRequestOwnerId(req, async (ownerId, headers) => {
    if (!digitalHumanFeatureAvailable())
      return ownerJson({ success: false, error: '数字人导出不可用' }, 503, headers);
    const form = await req.formData();
    const providerId = parseProviderId(form.get('providerId'));
    const video = form.get('video');
    const consent = form.get('consent') === 'true';
    const name = String(form.get('name') || '')
      .trim()
      .slice(0, 80);
    const consentVersion = String(form.get('consentVersion') || 'digital-human-consent-v1');
    if (!providerId || !(video instanceof File) || !consent || !name)
      return ownerJson({ success: false, error: '缺少素材、名称或合法授权确认' }, 400, headers);
    const cap = DIGITAL_HUMAN_CAPABILITIES[providerId];
    if (!cap.acceptedVideoMimeTypes.includes(video.type) || video.size > cap.maxVideoBytes)
      return ownerJson({ success: false, error: '视频 MIME 或大小不符合供应商要求' }, 415, headers);
    const authorization = form.get('authorization');
    const credentials = resolveDigitalHumanCredentials(providerId, requestCredentials(form));
    const adapter = createDigitalHumanAdapter(providerId, credentials);
    try {
      const videoBytes = new Uint8Array(await video.arrayBuffer());
      const authorizationBytes =
        authorization instanceof File
          ? new Uint8Array(await authorization.arrayBuffer())
          : undefined;
      const result = await adapter.createProfile({
        video: videoBytes,
        mimeType: video.type,
        filename: video.name,
        authorization: authorizationBytes,
      });
      const consentHashBuilder = createHash('sha256').update(videoBytes);
      if (authorizationBytes) consentHashBuilder.update(authorizationBytes);
      const consentHash = consentHashBuilder
        .update(`\0${ownerId}\0${providerId}\0${consentVersion}`)
        .digest('hex');
      const { store } = await digitalHumanContext();
      const profile = await store.createProfile({
        ownerId,
        providerId,
        name,
        remoteJobId: result.remoteJobId,
        credentialFingerprint: credentialFingerprint(credentials),
        consentVersion,
        consentHash,
      });
      return ownerJson({ success: true, profile }, 202, headers);
    } catch (error) {
      const code = error instanceof DigitalHumanProviderError ? error.code : 'provider_failure';
      return ownerJson(
        { success: false, error: code },
        code === 'authentication' ? 401 : 502,
        headers,
      );
    }
  });
}
