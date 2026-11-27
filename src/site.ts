// The deployed address. Canonical and hreflang URLs use it; override with SITE_ORIGIN for a fork.
export const SITE_ORIGIN = (process.env.SITE_ORIGIN ?? 'https://longevity.xiaoxiaodong.ai').replace(/\/+$/, '');

// localStorage key the kit's boot.js uses for the reader's appearance choice.
export const APPEARANCE_KEY = 'healthy-ui';

export const SOURCE_REPO = 'https://github.com/nevertoday/longevity-evidence';

export const UPSTREAM_CONTRIBUTING = 'https://github.com/geekan/HowToLiveLonger/blob/main/CONTRIBUTING.md';
