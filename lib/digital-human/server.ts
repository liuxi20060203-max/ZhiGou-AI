import 'server-only';
import { getServerPersistenceProvider } from '@/lib/persistence/server-provider';
import { DigitalHumanStore } from './store';
import {
  DIGITAL_HUMAN_PROVIDERS,
  type DigitalHumanCredentials,
  type DigitalHumanProviderId,
} from './types';

export async function digitalHumanContext() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('PERSISTENCE_UNAVAILABLE');
  const provider = await getServerPersistenceProvider(connectionString);
  return { provider, store: new DigitalHumanStore(provider.pool) };
}

export function parseProviderId(value: unknown): DigitalHumanProviderId | null {
  return typeof value === 'string' && (DIGITAL_HUMAN_PROVIDERS as readonly string[]).includes(value)
    ? (value as DigitalHumanProviderId)
    : null;
}

/** BYOK values arrive only on this request and are never echoed or logged. */
export function requestCredentials(form: FormData): Partial<DigitalHumanCredentials> {
  return {
    accessId: String(form.get('accessId') || ''),
    secretKey: String(form.get('secretKey') || ''),
    baseUrl: String(form.get('baseUrl') || ''),
  };
}

export function headerCredentials(req: Request): Partial<DigitalHumanCredentials> {
  return {
    accessId: req.headers.get('x-digital-human-access-id') || '',
    secretKey: req.headers.get('x-digital-human-secret-key') || '',
    baseUrl: req.headers.get('x-digital-human-base-url') || '',
  };
}

export function ownerJson(body: unknown, status: number, responseHeaders: Headers): Response {
  const headers = new Headers(responseHeaders);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(body), { status, headers });
}
