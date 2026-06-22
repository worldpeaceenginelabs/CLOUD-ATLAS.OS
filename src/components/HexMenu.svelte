<script>
  
    // ─── HEX GRID CONSTANTS (derived from grid.svg @ backgroundSize 500px) ───

    const COL = 100.0;
    const ROW = 86.6;           // theoretically R * 1.5 ≈ 84.225, but SVG + Tile fits better here
    const ODD_OFFSET = 50.0;
    const R = 56.15;

    const SVG_OFFSET_X = 0;
    const SVG_OFFSET_Y = 5;
  
    // ─── STATE MACHINE (same architecture as RadialMenu.svelte) ───
    const states = {
      start: {
        nodes: [
          { id: 'offer',  label: 'OFFER',  col: 0, row: 0 },
          { id: 'search', label: 'SEARCH', col: 1, row: 0 },
          { id: 'next',   label: 'NEXT',   col: 2, row: 0 },
          { id: 'bbq',    label: 'BBQ',    col: 3, row: 0 },
        ],
        transitions: {
          offer:  'offer',
          search: 'search',
          next:   'missions',
          bbq:    'bbq',
        }
      },
  
      missions: {
        nodes: [
          { id: 'back',         label: 'ANYMATCH',              col: 0, row: 0 },
          { id: 'mission1',     label: 'MISSION 1\nMISSION TV', col: 1, row: 0 },
          { id: 'mission2',     label: 'MISSION 2\nSWARM GOV',  col: 2, row: 0 },
          { id: 'mission3',     label: 'MISSION 3\nOMNIPEDIA',  col: 3, row: 0 },
          { id: 'mission4',     label: 'MISSION 4\nCONSERV.',   col: 4, row: 0 },
        ],
        transitions: {
          back: 'start',
        }
      },
  
      offer: {
        nodes: [
          { id: 'back',     label: 'BACK',     col: 0, row: 0 },
          { id: 'live',     label: 'LIVE',     col: 1, row: 0 },
          { id: 'listings', label: 'LISTINGS', col: 2, row: 0 },
        ],
        active: 'offer',
        transitions: {
          back:     'start',
          live:     'offerLive',
          listings: 'offerListings',
        }
      },
  
      search: {
        nodes: [
          { id: 'back',     label: 'BACK',     col: 0, row: 0 },
          { id: 'live',     label: 'LIVE',     col: 1, row: 0 },
          { id: 'listings', label: 'LISTINGS', col: 2, row: 0 },
        ],
        active: 'search',
        transitions: {
          back:     'start',
          live:     'searchLive',
          listings: 'searchListings',
        }
      },
  
      offerListings: {
        nodes: [
          { id: 'back',   label: 'BACK',      col: 0, row: 0 },
          { id: 'c1',     label: 'MOVE',      col: 1, row: 0 },
          { id: 'c2',     label: 'SHARE/USE', col: 2, row: 0 },
          { id: 'c3',     label: 'FOOD',      col: 3, row: 0 },
          { id: 'c4',     label: 'SKILLS',    col: 4, row: 0 },
          { id: 'c5',     label: 'STAY',      col: 5, row: 0 },
          { id: 'c6',     label: 'SOCIAL',    col: 6, row: 0 },
        ],
        transitions: {
          back: 'offer',
          c1: 'offerTool', c2: 'offerTool', c3: 'offerTool',
          c4: 'offerTool', c5: 'offerTool', c6: 'offerTool',
        }
      },
  
      offerTool: {
        nodes: [
          { id: 'back', label: 'BACK',   col: 0, row: 0 },
          { id: 't1',   label: 'TOOL 1', col: 1, row: 0 },
          { id: 't2',   label: 'TOOL 2', col: 2, row: 0 },
          { id: 't3',   label: 'TOOL 3', col: 3, row: 0 },
        ],
        transitions: {
          back: 'offerListings',
          t1: 'offerForm', t2: 'offerForm', t3: 'offerForm',
        }
      },
  
      offerForm: {
        nodes: [
          { id: 'abort',    label: 'ABORT',    col: 0, row: 0 },
          { id: 'tool',     label: 'TOOL ✓',   col: 1, row: 0 },
          { id: 'location', label: 'LOCATION', col: 2, row: 0 },
          { id: 'details',  label: 'DETAILS',  col: 3, row: 0 },
          { id: 'anypay',   label: 'ANYPAY',   col: 4, row: 0 },
          { id: 'submit',   label: 'SUBMIT',   col: 5, row: 0, type: 'submit' },
        ],
        transitions: {
          abort: 'start',
          submit: 'start',
        }
      },
  
      searchListings: {
        nodes: [
          { id: 'back',   label: 'BACK',      col: 0, row: 0 },
          { id: 'c1',     label: 'MOVE',      col: 1, row: 0 },
          { id: 'c2',     label: 'SHARE/USE', col: 2, row: 0 },
          { id: 'c3',     label: 'FOOD',      col: 3, row: 0 },
          { id: 'c4',     label: 'SKILLS',    col: 4, row: 0 },
          { id: 'c5',     label: 'STAY',      col: 5, row: 0 },
          { id: 'c6',     label: 'SOCIAL',    col: 6, row: 0 },
        ],
        transitions: {
          back: 'search',
          c1: 'searchFilter', c2: 'searchFilter', c3: 'searchFilter',
          c4: 'searchFilter', c5: 'searchFilter', c6: 'searchFilter',
        }
      },
  
      searchFilter: {
        nodes: [
          { id: 'abort',    label: 'ABORT',    col: 0, row: 0 },
          { id: 'tool',     label: 'TOOL',     col: 1, row: 0 },
          { id: 'location', label: 'LOCATION', col: 2, row: 0 },
          { id: 'anypay',   label: 'ANYPAY',   col: 3, row: 0 },
          { id: 'search',   label: 'SEARCH',   col: 4, row: 0, type: 'submit' },
        ],
        transitions: {
          abort: 'start',
          search: 'start',
        }
      },
  
      offerLive:  { nodes: [{ id: 'back', label: 'BACK', col: 0, row: 0 }], transitions: { back: 'offer'  } },
      searchLive: { nodes: [{ id: 'back', label: 'BACK', col: 0, row: 0 }], transitions: { back: 'search' } },
      bbq:        { nodes: [{ id: 'back', label: 'BACK', col: 0, row: 0 }], transitions: { back: 'start'  } },
    };
  
    // ─── DRAG STATE ───
    let anchorCol = 0;
    let anchorRow = 3;
    let dragging = false;
    let dragStartX = 0, dragStartY = 0;
    let dragStartCol = 0, dragStartRow = 0;
    let didDrag = false;
  
    // ─── CURRENT STATE ───
    let current = 'start';
    $: ui = states[current];
  
    function go(id) {
      if (didDrag) return;
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

    return { 
        col: Math.max(0, col), 
        row: Math.max(0, row) 
    };
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
  
    // ─── BOUNDING BOX of all current nodes ───
    $: bbox = (() => {
      if (!nodePositions.length) return { x: 0, y: 0, w: 400, h: 200 };
      const xs = nodePositions.map(n => n.px);
      const ys = nodePositions.map(n => n.py);
      const pad = R + 4;
      const x = Math.min(...xs) - pad;
      const y = Math.min(...ys) - pad;
      const w = Math.max(...xs) - Math.min(...xs) + pad * 2;
      const h = Math.max(...ys) - Math.min(...ys) + pad * 2;
      return { x, y, w, h };
    })();
  
    // gradient id unique per instance
    const gradId = 'hexgrad_' + Math.random().toString(36).slice(2);

    // Svelte Action: Draggable menu with Rich Harris style
    function draggable(node) {
    let dragActive = false;
    let baseAnchorCol = 0;
    let baseAnchorRow = 0;
    let dragStartClientX = 0;
    let dragStartClientY = 0;

    function onDown(e) {
        // WICHTIG für Mobile!
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
        window.addEventListener('pointercancel', onUp, { passive: false }); // Für Mobile wichtig
    }

    function onMove(e) {
        if (!dragActive) return;

        // Auch hier preventDefault
        e.preventDefault();

        const dx = e.clientX - dragStartClientX;
        const dy = e.clientY - dragStartClientY;

        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {   // etwas höherer Schwellwert für Touch
            didDrag = true;
        }

        const startPos = hexCenter(baseAnchorCol, baseAnchorRow);
        const targetX = startPos.x + dx;
        const targetY = startPos.y + dy;

        const snapped = pixelToGrid(targetX, targetY);

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

    return {
        destroy() {
            node.removeEventListener('pointerdown', onDown);
        }
    };
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
  
    <!-- Wire connections between consecutive nodes -->
    {#each nodePositions as node, i}
      {#if i > 0}
        <line
          x1={nodePositions[i-1].px} y1={nodePositions[i-1].py}
          x2={node.px} y2={node.py}
          stroke="url(#{gradId})" stroke-width="1.5" opacity="0.4"
          style="pointer-events:none;"
        />
      {/if}
    {/each}
  
    <!-- Hexagon nodes -->
    {#each nodePositions as node}
      <g
        data-node-id={node.id}
        style="pointer-events:all; cursor:{didDrag ? 'grabbing' : 'pointer'};"
        on:click={() => !didDrag && go(node.id)}
      >
        <!-- Fill -->
        <path
          d={hexPath(node.px, node.py)}
          fill={node.type === 'submit' ? 'rgba(42,233,201,0.08)' : '#111'}
          style="pointer-events:all;"
        />
  
        <!-- Animated gradient border -->
        <path
          d={hexPath(node.px, node.py)}
          fill="none"
          stroke="url(#{gradId})"
          stroke-width="1.5"
          opacity="0.85"
          style="pointer-events:all;"
        >
          <animate attributeName="opacity" values="0.5;1;0.5" dur="2.8s" repeatCount="indefinite"/>
        </path>
  
        <!-- Label -->
        {#each node.label.split('\n') as line, li}
          <text
            x={node.px}
            y={node.py + (li - (node.label.split('\n').length - 1) / 2) * 14}
            text-anchor="middle"
            dominant-baseline="middle"
            fill={node.type === 'submit' ? '#2ae9c9' : '#fff'}
            font-size="11"
            font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
            font-weight="600"
            letter-spacing="0.5"
            style="pointer-events:all; user-select:none; cursor:{didDrag ? 'grabbing' : 'pointer'};"
          >{line}</text>
        {/each}
      </g>
    {/each}
  </svg>
  <text x="30" y="60" fill="#0f0" font-size="13" style="pointer-events:none;">
    row {anchorRow} {anchorRow % 2 === 1 ? '(odd)' : '(even)'} | col {anchorCol}
  </text>
  <style>
    .hexmenu {
        overflow: visible;
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
    }
</style>