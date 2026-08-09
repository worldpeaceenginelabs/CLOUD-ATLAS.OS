// hexMessages.ts
//
// Ambient flavor text HexMenu.svelte fades in and out in the
// background (see showMessage() there). Pure decorative/marketing
// copy for this particular app — kept separate from domains.ts because
// it has nothing to do with the DOMAIN/MODEL data model. A different
// app reusing the hex-menu engine swaps this file out; domains.ts's
// fachliche structure is untouched either way.
export const HEX_MESSAGES: string[] = [
    "An independent, community-owned Earth, free from centralized servers and overpowered entities, owned solely by you and the public!",
    "IT'S FREE! More users mean more app storage and computational power. No back-end needed! Syncs via public tracker networks.",
    "Decentralization places the globe within your grasp, ensuring your voice resonates daily, not merely at the ballot box every few years.",
  ];