import { describe, expect, it } from 'vitest';
import { DEFAULT_BRAND } from '@/lib/brand/brand-config';

describe('DEFAULT_BRAND (single-brand build)', () => {
  it('uses the ZhiGou AI product identity for full chrome', () => {
    expect(DEFAULT_BRAND.productName).toBe('知构 AI');
    expect(DEFAULT_BRAND.shortName).toBe('知构');
    expect(DEFAULT_BRAND.markSrc).toBe('/brand/mark.svg');
    expect(DEFAULT_BRAND.themeColor).toBe('#176B87');
  });

  it('marks its horizontal logo as already containing the wordmark', () => {
    expect(DEFAULT_BRAND.logoHasWordmark).toBe(true);
    expect(DEFAULT_BRAND.logoSrc).toBe('/brand/logo-horizontal.svg');
    expect(DEFAULT_BRAND.darkLogoSrc).toBe('/brand/logo-horizontal-dark.svg');
  });
});
