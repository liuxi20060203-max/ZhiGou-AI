import JSZip from 'jszip';
import { withRequestOwnerId } from '@/lib/server/agent-runtime/with-owner';
import { digitalHumanContext, ownerJson } from '@/lib/digital-human/server';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: Params) {
  return withRequestOwnerId(req, async (ownerId, headers) => {
    const { id } = await context.params;
    const { provider, store } = await digitalHumanContext();
    const job = await store.getJob(ownerId, id);
    if (!job) return ownerJson({ success: false, error: '任务不存在' }, 404, headers);
    if (job.status !== 'succeeded')
      return ownerJson({ success: false, error: '任务尚未完成' }, 409, headers);
    const clips = await store.listClips(ownerId, id);
    const zip = new JSZip();
    const manifest: Array<{ actionId: string; path: string; assetId: string }> = [];
    for (const [index, clip] of clips.entries()) {
      if (!clip.output_asset_id)
        return ownerJson({ success: false, error: '任务存在缺失片段' }, 409, headers);
      const resolved = await provider.assetStore.resolve({ key: ownerId }, clip.output_asset_id);
      if (!resolved) return ownerJson({ success: false, error: '数字人片段已丢失' }, 410, headers);
      const path = `digital-human/${String(index + 1).padStart(3, '0')}-${clip.action_id.replace(/[^a-zA-Z0-9_-]/g, '_')}.mp4`;
      zip.file(path, resolved.bytes);
      manifest.push({ actionId: clip.action_id, path, assetId: clip.output_asset_id });
    }
    zip.file(
      'manifest.json',
      JSON.stringify(
        { schema: 'openmaic.digitalHumanClips', version: 1, jobId: id, clips: manifest },
        null,
        2,
      ),
    );
    const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    const responseHeaders = new Headers(headers);
    responseHeaders.set('content-type', 'application/zip');
    responseHeaders.set('content-disposition', `attachment; filename="digital-human-${id}.zip"`);
    responseHeaders.set('cache-control', 'private, no-store');
    return new Response(bytes.buffer as ArrayBuffer, { status: 200, headers: responseHeaders });
  });
}
