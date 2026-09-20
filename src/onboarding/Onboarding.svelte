<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher, tick } from 'svelte';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { fly } from 'svelte/transition';
  import { ONBOARDING_STEPS, ONBOARDING_LABELS } from './steps';
  import type { OnboardingStep } from './steps';

  // Spotlight tour. Used twice, with different steps:
  //   - App.svelte: the first-run tour (default `steps` = steps.ts)
  //   - EntityDetails.svelte: one-step tours for Marketing / Share
  //     (entitySteps.ts)
  // Same contract as About / MissionTV: the parent only knows whether it's
  // open, this component owns its whole chrome and dispatches `close`
  // (detail.completed is true when the person clicked through or skipped,
  // false when there was nothing to show — the parent must not count that
  // as "seen"). What each step says lives in the steps files — nothing
  // here is content.
  //
  // How the spotlight works, in one paragraph: a full-screen dark + blur
  // layer is clipped with an even-odd path (screen rectangle minus the
  // target's outline), so the target underneath shows through *sharp*
  // while everything else is blurred. clip-path also removes the hole from
  // hit-testing, so a separate transparent shield sits on top and swallows
  // every click — the person can't accidentally trigger LIVE/OFFER
  // (operator agreement!) or Delete mid-tour.
  //
  // Where the target is: we just measure a DOM element, so the target
  // components need no changes beyond a tag and don't know this exists.
  //   - HexMenu tags every node `<g data-node-id=…>` (its own drag logic
  //     relies on that) → spotlighted as a hexagon.
  //   - anything else opts in with `data-onboarding="<id>"` → spotlighted
  //     as a rounded rectangle.
  //
  // The overlay is moved to document.body (`portal`), like Location.svelte
  // does: EntityDetails renders inside .globe-window (z-index 20), whose
  // stacking context would otherwise keep the overlay underneath the corner
  // buttons and the hex menu.

  /** Which tour to play. */
  export let steps: OnboardingStep[] = ONBOARDING_STEPS;

  /**
   * Text alignment inside the card. Set explicitly on purpose: the overlay
   * lives in <body> (see `portal`), so it inherits nothing from whatever
   * container the parent sits in. The first-run tour is centered (default);
   * EntityDetails passes "left" to match its left-aligned panel.
   */
  export let align: 'center' | 'left' = 'center';

  const dispatch = createEventDispatcher();

  const SPOT_PADDING = 5;    // px the highlight sits outside a hex
  const RECT_PADDING = 6;    // ... and outside a rectangular target
  const RECT_RADIUS = 14;    // corner radius of that highlight (button radius + padding)
  const CARD_MAX_W = 380;
  const CARD_MAX_W_WELCOME = 460; // welcome cards are read, not glanced at
  const CARD_GAP = 18;       // target → card
  const EDGE = 16;           // card → screen edge

  const reduceMotion =
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  let rootEl: HTMLDivElement;
  let cardEl: HTMLDivElement;
  let nextBtn: HTMLButtonElement;

  /** Move the node to <body> so no ancestor's stacking context can cover it. */
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy() { node.remove(); } };
  }

  // The steps that can actually be shown (targets present) — filled in onMount.
  let list: OnboardingStep[] = steps;
  let index = 0;
  let ready = false;

  $: step = list[index];
  $: isWelcome = !!step && !step.target;
  $: isFirst = index === 0;
  $: isLast = index === list.length - 1;

  // ─── MEASURING ───
  // All coordinates are relative to this component's own root (not the
  // viewport), so safe-area offsets etc. never matter.
  let W = 0;
  let H = 0;
  let shape: 'hex' | 'rect' = 'hex';
  let pointy = true; // hex orientation, read from the measured box

  type Spot = { cx: number; cy: number; w: number; h: number; rad: number };
  let target: Spot = { cx: 0, cy: 0, w: 0, h: 0, rad: 0 }; // where the spotlight is going (drives card placement)

  // Live spotlight. Tweened so hole, ring and card glide from target to
  // target in sync — a CSS transition can't do that for a clip-path on
  // every browser.
  const spot = tweened<Spot>(
    { cx: 0, cy: 0, w: 0, h: 0, rad: 0 },
    { duration: reduceMotion ? 0 : 380, easing: cubicOut }
  );

  function findNode(id: string): Element | null {
    const v = CSS.escape(id);
    return document.querySelector(`[data-node-id="${v}"], [data-onboarding="${v}"]`);
  }

  function measure(instant = false) {
    if (!rootEl || !step) return;

    const root = rootEl.getBoundingClientRect();
    W = root.width;
    H = root.height;

    // Welcome card: no target. The spotlight collapses to a zero-size point
    // in the screen center (the hole closes, the ring disappears), and the
    // next spotlight step opens it again from there — one tween handles both.
    if (!step.target) {
      target = { cx: W / 2, cy: H / 2, w: 0, h: 0, rad: 0 };
      spot.set(target, instant || !ready ? { duration: 0 } : undefined);
      return;
    }

    const el = findNode(step.target);
    if (!el) return;

    const isHex = el.hasAttribute('data-node-id');
    // A target inside a scrolling panel (EntityDetails' .scroll) may sit
    // below the fold. The shield keeps the person from scrolling during
    // the tour, so bring it into view once here. No-op when already visible.
    if (!isHex) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });

    const b = el.getBoundingClientRect();
    const cx = b.left - root.left + b.width / 2;
    const cy = b.top - root.top + b.height / 2;

    if (isHex) {
      // Regular hexagon: pointy-top is taller than wide (h = 2R), flat-top
      // wider than tall (w = 2R). Reading it from the box means this doesn't
      // depend on how geometry.ts's hexPath() happens to be oriented.
      shape = 'hex';
      pointy = b.width < b.height;
      const R = (pointy ? b.height : b.width) / 2 + SPOT_PADDING;
      const S = Math.sqrt(3) * R;
      target = { cx, cy, w: pointy ? S : 2 * R, h: pointy ? 2 * R : S, rad: 0 };
    } else {
      shape = 'rect';
      target = { cx, cy, w: b.width + 2 * RECT_PADDING, h: b.height + 2 * RECT_PADDING, rad: RECT_RADIUS };
    }
    spot.set(target, instant || !ready ? { duration: 0 } : undefined);
  }

  // Re-measure whenever the step changes.
  $: if (rootEl && step) measure();

  // ─── SHAPES (all derived from the tweened spot) ───
  const fmt = (n: number) => n.toFixed(1);

  // Regular hexagon inscribed in a w×h box (pointy-top or flat-top).
  function hexPath(cx: number, cy: number, w: number, h: number, isPointy: boolean): string {
    const pts = isPointy
      ? [[cx, cy - h / 2], [cx + w / 2, cy - h / 4], [cx + w / 2, cy + h / 4],
         [cx, cy + h / 2], [cx - w / 2, cy + h / 4], [cx - w / 2, cy - h / 4]]
      : [[cx + w / 2, cy], [cx + w / 4, cy + h / 2], [cx - w / 4, cy + h / 2],
         [cx - w / 2, cy], [cx - w / 4, cy - h / 2], [cx + w / 4, cy - h / 2]];
    return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${fmt(x)} ${fmt(y)}`).join(' ') + ' Z';
  }

  function roundedRectPath(cx: number, cy: number, w: number, h: number, rad: number): string {
    const x = cx - w / 2;
    const y = cy - h / 2;
    const r = Math.max(0, Math.min(rad, w / 2, h / 2));
    return (
      `M${fmt(x + r)} ${fmt(y)} H${fmt(x + w - r)} A${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(x + w)} ${fmt(y + r)} ` +
      `V${fmt(y + h - r)} A${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(x + w - r)} ${fmt(y + h)} ` +
      `H${fmt(x + r)} A${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(x)} ${fmt(y + h - r)} ` +
      `V${fmt(y + r)} A${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(x + r)} ${fmt(y)} Z`
    );
  }

  $: outline =
    shape === 'rect'
      ? roundedRectPath($spot.cx, $spot.cy, $spot.w, $spot.h, $spot.rad)
      : hexPath($spot.cx, $spot.cy, $spot.w, $spot.h, pointy);
  // Screen rectangle + outline, even-odd → the outline is a hole.
  $: clip = W && H ? `path(evenodd, "M0 0 H${W} V${H} H0 Z ${outline}")` : 'none';

  // ─── CARD PLACEMENT ───
  // Welcome card: centered. Spotlight step: below the target if it fits,
  // else above, else pinned inside the screen.
  // Decided from `target` (not the tween) so it never flips mid-animation;
  // the card itself animates via a CSS transition on left/top.
  let cardH = 0;
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

  $: cardW = Math.min(isWelcome ? CARD_MAX_W_WELCOME : CARD_MAX_W, Math.max(0, W - 2 * EDGE));
  $: cardLeft = clamp(target.cx - cardW / 2, EDGE, Math.max(EDGE, W - cardW - EDGE));
  $: belowTop = target.cy + target.h / 2 + CARD_GAP;
  $: aboveTop = target.cy - target.h / 2 - CARD_GAP - cardH;
  $: cardTop =
    isWelcome ? clamp((H - cardH) / 2, EDGE, Math.max(EDGE, H - cardH - EDGE))
    : belowTop + cardH <= H - EDGE ? belowTop
    : aboveTop >= EDGE ? aboveTop
    : clamp(belowTop, EDGE, Math.max(EDGE, H - cardH - EDGE));

  // ─── NAVIGATION ───
  function focusPrimary() {
    tick().then(() => nextBtn?.focus({ preventScroll: true }));
  }

  function next() {
    if (isLast) return finish();
    index += 1;
    focusPrimary();
  }

  function back() {
    if (isFirst) return;
    index -= 1;
    focusPrimary();
  }

  /** The person went through (or skipped) the tour. */
  function finish() {
    dispatch('close', { completed: true });
  }

  /** Nothing to show (no target found) — close without counting it as seen. */
  function bail() {
    dispatch('close', { completed: false });
  }

  // Capture phase + stopImmediatePropagation: while the tour is up, Escape
  // must dismiss *only* the tour — EntityDetails' own window-level Escape
  // handler would otherwise close the whole panel behind it.
  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); finish(); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); e.stopImmediatePropagation(); next(); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopImmediatePropagation(); back(); return; }

    // Minimal focus trap: the corner buttons behind the overlay are still
    // tabbable, and Enter on one of them would act through the dim layer.
    if (e.key === 'Tab' && cardEl) {
      const focusables = Array.from(cardEl.querySelectorAll('button'));
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (!cardEl.contains(active)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    }
  }

  // ─── LIFECYCLE ───
  let resizeObserver: ResizeObserver | undefined;
  const gradId = 'onb_grad_' + Math.random().toString(36).slice(2);
  const glowId = 'onb_glow_' + Math.random().toString(36).slice(2);

  onMount(async () => {
    // Let the target finish its first layout pass (HexMenu settles its
    // scale in its own onMount / ResizeObserver) before measuring anything.
    await tick();
    await new Promise<void>((res) => requestAnimationFrame(() => res()));

    // Skip spotlight steps whose target doesn't exist rather than
    // spotlighting nothing. Welcome cards have no target and always stay.
    list = steps.filter((s) => {
      if (!s.target) return true;
      const ok = !!findNode(s.target);
      if (!ok) {
        console.warn(
          `[onboarding] no element with data-node-id / data-onboarding="${s.target}" — step skipped`
        );
      }
      return ok;
    });
    if (!list.length) { bail(); return; }

    await tick();
    measure(true);
    ready = true;
    focusPrimary();

    // Window resize, orientation change, landscape↔portrait switch: the
    // targets move, so the spotlight has to follow. One frame of delay lets
    // the target's own ResizeObserver (registered earlier) re-layout first.
    resizeObserver = new ResizeObserver(() => requestAnimationFrame(() => measure(true)));
    resizeObserver.observe(rootEl);
  });

  onDestroy(() => {
    if (resizeObserver) resizeObserver.disconnect();
  });
</script>

<svelte:window on:keydown|capture={onKeydown} />

<div
  class="onb"
  class:ready
  use:portal
  bind:this={rootEl}
  role="dialog"
  aria-modal="true"
  aria-labelledby="onb-title"
>
  <!-- Swallows every pointer event (the hole in .dim would let them through) -->
  <div class="shield"></div>

  <div class="dim" style="clip-path: {clip}; -webkit-clip-path: {clip};"></div>

  <svg class="ring" width={W} height={H} viewBox="0 0 {W} {H}" aria-hidden="true">
    <defs>
      <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#335bf4" />
        <stop offset="100%" stop-color="#2ae9c9" />
      </linearGradient>
      <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="5" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {#if $spot.w > 4}
      <path
        d={outline}
        fill="none"
        stroke="url(#{gradId})"
        stroke-width="3"
        stroke-linejoin="round"
        filter="url(#{glowId})"
      >
        <animate attributeName="stroke-opacity" values="0.65;1;0.65" dur="2.2s" repeatCount="indefinite" />
      </path>
    {/if}
  </svg>

  {#if ready && step}
    <div
      class="card"
      class:welcome={isWelcome}
      bind:this={cardEl}
      bind:clientHeight={cardH}
      style="left:{cardLeft}px; top:{cardTop}px; width:{cardW}px; text-align:{align};"
    >
      <div class="scroll">
      {#key index}
        <div class="body" in:fly={{ y: 8, duration: reduceMotion ? 0 : 240 }}>
          {#if list.length > 1}
            <div class="meta">
              <span class="progress">{ONBOARDING_LABELS.progress(index + 1, list.length)}</span>
              <span class="dots" aria-hidden="true">
                {#each list as _, i}
                  <i class:active={i === index}></i>
                {/each}
              </span>
            </div>
          {/if}

          <h2 id="onb-title">{step.title}</h2>
          {#if step.comingSoon}
            <span class="chip">{ONBOARDING_LABELS.comingSoon}</span>
          {/if}
          {#each step.text.split('\n\n') as para}
            <p>{para}</p>
          {/each}
        </div>
      {/key}
      </div>

      <div class="footer">
        {#if !isLast}
          <button class="link" on:click={finish}>{ONBOARDING_LABELS.skip}</button>
        {:else}
          <span></span>
        {/if}
        <div class="actions">
          {#if !isFirst}
            <button class="ghost" on:click={back}>{ONBOARDING_LABELS.back}</button>
          {/if}
          <button class="primary" bind:this={nextBtn} on:click={next}>
            {step.cta ?? (isLast ? ONBOARDING_LABELS.done : ONBOARDING_LABELS.next)}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .onb {
    position: fixed; /* lives in document.body (see `portal` in the script) */
    inset: 0;
    z-index: 20000; /* above the corner buttons (1000), the globe-window (20) and the mission panels (9999) */
    overflow: hidden;
    opacity: 0;
    transition: opacity 0.35s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    -webkit-font-smoothing: antialiased;
    color: #fff;
  }

  .onb.ready {
    opacity: 1;
  }

  .shield {
    position: absolute;
    inset: 0;
  }

  /* Dark + blur everywhere except the hexagon-shaped hole (clip-path is set
     inline from the tweened spotlight). --onb-blur is the one knob to turn
     down if blurring over the Cesium canvas is too heavy on weak phones. */
  .dim {
    position: absolute;
    inset: 0;
    background: rgba(6, 9, 20, 0.66);
    -webkit-backdrop-filter: blur(var(--onb-blur, 6px));
    backdrop-filter: blur(var(--onb-blur, 6px));
    pointer-events: none;
  }

  .ring {
    position: absolute;
    left: 0;
    top: 0;
    pointer-events: none;
    overflow: visible;
  }

  /* ─── Card — same glass language as the corner buttons ─── */
  .card {
    position: absolute;
    box-sizing: border-box;
    max-height: calc(100% - 32px);
    display: flex;
    flex-direction: column;
    padding: 20px 22px 18px;
    border-radius: 18px;
    background: rgba(17, 20, 32, 0.84);
    border: 1px solid rgba(255, 255, 255, 0.18);
    -webkit-backdrop-filter: blur(16px);
    backdrop-filter: blur(16px);
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.5);
    transition:
      left 0.38s cubic-bezier(0.22, 1, 0.36, 1),
      top 0.38s cubic-bezier(0.22, 1, 0.36, 1);
  }

  /* Only the text scrolls (small landscape phones, long welcome cards);
     the footer with the buttons stays pinned inside the card. */
  .scroll {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .progress {
    font-size: 12px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.55);
  }

  .dots {
    display: flex;
    gap: 6px;
  }

  .dots i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.25);
    transition: background 0.25s, transform 0.25s;
  }

  .dots i.active {
    background: #2ae9c9;
    transform: scale(1.25);
  }

  h2 {
    margin: 0 0 8px;
    font-size: 22px;
    line-height: 1.2;
    letter-spacing: 0.5px;
    background: linear-gradient(90deg, #8fb0ff, #2ae9c9);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
    display: inline-block;
    text-wrap: balance; /* long titles split evenly instead of leaving one word */
  }

  .chip {
    display: inline-block;
    margin-left: 10px;
    padding: 2px 10px;
    border-radius: 999px;
    border: 1px solid rgba(42, 233, 201, 0.6);
    color: #2ae9c9;
    font-size: 11px;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    vertical-align: middle;
  }

  p {
    margin: 0;
    font-size: 15px;
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.88);
    white-space: pre-line; /* a single "\n" in steps.ts stays a line break */
    text-wrap: pretty;     /* avoids one-word last lines where supported */
  }

  /* "\n\n" in steps.ts = paragraph break, spaced tighter than a blank line */
  p + p {
    margin-top: 0.75em;
  }

  /* Welcome cards: bigger type, more air */
  .card.welcome {
    padding: 26px 28px 22px;
  }

  .card.welcome h2 {
    font-size: 26px;
  }

  .card.welcome p {
    font-size: 16px;
    line-height: 1.55;
  }

  .footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex: 0 0 auto;
    margin-top: 18px;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
  }

  button {
    font: inherit;
    font-size: 14px;
    cursor: pointer;
    border-radius: 10px;
    padding: 10px 16px;
    min-height: 40px;
    border: 1px solid transparent;
    transition: background 0.2s, transform 0.2s, box-shadow 0.2s;
  }

  button:focus-visible {
    outline: 2px solid #8fb0ff;
    outline-offset: 2px;
  }

  .primary {
    background: #335bf4;
    color: #fff;
    font-weight: 700;
    box-shadow: 0 0 0 1px rgba(143, 176, 255, 0.5), 0 6px 20px rgba(51, 91, 244, 0.45);
  }

  .primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 0 0 1px rgba(143, 176, 255, 0.8), 0 8px 24px rgba(51, 91, 244, 0.6);
  }

  .ghost {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.3);
    color: #fff;
  }

  .ghost:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .link {
    background: none;
    padding-left: 0;
    padding-right: 0;
    color: rgba(255, 255, 255, 0.6);
  }

  .link:hover {
    color: #fff;
  }

  @media (prefers-reduced-motion: reduce) {
    .card,
    .onb,
    .dots i {
      transition: none;
    }
  }
</style>
