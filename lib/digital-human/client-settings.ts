'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DigitalHumanProviderId } from './types';

interface ProviderCredentials {
  accessId: string;
  secretKey: string;
  baseUrl: string;
}
interface DigitalHumanClientSettings {
  providerId: DigitalHumanProviderId;
  credentials: Record<DigitalHumanProviderId, ProviderCredentials>;
  selectedProfileId?: string;
  setProviderId(id: DigitalHumanProviderId): void;
  setCredentials(id: DigitalHumanProviderId, value: Partial<ProviderCredentials>): void;
  setSelectedProfileId(id?: string): void;
}
const empty = (): ProviderCredentials => ({ accessId: '', secretKey: '', baseUrl: '' });

export const useDigitalHumanSettings = create<DigitalHumanClientSettings>()(
  persist(
    (set) => ({
      providerId: 'tencent-digital-human',
      credentials: { 'tencent-digital-human': empty(), 'volcengine-digital-human': empty() },
      setProviderId: (providerId) => set({ providerId }),
      setCredentials: (id, value) =>
        set((state) => ({
          credentials: { ...state.credentials, [id]: { ...state.credentials[id], ...value } },
        })),
      setSelectedProfileId: (selectedProfileId) => set({ selectedProfileId }),
    }),
    { name: 'openmaic-digital-human-settings' },
  ),
);

export function digitalHumanCredentialHeaders(providerId: DigitalHumanProviderId): HeadersInit {
  const value = useDigitalHumanSettings.getState().credentials[providerId];
  return {
    'x-digital-human-access-id': value.accessId,
    'x-digital-human-secret-key': value.secretKey,
    'x-digital-human-base-url': value.baseUrl,
  };
}

export function appendDigitalHumanCredentials(
  form: FormData,
  providerId: DigitalHumanProviderId,
): void {
  const value = useDigitalHumanSettings.getState().credentials[providerId];
  form.append('accessId', value.accessId);
  form.append('secretKey', value.secretKey);
  form.append('baseUrl', value.baseUrl);
}
