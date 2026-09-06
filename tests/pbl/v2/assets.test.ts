import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

function expectPng(path: string) {
  const bytes = readFileSync(path);

  expect(bytes.length).toBeGreaterThan(0);
  expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
}

function expectSvg(path: string) {
  const text = readFileSync(path, 'utf8');

  expect(text).toContain('<svg');
  expect(text).toContain('</svg>');
}

describe('PBL v2 static assets', () => {
  test('ships the instructor avatar referenced by the runtime UI', () => {
    expectPng('public/avatars/instructor.png');
  });

  test('ships the ZhiGou AI mark used in the workspace header', () => {
    expectSvg('public/brand/mark.svg');
  });
});
