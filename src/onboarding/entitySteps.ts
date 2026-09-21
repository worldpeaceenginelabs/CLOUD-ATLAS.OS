// One-step tours for EntityDetails.svelte — the panel that opens when you
// click a listing or mission on the globe. Same contract as steps.ts (this
// is copy, Onboarding.svelte only renders it), kept in its own file so the
// first-run tour's copy stays untouched.
//
// `target` is a `data-onboarding="…"` attribute on the button inside
// EntityDetails. Each tour is shown once per device, the first time the
// person opens a post of that kind:
//   - their OWN post          → ENTITY_OWNER_STEPS   (Marketing button)
//   - SOMEONE ELSE's post     → ENTITY_VISITOR_STEPS (Share button)

import type { OnboardingStep } from './steps';

export const ENTITY_OWNER_STEPS: OnboardingStep[] = [
  {
    target: 'entity-marketing',
    title: 'MARKETING',
    cta: 'Got it',
    text:
      'This is your post, so this is your megaphone. Get a link that opens this exact post on the globe ' +
      'and share it anywhere: chats, socials, flyers. Free promotion, no ad budget, nobody takes a cut.',
  },
];

export const ENTITY_VISITOR_STEPS: OnboardingStep[] = [
  {
    target: 'entity-share',
    title: 'SHARE',
    cta: 'Got it',
    text:
      'Know someone who would love this? Get a link that opens this exact post on the globe ' +
      'and send it to the right human. No ads, no middleman, just people passing it on.',
  },
];
