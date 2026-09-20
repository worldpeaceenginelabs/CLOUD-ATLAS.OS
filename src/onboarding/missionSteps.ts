// Spotlight tours for the mission panels, each shown once — the first time
// that panel is opened. Same contract as steps.ts / entitySteps.ts: this is
// copy, Onboarding.svelte only renders it.
//
// `target` is a `data-onboarding="…"` attribute inside the panel:
//   Mission 1 (missions/Mission1.svelte)          m1-stars, m1-message, m1-share
//   Mission 2 (missions/SwarmGovernance.svelte)   m2-title, m2-lanes, m2-location, m2-submit
// A step whose element isn't in the DOM (e.g. the location buttons once a
// location is already picked) is skipped with a console warning.

import type { OnboardingStep } from './steps';

export const MISSION1_STEPS: OnboardingStep[] = [
  {
    target: 'm1-stars',
    title: '3 STARS',
    text:
      'Your progress. Earn one star per day, on 3 different days. ' +
      'Three stars complete Mission 1 and unlock the next mission.',
  },
  {
    target: 'm1-message',
    title: 'THE MESSAGE',
    text:
      'This is what goes out with your share. Every person it reaches is a potential customer, ' +
      'passenger, or client, and none of them owe a cut to anyone but you.',
  },
  {
    target: 'm1-share',
    title: 'SHARE',
    text:
      'Pick a network, or copy the text and post it your own way. ' +
      'Your first share of the day earns the star. Come back tomorrow for the next one.',
  },
];

export const MISSION2_STEPS: OnboardingStep[] = [
  {
    target: 'm2-title',
    title: 'NAME THE PROBLEM',
    text:
      'You see a problem in your street, your city, your world. ' +
      'Give it a title and say in a few words what needs to change.',
  },
  {
    target: 'm2-lanes',
    title: 'FOUR WAYS TO ACT',
    text:
      'Give people something to do: brainstorm it, meet and do it, start a petition, or raise funds. ' +
      'Paste a link for each way people can join in. Brainstorm is required, the rest is up to you.',
  },
  {
    target: 'm2-location',
    title: 'PUT IT ON THE MAP',
    text:
      'Pick a point or draw an area. Your mission lands on the globe, ' +
      'so people nearby can find it and join in.',
  },
  {
    target: 'm2-submit',
    title: 'SUBMIT',
    text:
      'Ready? Publish it to the globe. This unlocks once title, description, a Brainstorm link and ' +
      'a location are in. No committee, no NGO, no permission.',
  },
];
