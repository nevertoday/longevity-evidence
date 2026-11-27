// Set SITE_ORIGIN to the deployed address before a real build. Canonical and hreflang URLs use it.
export const SITE_ORIGIN = (process.env.SITE_ORIGIN ?? 'https://example.org').replace(/\/+$/, '');

// localStorage key the kit's boot.js uses for the reader's appearance choice.
export const APPEARANCE_KEY = 'healthy-ui';

export const UPSTREAM_CONTRIBUTING = 'https://github.com/geekan/HowToLiveLonger/blob/main/CONTRIBUTING.md';
