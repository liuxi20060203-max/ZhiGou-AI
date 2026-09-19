import { createHash } from 'node:crypto';
import type { DigitalHumanCredentials, DigitalHumanProviderId } from './types';

const PREFIX: Record<DigitalHumanProviderId, string> = {
  'tencent-digital-human': 'DIGITAL_HUMAN_TENCENT',
  'volcengine-digital-human': 'DIGITAL_HUMAN_VOLCENGINE',
};

export function digitalHumanFeatureAvailable(): boolean {
  return (
    ['true', '1'].includes(process.env.NEXT_PUBLIC_ENABLE_DIGITAL_HUMAN_EXPORT || '') &&
    Boolean(process.env.DATABASE_URL)
  );
}

export function serverProviderState(providerId: DigitalHumanProviderId) {
  const prefix = PREFIX[providerId];
  const disabled = process.env[`${prefix}_ENABLED`] === 'false';
  const accessId = process.env[`${prefix}_ACCESS_ID`] || '';
  const secretKey = process.env[`${prefix}_SECRET_KEY`] || '';
  const baseUrl = process.env[`${prefix}_BASE_URL`] || '';
  return { enabled: !disabled, serverConfigured: Boolean(accessId && secretKey && baseUrl) };
}

export function resolveDigitalHumanCredentials(
  providerId: DigitalHumanProviderId,
  supplied?: Partial<DigitalHumanCredentials>,
): DigitalHumanCredentials {
  const prefix = PREFIX[providerId];
  const state = serverProviderState(providerId);
  if (!state.enabled) throw new Error('PROVIDER_DISABLED');
  const credentials = state.serverConfigured
    ? {
        accessId: process.env[`${prefix}_ACCESS_ID`]!,
        secretKey: process.env[`${prefix}_SECRET_KEY`]!,
        baseUrl: process.env[`${prefix}_BASE_URL`]!,
        trustedEndpoint: true,
      }
    : {
        accessId: supplied?.accessId?.trim() || '',
        secretKey: supplied?.secretKey || '',
        baseUrl: supplied?.baseUrl?.trim() || '',
        trustedEndpoint: false,
      };
  if (!credentials.accessId || !credentials.secretKey || !credentials.baseUrl) {
    throw new Error('INVALID_CREDENTIALS');
  }
  return credentials;
}

export function credentialFingerprint(credentials: DigitalHumanCredentials): string {
  return createHash('sha256')
    .update(`${credentials.accessId}\0${new URL(credentials.baseUrl!).origin}`)
    .digest('hex');
}
