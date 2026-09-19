import { afterEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import { POST } from '@/app/api/learning-loop/repair-plan/route';

describe('repair plan route gate', () => {
  const original = process.env.OPENMAIC_LEARNING_LOOP_AI_ENABLED;

  afterEach(() => {
    if (original === undefined) delete process.env.OPENMAIC_LEARNING_LOOP_AI_ENABLED;
    else process.env.OPENMAIC_LEARNING_LOOP_AI_ENABLED = original;
  });

  it('stays unavailable by default so the client uses its deterministic fallback', async () => {
    delete process.env.OPENMAIC_LEARNING_LOOP_AI_ENABLED;
    const response = await POST(
      new NextRequest('http://localhost/api/learning-loop/repair-plan', {
        method: 'POST',
        body: '{}',
      }),
    );
    expect(response.status).toBe(404);
  });
});
