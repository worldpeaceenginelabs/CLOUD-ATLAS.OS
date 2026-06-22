<script>
  // ─── HEX GRID CONSTANTS ───
  const COL = 100.0;
  const ROW = 86.6;
  const ODD_OFFSET = 50.0;
  const R = 56.15;

  const SVG_OFFSET_X = 0;
  const SVG_OFFSET_Y = 5;

  // ─── STATE MACHINE ───
  const states = {
    start: {
      nodes: [
        { id: 'offer',  label: 'OFFER',  col: 0, row: 0 },
        { id: 'search', label: 'SEARCH', col: 1, row: 0 },
        { id: 'next',   label: 'NEXT',   col: 2, row: 0 },
        { id: 'bbq',    label: 'BBQ',    col: 3, row: 0, noop: true },
      ],
      transitions: {
        offer:  'offer',
        search: 'search',
        next:   'missions',
      }
    },

    missions: {
      nodes: [
        { id: 'back',      label: 'OFFER\nSEARCH',    col: 0, row: 0, backTo: 'start' },
        { id: 'mission1',  label: 'MISSION 1\nMISSION TV', col: 1, row: 0 },
        { id: 'mission2',  label: 'MISSION 2\nSWARM GOV',  col: 2, row: 0 },
        { id: 'mission3',  label: 'MISSION 3\nOMNIPEDIA',  col: 3, row: 0 },
        { id: 'mission4',  label: 'MISSION 4\nCONSERV.',   col: 4, row: 0 },
      ],
      transitions: {
        back: 'start',
      }
    },

    offer: {
      nodes: [
        { id: 'rootRef',  label: 'OFFER',    col: 0, row: 0, selected: true },
        { id: 'search',   label: 'SEARCH',   col: 1, row: 0, dimmed: true },
        { id: 'next',     label: 'NEXT',     col: 2, row: 0, dimmed: true },
        { id: 'bbq',      label: 'BBQ',      col: 3, row: 0, dimmed: true, noop: true },
        { id: 'live',     label: 'LIVE',     col: 0, row: 1 },
        { id: 'listings', label: 'LISTINGS', col: 1, row: 1 },
      ],
      transitions: {
        rootRef:  'start',
        search:   'search',
        next:     'missions',
        live:     'offerLive',
        listings: 'offerListings',
      }
    },

    search: {
      nodes: [
        { id: 'offer',    label: 'OFFER',    col: 0, row: 0, dimmed: true },
        { id: 'rootRef',  label: 'SEARCH',   col: 1, row: 0, selected: true },
        { id: 'next',     label: 'NEXT',     col: 2, row: 0, dimmed: true },
        { id: 'bbq',      label: 'BBQ',      col: 3, row: 0, dimmed: true, noop: true },
        { id: 'live',     label: 'LIVE',     col: 0, row: 1 },
        { id: 'listings', label: 'LISTINGS', col: 1, row: 1 },
      ],
      transitions: {
        offer:    'offer',
        rootRef:  'start',
        next:     'missions',
        live:     'searchLive',
        listings: 'searchListings',
      }
    },

    offerListings: {
      nodes: [
        { id: 'rootRef',  label: 'OFFER',      col: 0, row: 0, selected: true },
        { id: 'search',   label: 'SEARCH',     col: 1, row: 0, dimmed: true },
        { id: 'next',     label: 'NEXT',       col: 2, row: 0, dimmed: true },
        { id: 'bbq',      label: 'BBQ',        col: 3, row: 0, dimmed: true, noop: true },
        { id: 'live',     label: 'LIVE',       col: 0, row: 1, dimmed: true },
        { id: 'listings', label: 'LISTINGS',   col: 1, row: 1, selected: true },
        { id: 'c1',       label: 'MOVE',       col: 0, row: 2 },
        { id: 'c2',       label: 'SHARE\nUSE', col: 1, row: 2 },
        { id: 'c3',       label: 'FOOD',       col: 2, row: 2 },
        { id: 'c4',       label: 'SKILLS',     col: 3, row: 2 },
        { id: 'c5',       label: 'STAY',       col: 0, row: 3 },
        { id: 'c6',       label: 'SOCIAL',     col: 1, row: 3 },
      ],
      transitions: {
        rootRef:  'start',
        search:   'searchListings',
        next:     'missions',
        live:     'offerLive',
        listings: 'offer',
        c1: 'offerTool', c2: 'offerTool', c3: 'offerTool',
        c4: 'offerTool', c5: 'offerTool', c6: 'offerTool',
      }
    },

    searchListings: {
      nodes: [
        { id: 'offer',    label: 'OFFER',      col: 0, row: 0, dimmed: true },
        { id: 'rootRef',  label: 'SEARCH',     col: 1, row: 0, selected: true },
        { id: 'next',     label: 'NEXT',       col: 2, row: 0, dimmed: true },
        { id: 'bbq',      label: 'BBQ',        col: 3, row: 0, dimmed: true, noop: true },
        { id: 'live',     label: 'LIVE',       col: 0, row: 1, dimmed: true },
        { id: 'listings', label: 'LISTINGS',   col: 1, row: 1, selected: true },
        { id: 'c1',       label: 'MOVE',       col: 0, row: 2 },
        { id: 'c2',       label: 'SHARE\nUSE', col: 1, row: 2 },
        { id: 'c3',       label: 'FOOD',       col: 2, row: 2 },
        { id: 'c4',       label: 'SKILLS',     col: 3, row: 2 },
        { id: 'c5',       label: 'STAY',       col: 0, row: 3 },
        { id: 'c6',       label: 'SOCIAL',     col: 1, row: 3 },
      ],
      transitions: {
        offer:    'offerListings',
        rootRef:  'start',
        next:     'missions',
        live:     'searchLive',
        listings: 'search',
        c1: 'searchFilter', c2: 'searchFilter', c3: 'searchFilter',
        c4: 'searchFilter', c5: 'searchFilter', c6: 'searchFilter',
      }
    },

    offerLive: {
      nodes: [
        { id: 'rootRef',  label: 'OFFER',    col: 0, row: 0, selected: true },
        { id: 'search',   label: 'SEARCH',   col: 1, row: 0, dimmed: true },
        { id: 'next',     label: 'NEXT',     col: 2, row: 0, dimmed: true },
        { id: 'bbq',      label: 'BBQ',      col: 3, row: 0, dimmed: true, noop: true },
        { id: 'live',     label: 'LIVE',     col: 0, row: 1, selected: true },
        { id: 'listings', label: 'LISTINGS', col: 1, row: 1, dimmed: true },
      ],
      transitions: {
        rootRef:  'start',
        search:   'searchLive',
        next:     'missions',
        live:     'offer',
        listings: 'offerListings',
      }
    },

    searchLive: {
      nodes: [
        { id: 'offer',    label: 'OFFER',    col: 0, row: 0, dimmed: true },
        { id: 'rootRef',  label: 'SEARCH',   col: 1, row: 0, selected: true },
        { id: 'next',     label: 'NEXT',     col: 2, row: 0, dimmed: true },
        { id: 'bbq',      label: 'BBQ',      col: 3, row: 0, dimmed: true, noop: true },
        { id: 'live',     label: 'LIVE',     col: 0, row: 1, selected: true },
        { id: 'listings', label: 'LISTINGS', col: 1, row: 1, dimmed: true },
      ],
      transitions: {
        offer:    'offerLive',
        rootRef:  'start',
        next:     'missions',
        live:     'search',
        listings: 'searchListings',
      }
    },

    offerTool: {
      nodes: [
        { id: 'rootRef',  label: 'OFFER',      col: 0, row: 0, selected: true },
        { id: 'search',   label: 'SEARCH',     col: 1, row: 0, dimmed: true },
        { id: 'next',     label: 'NEXT',       col: 2, row: 0, dimmed: true },
        { id: 'bbq',      label: 'BBQ',        col: 3, row: 0, dimmed: true, noop: true },
        { id: 'live',     label: 'LIVE',       col: 0, row: 1, dimmed: true },
        { id: 'listings', label: 'LISTINGS',   col: 1, row: 1, selected: true },
        { id: 'c1',       label: 'MOVE',       col: 0, row: 2, dimmed: true },
        { id: 'c2',       label: 'SHARE\nUSE', col: 1, row: 2, dimmed: true },
        { id: 'c3',       label: 'FOOD',       col: 2, row: 2, selected: true },
        { id: 'c4',       label: 'SKILLS',     col: 3, row: 2, dimmed: true },
        { id: 'c5',       label: 'STAY',       col: 0, row: 3, dimmed: true },
        { id: 'c6',       label: 'SOCIAL',     col: 1, row: 3, dimmed: true },
        { id: 't1',       label: 'TOOL 1',     col: 0, row: 4 },
        { id: 't2',       label: 'TOOL 2',     col: 1, row: 4 },
        { id: 't3',       label: 'TOOL 3',     col: 2, row: 4 },
      ],
      transitions: {
        rootRef:  'start',
        search:   'start',
        next:     'missions',
        live:     'offerLive',
        listings: 'offerListings',
        c1: 'offerListings', c2: 'offerListings', c3: 'offerListings',
        c4: 'offerListings', c5: 'offerListings', c6: 'offerListings',
        t1: 'offerForm', t2: 'offerForm', t3: 'offerForm',
      }
    },

    offerForm: {
      nodes: [
        { id: 'rootRef',  label: 'OFFER',      col: 0, row: 0, selected: true },
        { id: 'search',   label: 'SEARCH',     col: 1, row: 0, dimmed: true },
        { id: 'next',     label: 'NEXT',       col: 2, row: 0, dimmed: true },
        { id: 'bbq',      label: 'BBQ',        col: 3, row: 0, dimmed: true, noop: true },
        { id: 'live',     label: 'LIVE',       col: 0, row: 1, dimmed: true },
        { id: 'listings', label: 'LISTINGS',   col: 1, row: 1, selected: true },
        { id: 'c1',       label: 'MOVE',       col: 0, row: 2, dimmed: true },
        { id: 'c2',       label: 'SHARE\nUSE', col: 1, row: 2, dimmed: true },
        { id: 'c3',       label: 'FOOD',       col: 2, row: 2, selected: true },
        { id: 'c4',       label: 'SKILLS',     col: 3, row: 2, dimmed: true },
        { id: 'c5',       label: 'STAY',       col: 0, row: 3, dimmed: true },
        { id: 'c6',       label: 'SOCIAL',     col: 1, row: 3, dimmed: true },
        { id: 't1',       label: 'TOOL 1',     col: 0, row: 4, dimmed: true },
        { id: 't2',       label: 'TOOL 2',     col: 1, row: 4, selected: true },
        { id: 't3',       label: 'TOOL 3',     col: 2, row: 4, dimmed: true },
        { id: 'location', label: 'LOCATION',   col: 0, row: 5 },
        { id: 'details',  label: 'DETAILS',    col: 1, row: 5 },
        { id: 'anypay',   label: 'ANYPAY',     col: 2, row: 5 },
        { id: 'submit',   label: 'SUBMIT',     col: 3, row: 5, type: 'submit' },
      ],
      transitions: {
        rootRef:  'start',
        submit:   'start',
        listings: 'offerListings',
        c3:       'offerTool',
        t2:       'offerTool',
      }
    },

    searchFilter: {
      nodes: [
        { id: 'offer',    label: 'OFFER',      col: 0, row: 0, dimmed: true },
        { id: 'rootRef',  label: 'SEARCH',     col: 1, row: 0, selected: true },
        { id: 'next',     label: 'NEXT',       col: 2, row: 0, dimmed: true },
        { id: 'bbq',      label: 'BBQ',        col: 3, row: 0, dimmed: true, noop: true },
        { id: 'live',     label: 'LIVE',       col: 0, row: 1, dimmed: true },
        { id: 'listings', label: 'LISTINGS',   col: 1, row: 1, selected: true },
        { id: 'c1',       label: 'MOVE',       col: 0, row: 2, dimmed: true },
        { id: 'c2',       label: 'SHARE\nUSE', col: 1, row: 2, dimmed: true },
        { id: 'c3',       label: 'FOOD',       col: 2, row: 2, selected: true },
        { id: 'c4',       label: 'SKILLS',     col: 3, row: 2, dimmed: true },
        { id: 'c5',       label: 'STAY',       col: 0, row: 3, dimmed: true },
        { id: 'c6',       label: 'SOCIAL',     col: 1, row: 3, dimmed: true },
        { id: 'location', label: 'LOCATION',   col: 0, row: 4 },
        { id: 'anypay',   label: 'ANYPAY',     col: 1, row: 4 },
        { id: 'search',   label: 'SEARCH',     col: 2, row: 4, type: 'submit' },
      ],
      transitions: {
        rootRef:  'start',
        search:   'start',
        listings: 'searchListings',
        c3:       'searchListings',
      }
    },
  };

  // ─── DRAG STATE ───
  let anchorCol = 0;
  let anchorRow = 3;
  let didDrag = false;

  // ─── CURRENT STATE ───
  let current = 'start';
  $: ui = states[current];

  function go(id) {
    if (didDrag) return;
    const node = ui.nodes.find(n => n.id === id);
    if (node?.noop) return;
    const next = ui.transitions?.[id];
    if (next) current = next;
  }

  // ─── HEX MATH: grid col/row → pixel center ───
  function hexCenter(col, row) {
    const isOdd = row % 2 === 1;
    const x = (col * COL) + (isOdd ? ODD_OFFSET : 0) + SVG_OFFSET_X;
    const y = (row * ROW) + SVG_OFFSET_Y;
    return { x, y };
  }

  // ─── PIXEL → nearest grid col/row ───
  function pixelToGrid(px, py) {
    const adjustedPy = py - SVG_OFFSET_Y;
    const row = Math.round(adjustedPy / ROW);
    const isOdd = row % 2 === 1;
    const adjustedPx = px - SVG_OFFSET_X - (isOdd ? ODD_OFFSET : 0);
    const col = Math.round(adjustedPx / COL);
    return { col: Math.max(0, col), row: Math.max(0, row) };
  }

  // ─── COMPUTE ABSOLUTE PIXEL POSITIONS for current nodes ───
  $: nodePositions = ui.nodes.map(n => {
    const base = hexCenter(anchorCol + n.col, anchorRow + n.row);
    return { ...n, px: base.x, py: base.y };
  });

  // ─── SVG HEXAGON PATH (pointy-top, radius R) ───
  function hexPath(cx, cy) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI / 180 * (60 * i - 30);
      pts.push(`${cx + R * Math.cos(angle)},${cy + R * Math.sin(angle)}`);
    }
    return `M${pts.join('L')}Z`;
  }

  const gradId = 'hexgrad_' + Math.random().toString(36).slice(2);

  // ─── SVELTE ACTION: Draggable menu ───
  function draggable(node) {
    let dragActive = false;
    let baseAnchorCol = 0;
    let baseAnchorRow = 0;
    let dragStartClientX = 0;
    let dragStartClientY = 0;

    function onDown(e) {
      e.preventDefault();
      e.stopPropagation();
      dragActive = true;
      didDrag = false;
      baseAnchorCol = anchorCol;
      baseAnchorRow = anchorRow;
      dragStartClientX = e.clientX;
      dragStartClientY = e.clientY;
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp, { passive: false });
      window.addEventListener('pointercancel', onUp, { passive: false });
    }

    function onMove(e) {
      if (!dragActive) return;
      e.preventDefault();
      const dx = e.clientX - dragStartClientX;
      const dy = e.clientY - dragStartClientY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) didDrag = true;
      const startPos = hexCenter(baseAnchorCol, baseAnchorRow);
      const snapped = pixelToGrid(startPos.x + dx, startPos.y + dy);
      if (snapped.col !== anchorCol || snapped.row !== anchorRow) {
        anchorCol = Math.max(0, snapped.col);
        anchorRow = Math.max(0, snapped.row);
      }
    }

    function onUp(e) {
      if (e) e.preventDefault();
      dragActive = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
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

  <!-- Wire connections between consecutive nodes on the same row -->
  {#each nodePositions as node, i}
    {#if i > 0 && nodePositions[i-1].row === node.row}
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
        opacity:{node.noop ? 0.3 : node.dimmed ? 0.22 : 1};
        transition: opacity 0.25s;
      "
      on:click={() => !didDrag && go(node.id)}
    >
      <!-- Fill -->
      <path
        d={hexPath(node.px, node.py)}
        fill={node.type === 'submit'
          ? 'rgba(42,233,201,0.08)'
          : node.selected
            ? 'rgba(51,91,244,0.18)'
            : '#111'}
        style="pointer-events:all;"
      />

      <!-- Gradient border -->
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

      <!-- Label -->
      {#each node.label.split('\n') as line, li}
        <text
          x={node.px}
          y={node.py + (li - (node.label.split('\n').length - 1) / 2) * 14}
          text-anchor="middle"
          dominant-baseline="middle"
          fill={node.type === 'submit'
            ? '#2ae9c9'
            : node.selected
              ? '#a0b8ff'
              : '#fff'}
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