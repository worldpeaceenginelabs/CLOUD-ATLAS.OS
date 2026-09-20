// Onboarding content — the ONLY place with tour copy. Same split as
// domains.ts / hexMessages.ts: this file owns ids and text, Onboarding.svelte
// only renders whatever is listed here.
//
// `target` is the hex's `data-node-id` in HexMenu, i.e. the MODES[].id from
// domains.ts. Steps play in array order. A step whose target hex isn't in
// the DOM (typo, mode removed) is skipped with a console warning, so a wrong
// id here can never spotlight "nothing".

export type OnboardingStep = {
  target: string;
  title: string;
  text: string;
  /** Shows a "coming soon" chip on the card (inert hexes like BBQ). */
  comingSoon?: boolean;
};

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    target: 'live',
    title: 'LIVE',
    text: 'Alles, was jetzt passiert: Such oder biete zum Beispiel eine Fahrt in Echtzeit – direkt auf dem Globus, ohne Umwege.',
  },
  {
    target: 'listings',
    title: 'LISTINGS',
    text: 'Biete etwas an oder such etwas – von Mobilität über Waren und Essen bis zu Fähigkeiten. Kategorie, Ort und Details wählen, und dein Eintrag erscheint auf dem Globus.',
  },
  {
    target: 'next',
    title: 'NEXT',
    text: 'Hier warten die Missionen. Starte mit Mission 1 – wer sie abschließt, schaltet die nächste frei.',
  },
  {
    target: 'bbq',
    title: 'BBQ',
    text: 'Hier entsteht gerade etwas Neues. Mehr verraten wir noch nicht – schau bald wieder vorbei.',
    comingSoon: true,
  },
];

export const ONBOARDING_LABELS = {
  next: 'Weiter',
  back: 'Zurück',
  skip: 'Überspringen',
  done: 'Los geht’s',
  comingSoon: 'Bald verfügbar',
  progress: (i: number, n: number) => `Schritt ${i} von ${n}`,
};
