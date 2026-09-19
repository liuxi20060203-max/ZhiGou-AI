import 'server-only';
import { createHmac, randomUUID } from 'node:crypto';
import {
  DIGITAL_HUMAN_CAPABILITIES,
  type AdapterJobStatus,
  type DigitalHumanCredentials,
  type DigitalHumanProviderAdapter,
  type DigitalHumanProviderId,
} from './types';
import { validateUrlForSSRF } from '@/lib/server/ssrf-guard';

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RESULT_BYTES = 200 * 1024 * 1024;

export class DigitalHumanProviderError extends Error {
  constructor(
    readonly code:
      | 'authentication'
      | 'quota'
      | 'invalid_material'
      | 'content_review'
      | 'rate_limited'
      | 'timeout'
      | 'provider_failure'
      | 'unsafe_download',
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = 'DigitalHumanProviderError';
  }
}

function classify(status: number): DigitalHumanProviderError {
  if (status === 401 || status === 403)
    return new DigitalHumanProviderError('authentication', '供应商认证失败');
  if (status === 402) return new DigitalHumanProviderError('quota', '供应商余额或额度不足');
  if (status === 413 || status === 415 || status === 422)
    return new DigitalHumanProviderError('invalid_material', '素材不符合供应商要求');
  if (status === 429) return new DigitalHumanProviderError('rate_limited', '供应商限流', true);
  return new DigitalHumanProviderError(
    'provider_failure',
    `供应商请求失败（HTTP ${status}）`,
    status >= 500,
  );
}

/**
 * Built-in provider boundary. `baseUrl` is the operator's Tencent/Volc enterprise
 * gateway because both products expose tenant/contract-specific endpoints. The
 * gateway contract is stable and keeps vendor signing/payload drift outside UI,
 * storage and export code.
 */
class GatewayDigitalHumanAdapter implements DigitalHumanProviderAdapter {
  readonly capabilities;
  private readonly base: URL;

  constructor(
    readonly id: DigitalHumanProviderId,
    private readonly credentials: DigitalHumanCredentials,
  ) {
    this.capabilities = DIGITAL_HUMAN_CAPABILITIES[id];
    this.base = new URL(credentials.baseUrl!);
    if (this.base.protocol !== 'https:' && this.base.hostname !== 'localhost') {
      throw new DigitalHumanProviderError('authentication', '数字人网关必须使用 HTTPS');
    }
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = new URL(path, this.base);
    if (url.origin !== this.base.origin)
      throw new DigitalHumanProviderError('unsafe_download', '拒绝跨域供应商请求');
    if (!this.credentials.trustedEndpoint) {
      const ssrfError = await validateUrlForSSRF(url.toString());
      if (ssrfError) throw new DigitalHumanProviderError('unsafe_download', '数字人网关地址不安全');
    }
    const timestamp = new Date().toISOString();
    const nonce = randomUUID();
    const bodyHash = createHmac('sha256', this.credentials.secretKey)
      .update(typeof init.body === 'string' ? init.body : '')
      .digest('hex');
    const signature = createHmac('sha256', this.credentials.secretKey)
      .update(`${init.method || 'GET'}\n${url.pathname}\n${timestamp}\n${nonce}\n${bodyHash}`)
      .digest('hex');
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
          accept: 'application/json',
          'x-openmaic-provider': this.id,
          'x-openmaic-access-id': this.credentials.accessId,
          'x-openmaic-timestamp': timestamp,
          'x-openmaic-nonce': nonce,
          'x-openmaic-signature': signature,
          ...init.headers,
        },
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === 'TimeoutError' || error.name === 'AbortError')
      ) {
        throw new DigitalHumanProviderError('timeout', '供应商请求超时', true);
      }
      throw new DigitalHumanProviderError('provider_failure', '无法连接数字人供应商', true);
    }
    if (!response.ok) throw classify(response.status);
    return (await response.json()) as T;
  }

  async verifyCredentials(): Promise<void> {
    await this.request('/v1/credentials/verify');
  }

  async createProfile(input: Parameters<DigitalHumanProviderAdapter['createProfile']>[0]) {
    const form = new FormData();
    form.append(
      'video',
      new Blob([new Uint8Array(input.video)], { type: input.mimeType }),
      input.filename,
    );
    if (input.authorization)
      form.append('authorization', new Blob([new Uint8Array(input.authorization)]));
    return this.request<{ remoteJobId: string }>('/v1/profiles', { method: 'POST', body: form });
  }

  getProfileStatus(remoteJobId: string) {
    return this.request<AdapterJobStatus>(`/v1/profile-jobs/${encodeURIComponent(remoteJobId)}`);
  }

  async deleteProfile(remoteProfileId: string): Promise<void> {
    await this.request(`/v1/profiles/${encodeURIComponent(remoteProfileId)}`, { method: 'DELETE' });
  }

  async submitSpeechVideo(input: Parameters<DigitalHumanProviderAdapter['submitSpeechVideo']>[0]) {
    const form = new FormData();
    form.append('profileId', input.remoteProfileId);
    form.append(
      'audio',
      new Blob([new Uint8Array(input.audio)], { type: input.mimeType }),
      'speech',
    );
    form.append(
      'output',
      JSON.stringify({
        width: input.width,
        height: input.height,
        fps: input.fps,
        codec: 'h264',
        pixelFormat: 'yuv420p',
        muted: true,
      }),
    );
    return this.request<{ remoteJobId: string }>('/v1/speech-videos', {
      method: 'POST',
      body: form,
      headers: { 'idempotency-key': input.idempotencyKey },
    });
  }

  getJobStatus(remoteJobId: string) {
    return this.request<AdapterJobStatus>(`/v1/jobs/${encodeURIComponent(remoteJobId)}`);
  }

  async downloadResult(value: string): Promise<Uint8Array> {
    const url = new URL(value, this.base);
    if (url.protocol !== 'https:' || url.origin !== this.base.origin) {
      throw new DigitalHumanProviderError('unsafe_download', '结果下载地址不在配置的供应商域名内');
    }
    if (!this.credentials.trustedEndpoint && (await validateUrlForSSRF(url.toString()))) {
      throw new DigitalHumanProviderError('unsafe_download', '结果下载地址不安全');
    }
    const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!response.ok) throw classify(response.status);
    const declared = Number(response.headers.get('content-length') || 0);
    if (declared > MAX_RESULT_BYTES)
      throw new DigitalHumanProviderError('unsafe_download', '供应商结果超过大小限制');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_RESULT_BYTES)
      throw new DigitalHumanProviderError('unsafe_download', '供应商结果为空或超过大小限制');
    return bytes;
  }
}

export function createDigitalHumanAdapter(
  id: DigitalHumanProviderId,
  credentials: DigitalHumanCredentials,
): DigitalHumanProviderAdapter {
  return new GatewayDigitalHumanAdapter(id, credentials);
}
