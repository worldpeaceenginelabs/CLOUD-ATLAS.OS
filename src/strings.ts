/**
 * strings.ts — UI texts that live outside the components.
 *
 * Only the profile panel uses it so far; same shape as in other projects
 * (`strings.<area>.<key>`), so texts can move in and out unchanged.
 */

export const strings = {
  profile: {
    heading: 'Profile',
    pubkeyHeading: 'Public key',
    pubkeyInfo: 'Your public key is your identity. You can share it freely.',
    pubkeyNpub: 'npub (to share)',
    pubkeyHex: 'Hex (for configuration)',
    pubkeyCopyFailed: 'Copying is not possible – please select the key by hand.',
    listingsHeading: 'My listings',
    listingsEmpty: 'You have no active listings.',
    missionsHeading: 'My missions',
    missionsEmpty: 'You have no active missions.',
    keyHeading: 'Back up private key',
    keyWarning: 'Anyone who knows this key can publish in your name. Never share it.',
    keyShow: 'Show key',
    keyHide: 'Hide',
    keyCopy: 'Copy',
    keyCopied: 'Copied!',
    keyCopyFailed: 'Copying is not possible – please select the key by hand.',
    keyExportFailed: 'The key could not be loaded.',
    importHeading: 'Import key',
    importWarning: 'Importing replaces the key on this device. Back up the current key first, otherwise its listings and missions can no longer be edited.',
    importPlaceholder: 'nsec… or 64 hex characters',
    importButton: 'Import',
    importInvalid: 'This is not a valid key. Paste an nsec… or 64 hex characters.',
    importFailed: 'The key could not be saved.',
    reloadNotice: 'Key saved. Reload the app to activate it.',
    reload: 'Reload',
  },
} as const;
