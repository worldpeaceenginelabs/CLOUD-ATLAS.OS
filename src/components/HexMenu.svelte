<script>
  const COL = 100.0;
  const ROW  = 86.6;
  const R    = 56.15;
  const SVG_OFFSET_X = 0;
  const SVG_OFFSET_Y = 5;

  const states = {
    start: {
      nodes: [
        { id: 'offer',  label: 'OFFER',  col: 0, lrow: 0 },
        { id: 'search', label: 'SEARCH', col: 1, lrow: 0 },
        { id: 'next',   label: 'NEXT',   col: 2, lrow: 0 },
        { id: 'bbq',    label: 'BBQ',    col: 3, lrow: 0, noop: true },
      ],
      transitions: { offer: 'offer', search: 'search', next: 'next' }
    },

    offer: {
      nodes: [
        { id: 'offer',    label: 'OFFER',    col: 0, lrow: 0, selected: true },
        { id: 'search',   label: 'SEARCH',   col: 1, lrow: 0, dimmed: true },
        { id: 'next',     label: 'NEXT',     col: 2, lrow: 0, dimmed: true },
        { id: 'bbq',      label: 'BBQ',      col: 3, lrow: 0, dimmed: true, noop: true },
        { id: 'live',     label: 'LIVE',     col: 0, lrow: 1 },
        { id: 'listings', label: 'LISTINGS', col: 1, lrow: 1 },
      ],
      transitions: { offer: 'start', search: 'search', next: 'next', live: 'offerLive', listings: 'offerListings' }
    },

    search: {
      nodes: [
        { id: 'offer',    label: 'OFFER',    col: 0, lrow: 0, dimmed: true },
        { id: 'search',   label: 'SEARCH',   col: 1, lrow: 0, selected: true },
        { id: 'next',     label: 'NEXT',     col: 2, lrow: 0, dimmed: true },
        { id: 'bbq',      label: 'BBQ',      col: 3, lrow: 0, dimmed: true, noop: true },
        { id: 'live',     label: 'LIVE',     col: 0, lrow: 1 },
        { id: 'listings', label: 'LISTINGS', col: 1, lrow: 1 },
      ],
      transitions: { offer: 'offer', search: 'start', next: 'next', live: 'searchLive', listings: 'searchListings' }
    },

    next: {
      nodes: [
        { id: 'offer',  label: 'OFFER',              col: 0, lrow: 0, dimmed: true },
        { id: 'search', label: 'SEARCH',             col: 1, lrow: 0, dimmed: true },
        { id: 'next',   label: 'NEXT',               col: 2, lrow: 0, selected: true },
        { id: 'bbq',    label: 'BBQ',                col: 3, lrow: 0, dimmed: true, noop: true },
        { id: 'm1',     label: 'MISSION 1\nTV',      col: 0, lrow: 1 },
        { id: 'm2',     label: 'MISSION 2\nGOV',     col: 1, lrow: 1 },
        { id: 'm3',     label: 'MISSION 3\nOMNI',    col: 2, lrow: 1 },
        { id: 'm4',     label: 'MISSION 4\nCONSERV', col: 3, lrow: 1 },
      ],
      transitions: { offer: 'offer', search: 'search', next: 'start' }
    },

    offerLive: {
      nodes: [
        { id: 'offer',    label: 'OFFER',    col: 0, lrow: 0, selected: true },
        { id: 'search',   label: 'SEARCH',   col: 1, lrow: 0, dimmed: true },
        { id: 'next',     label: 'NEXT',     col: 2, lrow: 0, dimmed: true },
        { id: 'bbq',      label: 'BBQ',      col: 3, lrow: 0, dimmed: true, noop: true },
        { id: 'live',     label: 'LIVE',     col: 0, lrow: 1, selected: true },
        { id: 'listings', label: 'LISTINGS', col: 1, lrow: 1, dimmed: true },
      ],
      transitions: { offer: 'start', search: 'searchLive', next: 'next', live: 'offer', listings: 'offerListings' }
    },

    searchLive: {
      nodes: [
        { id: 'offer',    label: 'OFFER',    col: 0, lrow: 0, dimmed: true },
        { id: 'search',   label: 'SEARCH',   col: 1, lrow: 0, selected: true },
        { id: 'next',     label: 'NEXT',     col: 2, lrow: 0, dimmed: true },
        { id: 'bbq',      label: 'BBQ',      col: 3, lrow: 0, dimmed: true, noop: true },
        { id: 'live',     label: 'LIVE',     col: 0, lrow: 1, selected: true },
        { id: 'listings', label: 'LISTINGS', col: 1, lrow: 1, dimmed: true },
      ],
      transitions: { offer: 'offerLive', search: 'start', next: 'next', live: 'search', listings: 'searchListings' }
    },

    offerListings: {
      nodes: [
        { id: 'offer',    label: 'OFFER',      col: 0, lrow: 0, selected: true },
        { id: 'search',   label: 'SEARCH',     col: 1, lrow: 0, dimmed: true },
        { id: 'next',     label: 'NEXT',       col: 2, lrow: 0, dimmed: true },
        { id: 'bbq',      label: 'BBQ',        col: 3, lrow: 0, dimmed: true, noop: true },
        { id: 'live',     label: 'LIVE',       col: 0, lrow: 1, dimmed: true },
        { id: 'listings', label: 'LISTINGS',   col: 1, lrow: 1, selected: true },
        { id: 'c1',       label: 'MOVE',       col: 0, lrow: 2 },
        { id: 'c2',       label: 'SHARE\nUSE', col: 1, lrow: 2 },
        { id: 'c3',       label: 'FOOD',       col: 2, lrow: 2 },
        { id: 'c4',       label: 'SKILLS',     col: 3, lrow: 2 },
        { id: 'c5',       label: 'STAY',       col: 0, lrow: 3 },
        { id: 'c6',       label: 'SOCIAL',     col: 1, lrow: 3 },
      ],
      transitions: {
        offer: 'start', search: 'searchListings', next: 'next', live: 'offerLive', listings: 'offer',
        c1: 'offerTool', c2: 'offerTool', c3: 'offerTool', c4: 'offerTool', c5: 'offerTool', c6: 'offerTool',
      }
    },

    searchListings: {
      nodes: [
        { id: 'offer',    label: 'OFFER',      col: 0, lrow: 0, dimmed: true },
        { id: 'search',   label: 'SEARCH',     col: 1, lrow: 0, selected: true },
        { id: 'next',     label: 'NEXT',       col: 2, lrow: 0, dimmed: true },
        { id: 'bbq',      label: 'BBQ',        col: 3, lrow: 0, dimmed: true, noop: true },
        { id: 'live',     label: 'LIVE',       col: 0, lrow: 1, dimmed: true },
        { id: 'listings', label: 'LISTINGS',   col: 1, lrow: 1, selected: true },
        { id: 'c1',       label: 'MOVE',       col: 0, lrow: 2 },
        { id: 'c2',       label: 'SHARE\nUSE', col: 1, lrow: 2 },
        { id: 'c3',       label: 'FOOD',       col: 2, lrow: 2 },
        { id: 'c4',       label: 'SKILLS',     col: 3, lrow: 2 },
        { id: 'c5',       label: 'STAY',       col: 0, lrow: 3 },
        { id: 'c6',       label: 'SOCIAL',     col: 1, lrow: 3 },
      ],
      transitions: {
        offer: 'offerListings', search: 'start', next: 'next', live: 'searchLive', listings: 'search',
        c1: 'searchFilter', c2: 'searchFilter', c3: 'searchFilter', c4: 'searchFilter', c5: 'searchFilter', c6: 'searchFilter',
      }
    },

    offerTool: {
      nodes: [
        { id: 'offer',    label: 'OFFER',      col: 0, lrow: 0, selected: true },
        { id: 'search',   label: 'SEARCH',     col: 1, lrow: 0, dimmed: true },
        { id: 'next',     label: 'NEXT',       col: 2, lrow: 0, dimmed: true },
        { id: 'bbq',      label: 'BBQ',        col: 3, lrow: 0, dimmed: true, noop: true },
        { id: 'live',     label: 'LIVE',       col: 0, lrow: 1, dimmed: true },
        { id: 'listings', label: 'LISTINGS',   col: 1, lrow: 1, selected: true },
        { id: 'c1',       label: 'MOVE',       col: 0, lrow: 2, dimmed: true },
        { id: 'c2',       label: 'SHARE\nUSE', col: 1, lrow: 2, dimmed: true },
        { id: 'c3',       label: 'FOOD',       col: 2, lrow: 2, selected: true },
        { id: 'c4',       label: 'SKILLS',     col: 3, lrow: 2, dimmed: true },
        { id: 'c5',       label: 'STAY',       col: 0, lrow: 3, dimmed: true },
        { id: 'c6',       label: 'SOCIAL',     col: 1, lrow: 3, dimmed: true },
        { id: 't1',       label: 'TOOL 1',     col: 0, lrow: 4 },
        { id: 't2',       label: 'TOOL 2',     col: 1, lrow: 4 },
        { id: 't3',       label: 'TOOL 3',     col: 2, lrow: 4 },
      ],
      transitions: {
        offer: 'start', search: 'start', next: 'next',
        live: 'offerLive', listings: 'offerListings',
        c1: 'offerListings', c2: 'offerListings', c3: 'offerListings',
        c4: 'offerListings', c5: 'offerListings', c6: 'offerListings',
        t1: 'offerForm', t2: 'offerForm', t3: 'offerForm',
      }
    },

    offerForm: {
      nodes: [
        { id: 'offer',    label: 'OFFER',      col: 0, lrow: 0, selected: true },
        { id: 'search',   label: 'SEARCH',     col: 1, lrow: 0, dimmed: true },
        { id: 'next',     label: 'NEXT',       col: 2, lrow: 0, dimmed: true },
        { id: 'bbq',      label: 'BBQ',        col: 3, lrow: 0, dimmed: true, noop: true },
        { id: 'live',     label: 'LIVE',       col: 0, lrow: 1, dimmed: true },
        { id: 'listings', label: 'LISTINGS',   col: 1, lrow: 1, selected: true },
        { id: 'c1',       label: 'MOVE',       col: 0, lrow: 2, dimmed: true },
        { id: 'c2',       label: 'SHARE\nUSE', col: 1, lrow: 2, dimmed: true },
        { id: 'c3',       label: 'FOOD',       col: 2, lrow: 2, selected: true },
        { id: 'c4',       label: 'SKILLS',     col: 3, lrow: 2, dimmed: true },
        { id: 'c5',       label: 'STAY',       col: 0, lrow: 3, dimmed: true },
        { id: 'c6',       label: 'SOCIAL',     col: 1, lrow: 3, dimmed: true },
        { id: 't1',       label: 'TOOL 1',     col: 0, lrow: 4, dimmed: true },
        { id: 't2',       label: 'TOOL 2',     col: 1, lrow: 4, selected: true },
        { id: 't3',       label: 'TOOL 3',     col: 2, lrow: 4, dimmed: true },
        { id: 'location', label: 'LOCATION',   col: 0, lrow: 5 },
        { id: 'details',  label: 'DETAILS',    col: 1, lrow: 5 },
        { id: 'anypay',   label: 'ANYPAY',     col: 2, lrow: 5 },
        { id: 'submit',   label: 'SUBMIT',     col: 3, lrow: 5, type: 'submit' },
      ],
      transitions: { offer: 'start', listings: 'offerListings', c3: 'offerTool', t2: 'offerTool', submit: 'start' }
    },

    searchFilter: {
      nodes: [
        { id: 'offer',    label: 'OFFER',      col: 0, lrow: 0, dimmed: true },
        { id: 'search',   label: 'SEARCH',     col: 1, lrow: 0, selected: true },
        { id: 'next',     label: 'NEXT',       col: 2, lrow: 0, dimmed: true },
        { id: 'bbq',      label: 'BBQ',        col: 3, lrow: 0, dimmed: true, noop: true },
        { id: 'live',     label: 'LIVE',       col: 0, lrow: 1, dimmed: true },
        { id: 'listings', label: 'LISTINGS',   col: 1, lrow: 1, selected: true },
        { id: 'c1',       label: 'MOVE',       col: 0, lrow: 2, dimmed: true },
        { id: 'c2',       label: 'SHARE\nUSE', col: 1, lrow: 2, dimmed: true },
        { id: 'c3',       label: 'FOOD',       col: 2, lrow: 2, selected: true },
        { id: 'c4',       label: 'SKILLS',     col: 3, lrow: 2, dimmed: true },
        { id: 'c5',       label: 'STAY',       col: 0, lrow: 3, dimmed: true },
        { id: 'c6',       label: 'SOCIAL',     col: 1, lrow: 3, dimmed: true },
        { id: 'location', label: 'LOCATION',   col: 0, lrow: 4 },
        { id: 'anypay',   label: 'ANYPAY',     col: 1, lrow: 4 },
        { id: 'gosearch', label: 'SEARCH',     col: 2, lrow: 4, type: 'submit' },
      ],
      transitions: { search: 'start', listings: 'searchListings', c3: 'searchListings', gosearch: 'start' }
    },
  };

  let anchorCol = 0;
  let anchorRow = 1;
  let didDrag   = false;

  let current = 'start';
  $: ui = states[current];

  function go(id) {
    if (didDrag) return;
    const node = ui.nodes.find(n => n.id === id);
    if (node?.noop) return;
    const next = ui.transitions?.[id];
    if (next) current = next;
  }

  // lrow drives alternating offset — FIXED, independent of anchorRow parity
  function hexCenter(col, lrow) {
    const absRow = anchorRow + lrow;
    const xOffset = absRow % 2 === 1 ? 50.0 : 0;
    // lrow+1 must always appear RIGHT of lrow regardless of anchorRow parity.
    // When anchorRow is odd: lrow=0 already has xOffset=50, lrow=1 has 0 → lands LEFT.
    // Compensate: shift lrow=1,3,5 by +1 col when anchorRow is odd.
    const colShift = (anchorRow % 2 === 1 && lrow % 2 === 1) ? 1 : 0;
    const x = ((col + colShift) * COL) + xOffset + SVG_OFFSET_X;
    const y = (absRow * ROW) + SVG_OFFSET_Y;
    return { x, y };
  }

  $: nodePositions = ui.nodes.map(n => {
    const base = hexCenter(anchorCol + n.col, n.lrow);
    return { ...n, px: base.x, py: base.y };
  });

  function hexPath(cx, cy) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI / 180 * (60 * i - 30);
      pts.push(`${cx + R * Math.cos(angle)},${cy + R * Math.sin(angle)}`);
    }
    return `M${pts.join('L')}Z`;
  }

  const gradId = 'hexgrad_' + Math.random().toString(36).slice(2);

  function draggable(node) {
    let dragActive       = false;
    let baseAnchorCol    = 0;
    let baseAnchorRow    = 0;
    let dragStartClientX = 0;
    let dragStartClientY = 0;

    function onDown(e) {
      e.preventDefault(); e.stopPropagation();
      dragActive = true; didDrag = false;
      baseAnchorCol = anchorCol; baseAnchorRow = anchorRow;
      dragStartClientX = e.clientX; dragStartClientY = e.clientY;
      window.addEventListener('pointermove',   onMove,  { passive: false });
      window.addEventListener('pointerup',     onUp,    { passive: false });
      window.addEventListener('pointercancel', onUp,    { passive: false });
    }

    function onMove(e) {
      if (!dragActive) return;
      e.preventDefault();
      const dx = e.clientX - dragStartClientX;
      const dy = e.clientY - dragStartClientY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) didDrag = true;
      const baseX = baseAnchorCol * COL + SVG_OFFSET_X;
      const baseY = baseAnchorRow * ROW  + SVG_OFFSET_Y;
      anchorCol = Math.max(0, Math.round((baseX + dx - SVG_OFFSET_X) / COL));
      anchorRow = Math.max(0, Math.round((baseY + dy - SVG_OFFSET_Y) / ROW));
    }

    function onUp(e) {
      if (e) e.preventDefault();
      dragActive = false;
      window.removeEventListener('pointermove',   onMove);
      window.removeEventListener('pointerup',     onUp);
      window.removeEventListener('pointercancel', onUp);
      setTimeout(() => { didDrag = false; }, 80);
    }

    node.addEventListener('pointerdown', onDown, { passive: false });
    return { destroy() { node.removeEventListener('pointerdown', onDown); } };
  }
</script>

<svg
  use:draggable
  class="hexmenu"
  style="position:fixed; top:0; left:0; width:100vw; height:100vh; pointer-events:all; z-index:10;"
  xmlns="http://www.w3.org/2000/svg"
>
  <defs>
    <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#335bf4"/>
      <stop offset="100%" stop-color="#2ae9c9"/>
    </linearGradient>
  </defs>

  <!-- Wires between consecutive nodes on the same logical row -->
  {#each nodePositions as node, i}
    {#if i > 0 && nodePositions[i-1].lrow === node.lrow}
      <line
        x1={nodePositions[i-1].px} y1={nodePositions[i-1].py}
        x2={node.px} y2={node.py}
        stroke="url(#{gradId})" stroke-width="1.5" opacity="0.3"
        style="pointer-events:none;"
      />
    {/if}
  {/each}

  <!-- Hexagon nodes -->
  {#each nodePositions as node}
    <g
      data-node-id={node.id}
      style="
        pointer-events:{node.noop ? 'none' : 'all'};
        cursor:{node.noop ? 'default' : didDrag ? 'grabbing' : 'pointer'};
        opacity:{node.noop ? 0.35 : node.dimmed ? 0.22 : 1};
        transition: opacity 0.25s;
      "
      on:click={() => !didDrag && go(node.id)}
    >
      <path
        d={hexPath(node.px, node.py)}
        fill={node.type === 'submit' ? 'rgba(42,233,201,0.08)' : node.selected ? 'rgba(51,91,244,0.18)' : '#111'}
        style="pointer-events:all;"
      />
      <path
        d={hexPath(node.px, node.py)}
        fill="none"
        stroke={node.selected ? '#7b9bf8' : "url(#{gradId})"}
        stroke-width={node.selected ? 2.2 : 1.5}
        opacity={node.selected ? 1 : 0.85}
        style="pointer-events:all;"
      >
        {#if !node.selected && node.type !== 'submit'}
          <animate attributeName="opacity" values="0.5;1;0.5" dur="2.8s" repeatCount="indefinite"/>
        {/if}
      </path>
      {#each node.label.split('\n') as line, li}
        <text
          x={node.px}
          y={node.py + (li - (node.label.split('\n').length - 1) / 2) * 14}
          text-anchor="middle"
          dominant-baseline="middle"
          fill={node.type === 'submit' ? '#2ae9c9' : node.selected ? '#a0b8ff' : '#fff'}
          font-size="11"
          font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          font-weight="600"
          letter-spacing="0.5"
          style="pointer-events:none; user-select:none;"
        >{line}</text>
      {/each}
    </g>
  {/each}
</svg>

<style>
  .hexmenu {
    overflow: visible;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }
</style>