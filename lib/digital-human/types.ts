export const DIGITAL_HUMAN_PROVIDERS = [
  'tencent-digital-human',
  'volcengine-digital-human',
] as const;

export type DigitalHumanProviderId = (typeof DIGITAL_HUMAN_PROVIDERS)[number];
export type DigitalHumanProfileStatus =
  | 'creating'
  | 'ready'
  | 'failed'
  | 'deleting'
  | 'delete_failed';
export type DigitalHumanJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface DigitalHumanCapabilities {
  providerId: DigitalHumanProviderId;
  displayName: string;
  acceptedVideoMimeTypes: readonly string[];
  minVideoSeconds: number;
  maxVideoSeconds: number;
  maxVideoBytes: number;
  maxAudioSeconds: number;
  concurrency: number;
  output: { container: 'mp4'; codec: 'h264'; pixelFormat: 'yuv420p'; muted: true };
  materialGuidance: readonly string[];
}

export const DIGITAL_HUMAN_CAPABILITIES: Record<DigitalHumanProviderId, DigitalHumanCapabilities> =
  {
    'tencent-digital-human': {
      providerId: 'tencent-digital-human',
      displayName: '腾讯云智能数智人',
      acceptedVideoMimeTypes: ['video/mp4', 'video/quicktime'],
      minVideoSeconds: 5,
      maxVideoSeconds: 300,
      maxVideoBytes: 500 * 1024 * 1024,
      maxAudioSeconds: 600,
      concurrency: 2,
      output: { container: 'mp4', codec: 'h264', pixelFormat: 'yuv420p', muted: true },
      materialGuidance: [
        '正脸单人出镜',
        '保持头肩完整、无遮挡',
        '背景稳定、光线均匀',
        '提交本人或合法授权材料',
      ],
    },
    'volcengine-digital-human': {
      providerId: 'volcengine-digital-human',
      displayName: '火山引擎数字人',
      acceptedVideoMimeTypes: ['video/mp4', 'video/quicktime'],
      minVideoSeconds: 5,
      maxVideoSeconds: 300,
      maxVideoBytes: 500 * 1024 * 1024,
      maxAudioSeconds: 720,
      concurrency: 1,
      output: { container: 'mp4', codec: 'h264', pixelFormat: 'yuv420p', muted: true },
      materialGuidance: [
        '正脸单人出镜',
        '避免大幅转身和快速动作',
        '五官、口部无遮挡',
        '提交本人或合法授权材料',
      ],
    },
  };

export interface DigitalHumanCredentials {
  accessId: string;
  secretKey: string;
  baseUrl?: string;
  /** Set only by server configuration; permits an operator-controlled private gateway. */
  trustedEndpoint?: boolean;
}

export interface DigitalHumanProfile {
  id: string;
  providerId: DigitalHumanProviderId;
  name: string;
  status: DigitalHumanProfileStatus;
  thumbnailAssetId?: string;
  errorCode?: string;
  errorMessage?: string;
  consentVersion: string;
  consentAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdapterJobStatus {
  status: DigitalHumanJobStatus;
  progress: number;
  remoteProfileId?: string;
  downloadUrl?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface DigitalHumanProviderAdapter {
  readonly id: DigitalHumanProviderId;
  readonly capabilities: DigitalHumanCapabilities;
  verifyCredentials(): Promise<void>;
  createProfile(input: {
    video: Uint8Array;
    mimeType: string;
    filename: string;
    authorization?: Uint8Array;
  }): Promise<{ remoteJobId: string }>;
  getProfileStatus(remoteJobId: string): Promise<AdapterJobStatus>;
  deleteProfile(remoteProfileId: string): Promise<void>;
  submitSpeechVideo(input: {
    remoteProfileId: string;
    audio: Uint8Array;
    mimeType: string;
    idempotencyKey: string;
    width: number;
    height: number;
    fps: number;
  }): Promise<{ remoteJobId: string }>;
  getJobStatus(remoteJobId: string): Promise<AdapterJobStatus>;
  downloadResult(url: string): Promise<Uint8Array>;
}
