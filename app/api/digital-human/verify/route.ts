import { createDigitalHumanAdapter, DigitalHumanProviderError } from '@/lib/digital-human/adapters';
import { parseProviderId, requestCredentials } from '@/lib/digital-human/server';
import { resolveDigitalHumanCredentials } from '@/lib/digital-human/server-config';

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const providerId = parseProviderId(form.get('providerId'));
    if (!providerId)
      return Response.json({ success: false, error: '无效 Provider' }, { status: 400 });
    const adapter = createDigitalHumanAdapter(
      providerId,
      resolveDigitalHumanCredentials(providerId, requestCredentials(form)),
    );
    await adapter.verifyCredentials();
    return Response.json({ success: true });
  } catch (error) {
    const code =
      error instanceof DigitalHumanProviderError
        ? error.code
        : error instanceof Error
          ? error.message
          : 'provider_failure';
    return Response.json(
      { success: false, error: code },
      { status: code === 'authentication' || code === 'INVALID_CREDENTIALS' ? 401 : 502 },
    );
  }
}
