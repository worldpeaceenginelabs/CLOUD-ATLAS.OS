const FLAG_OPERATOR_AGREEMENT = 'operatorAgreementAccepted';
const FLAG_WELCOME_DISMISSED = 'welcomeMessageDismissed';

function getFlag(key: string): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(key) === 'true';
}

function setFlag(key: string, value: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, value ? 'true' : 'false');
}

export function isOperatorAgreementAccepted(): boolean {
  return getFlag(FLAG_OPERATOR_AGREEMENT);
}

export function setOperatorAgreementAccepted(value: boolean): void {
  setFlag(FLAG_OPERATOR_AGREEMENT, value);
}

export function isWelcomeMessageDismissed(): boolean {
  return getFlag(FLAG_WELCOME_DISMISSED);
}

export function setWelcomeMessageDismissed(value: boolean): void {
  setFlag(FLAG_WELCOME_DISMISSED, value);
}
