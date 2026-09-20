<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher, tick } from 'svelte';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { fly } from 'svelte/transition';
  import { ONBOARDING_STEPS, ONBOARDING_LABELS } from './steps';

  // First-run spotlight tour. Same contract as About / MissionTV: App.svelte
  // only knows whether it's open, this component owns its whole chrome and
  // dispatches `close` (both for "Los geht's" and for "Überspringen" — App
  // treats both as "seen").
  //
  // How the spotlight works, in one paragraph: a full-screen dark + blur
  // layer is clipped with an even-odd path (screen rectangle minus a hexagon),
  // so the hex underneath shows through *sharp* while everything else is
  // blurred. clip-path also removes the hole from hit-testing, so a separate
  // transparent shield sits on top and swallows every click — the person can't
  // accidentally trigger LIVE/OFFER (operator agreement!) mid-tour.
  //
  // Where the hex is: HexMenu already tags every node `<g data-node-id=…>`
  // (its own drag logic relies on that), so we just measure that element —
  // HexMenu needs no changes and doesn't know this component exists.

  const dispatch = createEventDispatcher();

  const SPOT_PADDING = 5;   // px the highlight sits outside the hex
  const CARD_MAX_W = 380;
  const CARD_GAP = 18;      // hex → card
  const EDGE = 16;          // card → screen edge

  const reduceMotion =
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  let rootEl: HTMLDivElement;
  let cardEl: HTMLDivElement;
  let nextBtn: HTMLButtonElement;

  let steps = ONBOARDING_STEPS;
  let index = 0;
  let ready = false;

  $: step = steps[index];
  $: isFirst = index === 0;
  $: isLast = index === steps.length - 1;

  // ─── MEASURING ───
  // All coordinates are relative to this component's own root (not the
  // viewport), so safe-area offsets etc. never matter.
  let W = 0;
  let H = 0;
  let pointy = true; // hex orientation, read from the measured box
  let target = { cx: 0, cy: 0, r: 0 }; // where the spotlight is going (drives card placement)

  // Live spotlight. Tweened so hole, ring and card glide from hex to hex in
  // sync — a CSS transition can't do that for a clip-path on every browser.
  const spot = tweened(
    { cx: 0, cy: 0, r: 0 },
    { duration: reduceMotion ? 0 : 380, easing: cubicOut }
  );

  function findNode(id: string): Element | null {
    return document.querySelector(`[data-node-id="${CSS.escape(id)}"]`);
  }

  function measure(instant = false) {
    if (!rootEl || !step) return;
    const el = findNode(step.target);
    if (!el) return;

    const root = rootEl.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    W = root.width;
    H = root.height;

    // Regular hexagon: pointy-top is taller than wide (h = 2R), flat-top
    // wider than tall (w = 2R). Reading it from the box means this doesn't
    // depend on how geometry.ts's hexPath() happens to be oriented.
    pointy = b.width < b.height;
    const r = (pointy ? b.height : b.width) / 2 + SPOT_PADDING;

    target = {
      cx: b.left - root.left + b.width / 2,
      cy: b.top - root.top + b.height / 2,
      r,
    };
    spot.set(target, instant || !ready ? { duration: 0 } : undefined);
  }

  // Re-measure whenever the step changes.
  $: if (rootEl && step) measure();

  // ─── SHAPES (all derived from the tweened spot) ───
  function hexPoints(cx: number, cy: number, r: number, isPointy: boolean): number[][] {
    const out: number[][] = [];
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 180) * (60 * k + (isPointy ? -90 : 0));
      out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return out;
  }

  $: pts = hexPoints($spot.cx, $spot.cy, $spot.r, pointy);
  $: ringPoints = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  $: holePath =
    pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ') + ' Z';
  // Screen rectangle + hexagon, even-odd → the hexagon is a hole.
  $: clip = W && H ? `path(evenodd, "M0 0 H${W} V${H} H0 Z ${holePath}")` : 'none';

  // ─── CARD PLACEMENT ───
  // Below the hex if it fits, else above, else pinned inside the screen.
  // Decided from `target` (not the tween) so it never flips mid-animation;
  // the card itself animates via a CSS transition on left/top.
  let cardH = 0;
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

  $: cardW = Math.min(CARD_MAX_W, Math.max(0, W - 2 * EDGE));
  $: cardLeft = clamp(target.cx - cardW / 2, EDGE, Math.max(EDGE, W - cardW - EDGE));
  $: belowTop = target.cy + target.r + CARD_GAP;
  $: aboveTop = target.cy - target.r - CARD_GAP - cardH;
  $: cardTop =
    belowTop + cardH <= H - EDGE ? belowTop
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

  function finish() {
    dispatch('close');
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); finish(); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); next(); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); back(); return; }

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
    // Let HexMenu finish its first layout pass (it settles its scale in its
    // own onMount / ResizeObserver) before measuring anything.
    await tick();
    await new Promise<void>((res) => requestAnimationFrame(() => res()));

    // Skip steps whose hex doesn't exist rather than spotlighting nothing.
    steps = ONBOARDING_STEPS.filter((s) => {
      const ok = !!findNode(s.target);
      if (!ok) console.warn(`[onboarding] no hex with data-node-id="${s.target}" — step skipped`);
      return ok;
    });
    if (!steps.length) { finish(); return; }

    await tick();
    measure(true);
    ready = true;
    focusPrimary();

    // Window resize, orientation change, landscape↔portrait switch: the
    // hexes move, so the spotlight has to follow. One frame of delay lets
    // HexMenu's own ResizeObserver (registered earlier) re-layout first.
    resizeObserver = new ResizeObserver(() => requestAnimationFrame(() => measure(true)));
    resizeObserver.observe(rootEl);
  });

  onDestroy(() => {
    if (resizeObserver) resizeObserver.disconnect();
  });
</script>

<svelte:window on:keydown={onKeydown} />

<div
  class="onb"
  class:ready
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
    <polygon
      points={ringPoints}
      fill="none"
      stroke="url(#{gradId})"
      stroke-width="3"
      stroke-linejoin="round"
      filter="url(#{glowId})"
    >
      <animate attributeName="stroke-opacity" values="0.65;1;0.65" dur="2.2s" repeatCount="indefinite" />
    </polygon>
  </svg>

  {#if ready && step}
    <div
      class="card"
      bind:this={cardEl}
      bind:clientHeight={cardH}
      style="left:{cardLeft}px; top:{cardTop}px; width:{cardW}px;"
    >
      {#key index}
        <div class="body" in:fly={{ y: 8, duration: reduceMotion ? 0 : 240 }}>
          <div class="meta">
            <span class="progress">{ONBOARDING_LABELS.progress(index + 1, steps.length)}</span>
            <span class="dots" aria-hidden="true">
              {#each steps as _, i}
                <i class:active={i === index}></i>
              {/each}
            </span>
          </div>

          <h2 id="onb-title">{step.title}</h2>
          {#if step.comingSoon}
            <span class="chip">{ONBOARDING_LABELS.comingSoon}</span>
          {/if}
          <p>{step.text}</p>
        </div>
      {/key}

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
            {isLast ? ONBOARDING_LABELS.done : ONBOARDING_LABELS.next}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .onb {
    position: absolute;
    inset: 0;
    z-index: 2000; /* above the corner buttons (1000) and the globe-window (20) */
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
    overflow-y: auto;
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
  }

  .footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
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
