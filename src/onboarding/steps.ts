// Onboarding content — the ONLY place with tour copy. Same split as
// domains.ts / hexMessages.ts: this file owns ids and text, Onboarding.svelte
// only renders whatever is listed here.
//
// Two kinds of step, played in array order:
//   - welcome card: no `target` — centered card, no spotlight
//   - spotlight step: `target` = the hex's `data-node-id` in HexMenu, i.e.
//     MODES[].id from domains.ts. A step whose hex isn't in the DOM (typo,
//     mode removed) is skipped with a console warning, so a wrong id here
//     can never spotlight "nothing".
//
// `text` keeps its line breaks (white-space: pre-line) — "\n\n" makes a
// paragraph break.

export type OnboardingStep = {
  /** Omitted = welcome card (no spotlight). */
  target?: string;
  title: string;
  text: string;
  /** Shows a "coming soon" chip next to the title. */
  comingSoon?: boolean;
  /** Overrides the "Next" button label for this step only. */
  cta?: string;
};

export const ONBOARDING_STEPS: OnboardingStep[] = [
  // ─── Welcome cards ───
  {
    title: 'FREE YOUR WORK',
    text:
      'Here is your new operating system. But: F*** the system. Just operate.\n\n' +
      'Not: “Become an entrepreneur and learn the entire system first.”\n\n' +
      'Instead: you have a skill. You want to put it to work. Cloud Atlas OS gives you the infrastructure. ' +
      'You work. You earn. You handle your own taxes. Done.',
  },
  {
    title: 'FREE YOUR WORK',
    text:
      'Cloud Atlas OS is a so-called superapp. Imagine owning Uber, Airbnb, DoorDash, Upwork, Fiverr, Couchsurfing, Kickstarter, Twitch, Wikipedia, and an App Store, all at once. ' +
      'But community owned. Zero commission. Zero fees. Free. Forever. Nobody takes a cut. Ever.\n\n' +
      'We are planning to cross $1 billion in the first year, in collective savings to workers. ' +
      'Not revenue. Savings. Yours! Not ours.',
  },
  {
    title: 'FREE YOUR CITY',
    text:
      'Flip the script on any bad news! Take any flood, fire, drought, blackout, eviction, protest, injustice, crisis, or failure — or any everyday issue, whether local or global — and turn it into a public brainstorming.\n\n' +
      'Then you organize people around it: a petition, funding, ' +
      'or just enough people, same place, same time, with the right tools. From your street to the entire planet.\n\n' +
      'This works for entrepreneurs and builders too. Skip the guesswork: prototype through public brainstorms, with the people who will actually use it, and let their feedback shape it before you’ve built it. What survives this contact with reality beats what sounded good in a pitch deck. And once it’s ready, the same tools take it from prototype to the street.\n\n' +
      'No committee. No NGO. No permission. Just people, intent, and lawful action.\n\n' +
      'Before, the city happened to you. Now you happen to the city.',
  },
  {
    title: 'UNDERSTAND YOUR WORLD',
    comingSoon: true,
    text:
      'Omnipedia. Imagine taking all 6 million Wikipedia articles and turning them into a videogame on a 3D globe — and literally letting the articles eat each other. ' +
      'A living movie of Earth, where every article is a place, and every era is a timestamp. Navigable, contributable, owned by no one and everyone.',


  },
  {
    title: 'INHABIT IT DIFFERENTLY',
    comingSoon: true,
    cta: 'Show me around',
    text:
      'Collective land conservation. We buy land to do literally NOTHING with it. No extraction. No concrete. ' +
      'Temporary, reversible, minimal structures. A network of protected habitats where humans learn to exist ' +
      'more lightly on Earth.',
  },

  // ─── Spotlight steps (one per header hex in HexMenu) ───
  {
    target: 'live',
    title: 'LIVE',
    text:
      'Right now, right here. Need a ride, or driving anyway? Match with someone nearby in real time. ' +
      'Money, swap, share, free: you choose. Zero commission. Ridehailing is first; more live services will follow.',
  },
  {
    target: 'listings',
    title: 'LISTINGS',
    text:
      'Offer what you have, find what you need. Rides, rooms, meals, tools, skills, socializing, volunteer projects: post it on the ' +
      'globe, or find the right human for the thing you want to do right now. Money, swap, share, free. ' +
      'You set the terms. Zero commission.',
  },
  {
    target: 'next',
    title: 'NEXT',
    text:
      'One app, one flow, four missions to change how we work, govern, learn and live. ' +
      'Before, the world happened to you. Now you happen to the world. Finish the first one to unlock the next.',
  },
  {
    target: 'bbq',
    title: 'BBQ',
    comingSoon: true,
    text: 'BBQ Circus: a very special campfire in the park, run by the community. Host one in your city.',
  },
];

export const ONBOARDING_LABELS = {
  next: 'Next',
  back: 'Back',
  skip: 'Skip',
  done: 'Let’s go',
  comingSoon: 'Coming soon',
  progress: (i: number, n: number) => `Step ${i} of ${n}`,
};
