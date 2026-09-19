'use client';
import JSZip from 'jszip';
import type { SpeechAction } from '@openmaic/dsl';
import type { Scene } from '@/lib/types/stage';
import type { VideoTimelineRecords } from '@/lib/video-export-app/timeline-deps';
import { appendDigitalHumanCredentials, digitalHumanCredentialHeaders } from './client-settings';
import type { DigitalHumanProfile } from './types';

const POLL_MS = 3000;
const MAX_POLLS = 1200;

async function sha256(blob: Blob): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function prepareDigitalHumanClips(input: {
  profile: DigitalHumanProfile;
  scenes: Scene[];
  records: VideoTimelineRecords;
  width: number;
  height: number;
  fps: number;
  onProgress?: (progress: number) => void;
}): Promise<Map<string, Blob>> {
  const unique = new Map<string, { blob: Blob; mimeType: string; actionIds: string[] }>();
  for (const scene of input.scenes)
    for (const raw of scene.actions ?? []) {
      if (raw.type !== 'speech') continue;
      const action = raw as SpeechAction;
      if (!action.audioId) throw new Error('DIGITAL_HUMAN_REQUIRES_TTS');
      const record = input.records.audioById.get(action.audioId);
      if (!record?.blob.size) throw new Error('DIGITAL_HUMAN_REQUIRES_LOCAL_TTS');
      const hash = await sha256(record.blob);
      const found = unique.get(hash);
      if (found) found.actionIds.push(action.id);
      else
        unique.set(hash, {
          blob: record.blob,
          mimeType: record.blob.type || 'audio/mpeg',
          actionIds: [action.id],
        });
    }
  if (!unique.size) throw new Error('DIGITAL_HUMAN_REQUIRES_TTS');
  const result = new Map<string, Blob>();
  const entries = [...unique.entries()];
  // Volcano's published default concurrency is one; submit its clips one at a time.
  const batches =
    input.profile.providerId === 'volcengine-digital-human'
      ? entries.map((entry) => [entry] as typeof entries)
      : [entries];
  for (const [batchIndex, batch] of batches.entries()) {
    const form = new FormData();
    form.append(
      'manifest',
      JSON.stringify({
        profileId: input.profile.id,
        width: input.width,
        height: input.height,
        fps: input.fps,
        clips: batch.map(([audioSha256, value]) => ({
          actionId: value.actionIds[0],
          audioSha256,
          mimeType: value.mimeType,
        })),
      }),
    );
    appendDigitalHumanCredentials(form, input.profile.providerId);
    for (const [hash, value] of batch)
      form.append(`audio.${hash}`, value.blob, `speech-${hash}.audio`);
    const submitted = await fetch('/api/digital-human/export-jobs', { method: 'POST', body: form });
    const submission = (await submitted.json()) as { jobId?: string; error?: string };
    if (!submitted.ok || !submission.jobId)
      throw new Error(submission.error || 'DIGITAL_HUMAN_SUBMIT_FAILED');
    for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
      const response = await fetch(`/api/digital-human/export-jobs/${submission.jobId}`, {
        headers: digitalHumanCredentialHeaders(input.profile.providerId),
      });
      const status = (await response.json()) as {
        error?: string;
        job?: {
          status: string;
          progress: number;
          clips: Array<{ actionId: string; status: string; errorMessage?: string }>;
        };
      };
      if (!response.ok || !status.job)
        throw new Error(status.error || 'DIGITAL_HUMAN_STATUS_FAILED');
      input.onProgress?.(
        Math.round(((batchIndex + status.job.progress / 100) / batches.length) * 100),
      );
      if (status.job.status === 'failed') {
        const reason = status.job.clips.find((clip) => clip.status === 'failed')?.errorMessage;
        throw new Error(reason || 'DIGITAL_HUMAN_CLIP_FAILED');
      }
      if (status.job.status === 'succeeded') break;
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      if (attempt === MAX_POLLS - 1) throw new Error('DIGITAL_HUMAN_TIMEOUT');
    }
    const downloaded = await fetch(`/api/digital-human/export-jobs/${submission.jobId}/download`);
    if (!downloaded.ok) throw new Error('DIGITAL_HUMAN_DOWNLOAD_FAILED');
    const zip = await JSZip.loadAsync(await downloaded.blob());
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string')) as {
      clips: Array<{ actionId: string; path: string }>;
    };
    for (const clip of manifest.clips) {
      const blob = await zip.file(clip.path)!.async('blob');
      const entry = batch.find(([, value]) => value.actionIds.includes(clip.actionId));
      for (const actionId of entry?.[1].actionIds ?? [clip.actionId])
        result.set(actionId, new Blob([blob], { type: 'video/mp4' }));
    }
  }
  return result;
}
