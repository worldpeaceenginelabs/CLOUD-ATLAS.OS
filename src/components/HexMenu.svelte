<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  // ─── BASE HEX GRID CONSTANTS (unscaled, from grid.svg geometry) ───
  const BASE_COL = 100.0;
  const BASE_ROW = 86.6;
  const BASE_R   = 56.15;
  const MIN_COLS_VISIBLE = 4;

  // ─── RESPONSIVE SCALE (drives EVERYTHING: background + menu) ───
  // Bound to the root element via ResizeObserver rather than window's
  // 'resize' event — far more reliable across DevTools device emulation,
  // orientation changes, and any future embedding in a smaller container.
  let rootEl;
  let scale = 1;
  let vw = 1024, vh = 768;
  let resizeObserver;

  function applySize(width, height) {
    vw = width;
    vh = height;
    const neededWidth = MIN_COLS_VISIBLE * BASE_COL + BASE_R * 2;
    scale = Math.min(1, vw / neededWidth);
  }

  $: COL = BASE_COL * scale;
  $: ROW = BASE_ROW * scale;
  $: R   = BASE_R   * scale;
  $: FONT = Math.max(8, 11 * scale);

  // ─── SHARED HEX MATH (used for BOTH background tiles and menu nodes) ───
  // COL/ROW are passed in explicitly (not closed over) so every call site
  // that uses them is a plain, traceable data-flow — no hidden reactivity
  // gaps between "COL changed" and "positions recomputed".
  function hexCenter(col, lrow, aCol, aRow, col_, row_) {
    const absRow = aRow + lrow;
    const xOffset = absRow % 2 === 1 ? col_ / 2 : 0;
    const colShift = (aRow % 2 === 1 && lrow % 2 === 1) ? 1 : 0;
    const x = (col + colShift) * col_ + xOffset;
    const y = absRow * row_;
    return { x, y };
  }

  function hexPath(cx, cy, radius) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI / 180 * (60 * i - 30);
      pts.push(`${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`);
    }
    return `M${pts.join('L')}Z`;
  }

  // ─── BACKGROUND HEX TILES (fills viewport, always in sync with menu math) ───
  // Depends directly on COL, ROW, R, vw, vh — all textually present here,
  // so Svelte's reactivity always sees this needs to re-run when they change.
  $: bgHexes = (() => {
    if (!R || !COL || !ROW) return [];
    const cols = Math.ceil(vw / COL) + 3;
    const rows = Math.ceil(vh / ROW) + 3;
    const out = [];
    for (let r = -1; r < rows; r++) {
      for (let c = -1; c < cols; c++) {
        const isOdd = r % 2 === 1;
        const x = c * COL + (isOdd ? COL / 2 : 0);
        const y = r * ROW;
        out.push({ x, y });
      }
    }
    return out;
  })();

  // ─── AMBIENT LIGHT ───
  let light;
  let moveLightInterval;

  function moveLight() {
    if (!light) return;
    const edge = Math.floor(Math.random() * 4);
    let startX, startY, endX, endY;
    switch (edge) {
      case 0: startX = Math.random()*vw; startY = 0;  endX = Math.random()*vw; endY = vh; break;
      case 1: startX = vw; startY = Math.random()*vh; endX = 0; endY = Math.random()*vh; break;
      case 2: startX = Math.random()*vw; startY = vh; endX = Math.random()*vw; endY = 0; break;
      default: startX = 0; startY = Math.random()*vh; endX = vw; endY = Math.random()*vh; break;
    }
    light.style.left = `${startX}px`;
    light.style.top = `${startY}px`;
    const dist = Math.hypot(endX - startX, endY - startY);
    light.style.transition = `transform ${dist/150}s ease-out`;
    light.style.transform = `translate(${endX-startX}px, ${endY-startY}px)`;
    setTimeout(() => {
      if (light) {
        light.style.left = `${endX}px`; light.style.top = `${endY}px`;
        light.style.transform = 'translate(0,0)';
      }
    }, (dist/150)*1000 + 100);
  }

  // ─── AMBIENT MESSAGES ───
  let messageElement;
  let showMessageTimeout;
  const messages = [
    "An independent, community-owned Earth, free from centralized servers and overpowered entities, owned solely by you and the public!",
    "IT'S FREE! More users mean more app storage and computational power. No back-end needed! Syncs via public tracker networks.",
    "Decentralization places the globe within your grasp, ensuring your voice resonates daily, not merely at the ballot box every few years.",
  ];

  function showMessage() {
    if (!messageElement) return;
    const mw = 300, mh = 200;
    const x = 20 + Math.random() * Math.max(20, vw - mw - 40);
    const y = 20 + Math.random() * Math.max(20, vh - mh - 40);
    messageElement.style.left = `${x}px`;
    messageElement.style.top = `${y}px`;
    messageElement.innerHTML = messages[Math.floor(Math.random()*messages.length)];
    messageElement.style.opacity = '1';
    if (showMessageTimeout) clearTimeout(showMessageTimeout);
    showMessageTimeout = setTimeout(() => {
      if (messageElement) messageElement.style.opacity = '0';
      showMessageTimeout = setTimeout(showMessage, 5000);
    }, 10000);
  }

  // ─── MENU DATA ───
  const CATEGORIES = [
    { id: 'c1', label: 'MOVE' },
    { id: 'c2', label: 'SHARE\nUSE' },
    { id: 'c3', label: 'FOOD' },
    { id: 'c4', label: 'SKILLS' },
    { id: 'c5', label: 'STAY' },
    { id: 'c6', label: 'SOCIAL' },
  ];
  const TOOLS = [
    { id: 't1', label: 'TOOL 1' },
    { id: 't2', label: 'TOOL 2' },
    { id: 't3', label: 'TOOL 3' },
  ];

  // ─── SELECTIONS ───
  // The entire menu is a pure function of these four values. There is no
  // graph of named "states" to maintain transitions for — a hexagon click
  // only ever touches its OWN variable. Nothing else changes, nothing
  // resets, and nothing can be "unreachable": every row that's currently
  // shown is always fully clickable, in any order, any number of times,
  // right up until SUBMIT. Deselecting a prerequisite (e.g. leaving
  // LISTINGS) hides the rows below it, but doesn't erase selCategory/
  // selTool — go back to LISTINGS and your previous picks are still there.
  let selMode = null;      // null | 'offer' | 'search' | 'next'
  let selType = null;      // null | 'live' | 'listings'
  let selCategory = null;  // null | one of CATEGORIES[].id
  let selTool = null;      // null | one of TOOLS[].id

  const CATEGORY_IDS = new Set(CATEGORIES.map(c => c.id));
  const TOOL_IDS = new Set(TOOLS.map(t => t.id));

  // Clicking an already-selected hexagon deselects it (and, since every
  // row below is derived from "is the row above selected", the deeper
  // rows just disappear — no explicit reset code needed for that).
  function toggle(currentVal, id) {
    return currentVal === id ? null : id;
  }

  function go(id) {
    if (didDrag) return;
    if (id === 'bbq') return; // permanently inert placeholder

    if (id === 'offer' || id === 'search' || id === 'next') { selMode = toggle(selMode, id); return; }
    if (id === 'live' || id === 'listings')                 { selType = toggle(selType, id); return; }
    if (CATEGORY_IDS.has(id)) {
      const next = toggle(selCategory, id);
      if (next !== selCategory) selTool = null; // tools are category-specific
      selCategory = next;
      return;
    }
    if (TOOL_IDS.has(id))                                    { selTool = toggle(selTool, id); return; }
    if (id === 'submit' || id === 'gosearch') {
      // The one true point of no return: hand off, then clear the slate.
      dispatch(selMode === 'offer' ? 'offerSubmit' : 'searchSubmit', { selType, selCategory, selTool });
      selMode = null; selType = null; selCategory = null; selTool = null;
      return;
    }
    // location / details / anypay / m1-m4: reserved for future sub-flows.
  }

  // ─── DERIVED NODE ROWS ───
  // Each row's visibility depends only on the row above being selected;
  // its own dim/select state depends only on its own sibling values.
  $: headerNodes = [
    { id: 'offer',  label: 'OFFER',  col: 0, lrow: 0 },
    { id: 'search', label: 'SEARCH', col: 1, lrow: 0 },
    { id: 'next',   label: 'NEXT',   col: 2, lrow: 0 },
    { id: 'bbq',    label: 'BBQ',    col: 3, lrow: 0, noop: true },
  ].map(n => ({ ...n, dimmed: selMode !== null && n.id !== selMode, selected: n.id === selMode }));

  $: inOfferOrSearch = selMode === 'offer' || selMode === 'search';

  $: liveListingsNodes = inOfferOrSearch ? [
    { id: 'live',     label: 'LIVE',     col: 0, lrow: 1 },
    { id: 'listings', label: 'LISTINGS', col: 1, lrow: 1 },
  ].map(n => ({ ...n, dimmed: selType !== null && n.id !== selType, selected: n.id === selType })) : [];

  $: missionNodes = selMode === 'next' ? [
    { id: 'm1', label: 'MISSION 1\nTV',      col: 0, lrow: 1 },
    { id: 'm2', label: 'MISSION 2\nGOV',     col: 1, lrow: 1 },
    { id: 'm3', label: 'MISSION 3\nOMNI',    col: 2, lrow: 1 },
    { id: 'm4', label: 'MISSION 4\nCONSERV', col: 3, lrow: 1 },
  ] : [];

  $: showCategories = inOfferOrSearch && selType === 'listings';
  $: categoryNodes = showCategories ? CATEGORIES.map((c, i) => ({
    id: c.id, label: c.label, col: i % 4, lrow: 2 + Math.floor(i / 4),
    dimmed: selCategory !== null && c.id !== selCategory, selected: c.id === selCategory,
  })) : [];

  $: showTools = showCategories && selCategory !== null;
  $: toolNodes = showTools ? TOOLS.map((t, i) => ({
    id: t.id, label: t.label, col: i, lrow: 4,
    dimmed: selTool !== null && t.id !== selTool, selected: t.id === selTool,
  })) : [];

  $: showForm = showTools && selTool !== null;
  $: formNodes = showForm ? [
    { id: 'location', label: 'LOCATION', col: 0, lrow: 5 },
    { id: 'details',  label: 'DETAILS',  col: 1, lrow: 5 },
    { id: 'anypay',   label: 'ANYPAY',   col: 2, lrow: 5 },
    selMode === 'offer'
      ? { id: 'submit',   label: 'SUBMIT', col: 3, lrow: 5, type: 'submit' }
      : { id: 'gosearch', label: 'SEARCH', col: 3, lrow: 5, type: 'submit' },
  ] : [];

  $: nodes = [...headerNodes, ...liveListingsNodes, ...missionNodes, ...categoryNodes, ...toolNodes, ...formNodes];

  // ─── MENU GEOMETRY ───
  let anchorCol = 0;
  let anchorRow = 1;
  let didDrag = false;

  // NOTE: COL, ROW are referenced directly in this line (not just inside
  // hexCenter's closure) so Svelte's compiler registers them as
  // dependencies of this reactive statement. Without this, resizing
  // never propagated to the menu's node positions.
  $: nodePositions = COL && ROW ? nodes.map(n => {
    const base = hexCenter(anchorCol + n.col, n.lrow, anchorCol, anchorRow, COL, ROW);
    return { ...n, px: base.x, py: base.y };
  }) : [];

  const gradId = 'hexgrad_' + Math.random().toString(36).slice(2);
  const glowId = 'hexglow_' + Math.random().toString(36).slice(2);

  // ─── DRAGGABLE ───
  function draggable(node) {
    let dragActive = false;
    let baseAnchorCol = 0, baseAnchorRow = 0;
    let startClientX = 0, startClientY = 0;

    function onDown(e) {
      dragActive = true; didDrag = false;
      baseAnchorCol = anchorCol; baseAnchorRow = anchorRow;
      startClientX = e.clientX; startClientY = e.clientY;
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp, { passive: false });
      window.addEventListener('pointercancel', onUp, { passive: false });
    }
    function onMove(e) {
      if (!dragActive) return;
      e.preventDefault();
      const dx = e.clientX - startClientX;
      const dy = e.clientY - startClientY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) didDrag = true;
      const c = COL, r = ROW; // snapshot current (possibly resized) grid
      const baseX = baseAnchorCol * c;
      const baseY = baseAnchorRow * r;
      anchorCol = Math.max(0, Math.round((baseX + dx) / c));
      anchorRow = Math.max(0, Math.round((baseY + dy) / r));
    }
    function onUp(e) {
      dragActive = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setTimeout(() => { didDrag = false; }, 80);
    }
    node.addEventListener('pointerdown', onDown, { passive: false });
    return { destroy() { node.removeEventListener('pointerdown', onDown); } };
  }

  onMount(() => {
    // ResizeObserver on the root element itself — this is what actually
    // fires reliably when DevTools device emulation changes the viewport,
    // unlike window's 'resize' event which can be flaky there.
    resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        applySize(width, height);
      }
    });
    resizeObserver.observe(rootEl);

    // Initial measurement (ResizeObserver also fires once immediately on
    // observe(), but we set a sane default synchronously to avoid a
    // one-frame flash at scale=1 on very small screens).
    applySize(rootEl.clientWidth, rootEl.clientHeight);

    // No external asset to preload anymore (background is pure SVG math,
    // not an image), so "ready" simply means "we've measured our size
    // and can render correctly" — fires once, immediately.
    dispatch('gridReady');

    moveLightInterval = setInterval(moveLight, 8000);
    showMessage();
  });

  onDestroy(() => {
    if (resizeObserver) resizeObserver.disconnect();
    if (moveLightInterval) clearInterval(moveLightInterval);
    if (showMessageTimeout) clearTimeout(showMessageTimeout);
  });
</script>

<div class="hex-root" bind:this={rootEl}>
  <div bind:this={light} class="light"></div>
  <div bind:this={messageElement} class="message"></div>

  <svg use:draggable class="hexmenu" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#335bf4"/>
        <stop offset="100%" stop-color="#2ae9c9"/>
      </linearGradient>
      <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="4" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>

    <!-- BACKGROUND HEX TILES: same hexCenter()/hexPath() math as the menu.
         Rendered as TWO nested FILLED hexagons per cell (outer border-color
         shape + inner smaller fill-color shape) — exactly how the original
         grid.svg was built. This avoids the blurry double-stroke seams you
         get when adjacent cells each draw their own `stroke` on a shared
         edge; solid fills give crisp lines instead. -->
    <g class="bg-layer">
      {#each bgHexes as h}
        <path d={hexPath(h.x, h.y, R * 0.985)} fill="#0E0E0E"/>
        <path d={hexPath(h.x, h.y, R * 0.985 - 2.2 * scale)} fill="#1F1F1F"/>
      {/each}
    </g>

    <!-- Wires -->
    {#each nodePositions as node, i}
      {#if i > 0 && nodePositions[i-1].lrow === node.lrow}
        <line
          x1={nodePositions[i-1].px} y1={nodePositions[i-1].py}
          x2={node.px} y2={node.py}
          stroke="url(#{gradId})" stroke-width={1.5 * scale} opacity="0.3"
          style="pointer-events:none;"
        />
      {/if}
    {/each}

    <!-- Menu nodes -->
    {#each nodePositions as node}
      <g
        data-node-id={node.id}
        style="
          pointer-events:{node.noop ? 'none' : 'all'};
          cursor:{node.noop ? 'default' : didDrag ? 'grabbing' : 'pointer'};
          opacity:{node.noop ? 0.35 : (node.dimmed && !node.selected) ? 0.22 : 1};
          transition: opacity 0.25s;
        "
        on:click={() => !didDrag && go(node.id)}
      >
        <path
          d={hexPath(node.px, node.py, R)}
          fill={node.type === 'submit' ? 'rgba(42,233,201,0.1)' : node.selected ? 'rgba(51,91,244,0.38)' : '#111'}
          style="pointer-events:all;"
        />
        <path
          d={hexPath(node.px, node.py, R)}
          fill="none"
          stroke={node.selected ? '#8fb0ff' : `url(#${gradId})`}
          stroke-width={(node.selected ? 3 : 1.5) * scale}
          opacity={node.selected ? 1 : 0.85}
          filter={node.selected ? `url(#${glowId})` : 'none'}
          style="pointer-events:all;"
        >
          {#if !node.selected && node.type !== 'submit'}
            <animate attributeName="opacity" values="0.5;1;0.5" dur="2.8s" repeatCount="indefinite"/>
          {/if}
        </path>
        {#each node.label.split('\n') as line, li}
          <text
            x={node.px}
            y={node.py + (li - (node.label.split('\n').length - 1) / 2) * (FONT + 3)}
            text-anchor="middle"
            dominant-baseline="middle"
            fill={node.type === 'submit' ? '#2ae9c9' : node.selected ? '#e4ecff' : '#fff'}
            font-size={FONT}
            font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
            font-weight={node.selected ? 700 : 600}
            letter-spacing="0.5"
            style="pointer-events:none; user-select:none;"
          >{line}</text>
        {/each}
      </g>
    {/each}
  </svg>
</div>

<style>
  .hex-root {
    position: fixed;
    inset: 0;
    background: #2b2b2b;
    overflow: hidden;
  }

  .light {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 15em;
    height: 15em;
    filter: blur(15px);
    background: linear-gradient(90deg, #335bf4 0%, #2ae9c9 100%);
    z-index: 2;
    will-change: transform;
    backface-visibility: hidden;
    pointer-events: none;
  }

  /* z-index stack, bottom to top:
     light (2) < hexmenu svg incl. background hexagons (10) < message (15)
     The message must sit ABOVE the hexmenu since that svg now contains
     the opaque background hexagon tiles that used to be a separate,
     lower CSS background-image layer. */
  .message {
    position: absolute;
    width: 300px;
    font-size: 1.1em;
    color: grey;
    text-align: center;
    line-height: 1.4;
    opacity: 0;
    transition: opacity 5s ease-in-out;
    z-index: 15;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    -webkit-font-smoothing: antialiased;
    pointer-events: none;
  }

  .hexmenu {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 10;
    overflow: visible;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }

  .bg-layer {
    pointer-events: none;
  }
</style>