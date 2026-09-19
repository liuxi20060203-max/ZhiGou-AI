import { DIGITAL_HUMAN_CAPABILITIES, DIGITAL_HUMAN_PROVIDERS } from '@/lib/digital-human/types';
import {
  digitalHumanFeatureAvailable,
  serverProviderState,
} from '@/lib/digital-human/server-config';

export async function GET() {
  return Response.json(
    {
      enabled: digitalHumanFeatureAvailable(),
      providers: DIGITAL_HUMAN_PROVIDERS.map((id) => ({
        ...DIGITAL_HUMAN_CAPABILITIES[id],
        ...serverProviderState(id),
      })),
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
