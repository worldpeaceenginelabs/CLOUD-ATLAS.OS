<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import Anypay from './hexmenu/Anypay.svelte';
  import Details from './hexmenu/Details.svelte';
  import Location from './hexmenu/Location.svelte';
  import { LOCATION_SCHEMA } from './hexmenu/locationschema';
  import HexGrid from './hexmenu/HexGrid.svelte';
  import { FORM_SCHEMA } from './hexmenu/formSchema';
  import {
    BASE_COL, BASE_ROW, BASE_R, MIN_COLS_VISIBLE, MIN_ROWS_VISIBLE,
    hexCenter, hexPath, computeNeededBox, computeBgHexes, wrapLabel,
  } from './hexmenu/geometry';

  const dispatch = createEventDispatcher();

  // HexMenu is the container for the whole hex system: it owns the
  // hex-root that deliberately spans the entire viewport (see below),
  // because the decorative hex background continues underneath the
  // globe. It measures its own usable rectangle via ResizeObserver, and
  // derives everything else — scale, the interactive menu's layout, and
  // the layout values HexGrid needs to draw the background — from that.
  // No external caller computes or passes any of this in anymore.

  // ─── RESPONSIVE SCALE (drives EVERYTHING: background + menu) ───
  let rootEl;
  let resizeObserver;

  // Full screen size — used for the decorative background hex tiling
  // (bgHexes), which is meant to cover the whole screen regardless of
  // where the menu itself is allowed to scale into.
  let vw = 1024;
  let vh = 768;

  // anchorCol/anchorRow: where the menu starts in the hex grid (drag
  // moves these — see draggable() further down). Declared here, ahead
  // of the rest of "MENU GEOMETRY", because the scale calculation
  // below needs their live values too — including while dragging.
  let anchorCol = 0;
  let anchorRow = 1; // visual starting row — intentional, keep as is

  function applySize(width, height) {
    vw = width;
    vh = height;
  }

  // ─── USABLE MENU AREA ───
  // hex-root spans the full workspace (vw × vh above), but the
  // *interactive* menu must only scale into the half of it the
  // globe-window doesn't cover — this mirrors the landscape/portrait
  // 50/50 split App.svelte's CSS applies to .globe-window. If that
  // split ratio ever changes there, it needs to change here too; short
  // of that, HexMenu no longer needs anything computed or passed in
  // from App.svelte to know its own usable area.
  $: landscape  = vw >= vh;
  $: menuWidth  = landscape ? vw / 2 : vw;
  $: menuHeight = landscape ? vh : vh / 2;

  // ─── WORST-CASE BOX: measured, not derived ───
  // computeNeededBox (from geometry.ts) probes a MIN_COLS_VISIBLE ×
  // MIN_ROWS_VISIBLE grid through the exact same hexCenter() used for
  // the real nodes, at the current anchor position. This guarantees the
  // box always matches whatever hexCenter() actually does — no separate
  // formula to keep in sync by hand, and no assumption baked in about
  // which rows end up wider because of colShift/xOffset. If hexCenter()
  // ever changes, this keeps working without edits here.
  //
  // Probed at BASE_* (unscaled) units. anchorCol/anchorRow are included
  // as live dependencies, so dragging the menu can never let it escape
  // the guaranteed minimum area — scale recomputes right along with it.
  $: neededBox = computeNeededBox(
    MIN_COLS_VISIBLE, MIN_ROWS_VISIBLE,
    anchorCol, anchorRow, BASE_COL, BASE_ROW, BASE_R
  );

  // Scaled against menuWidth/menuHeight (the menu's own half), NOT the
  // full-screen vw/vh — otherwise the menu thinks it has twice the
  // space it actually gets before the globe overlaps it.
  const PORTRAIT_LAYOUT_MARGIN = 0.075;
  $: scale = Math.min(
  1,
  menuWidth / neededBox.width,
  menuHeight / (neededBox.height * (landscape ? 1 : 1 + PORTRAIT_LAYOUT_MARGIN))
  );

  $: COL = BASE_COL * scale;
  $: ROW = BASE_ROW * scale;
  $: R   = BASE_R   * scale;
  $: FONT = Math.max(8, 11 * scale);

  // ─── BACKGROUND HEX TILES ───
  // Computed here (HexMenu owns the hex-system's scaling/layout) and
  // handed down to HexGrid.svelte, which only draws them.
  $: bgHexes = computeBgHexes(vw, vh, COL, ROW);

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

  // ─── ANYPAY: 5 fixed payment modes, referenced by id from the table ───
  const ANYPAY_OPTIONS = [
    { id: 'money',      label: 'Money' },
    { id: 'share',      label: 'Share' },
    { id: 'zerodollar', label: 'ZeroDollar' },
    { id: 'swap',       label: 'Swap' },
    { id: 'free',       label: 'Free' },
  ];

  // ─── DOMAIN / MODEL TABLE ───
  // This *is* the menu, from Row 2 down: one entry per domain, each with
  // its own model list (length varies — 1 to 4). A domain with <= 1
  // model has no model-selection row at all; the form appears right
  // after the domain is picked, using that single model as the
  // "effective model" for its AnyPay relations. A model with an empty
  // anypay[] (only Social, today) makes the ANYPAY hex disappear from
  // the form entirely — no special-casing needed, it all falls out of
  // this one table.
  const DOMAINS = [
    {
      id: 'move', label: 'MOVE',
      models: [
        { id: 'vehicle_exchange', label: 'Vehicle Exchange', anypay: ['share', 'swap'],
          description: 'Share or swap existing vehicles between people.',
          examples: 'Bikes, motorcycles, cars, boats, campers used jointly.' },
        { id: 'p2p_vehicle_rental', label: 'P2P Vehicle Rental', anypay: ['money', 'zerodollar'],
          description: 'Private individuals make vehicles temporarily available to others.',
          examples: 'Renting out a private car, motorcycle, or camper.' },
        { id: 'route_sharing', label: 'Route Sharing', anypay: ['free', 'share', 'zerodollar'],
          description: 'People use trips they were already making to carry extra people or goods.',
          examples: '"I\'m heading to Berlin anyway, I can take your package."' },
      ],
    },
    {
      id: 'goods', label: 'GOODS',
      models: [
        { id: 'goods_sharing', label: 'Goods Sharing', anypay: ['share', 'zerodollar', 'swap'],
          description: 'Shared use of existing items or spaces.',
          examples: 'Tools, tents, garages, workbenches, unused gardens, land.' },
      ],
    },
    {
      id: 'food', label: 'FOOD',
      models: [
        { id: 'food_production', label: 'Food Production', anypay: ['money', 'share', 'zerodollar', 'swap'],
          description: 'People produce food or meals for others.',
          examples: 'Home cooking, bread, cheese, garden produce, community kitchens.' },
        { id: 'meal_sharing', label: 'Meal Sharing', anypay: ['share', 'zerodollar', 'swap'],
          description: 'Cooking and eating together as a social activity.',
          examples: 'Dinners, cookouts, community meals.' },
        { id: 'food_exchange', label: 'Food Exchange', anypay: ['share', 'zerodollar', 'swap', 'free'],
          description: 'Share existing food or meals.',
          examples: 'Surplus food, garden produce, home-cooked meals.' },
        { id: 'food_rescue', label: 'Food Rescue', anypay: ['swap', 'free'],
          description: 'Rescue food from being wasted.',
          examples: 'Surplus food from households or businesses.' },
      ],
    },
    {
      id: 'skills', label: 'SKILLS',
      models: [
        { id: 'freelance_work', label: 'Freelance Work', anypay: ['money', 'share', 'zerodollar', 'swap'],
          description: 'Offer individual skills as a service.',
          examples: 'Programming, design, consulting, repairs.' },
        { id: 'production', label: 'Production', anypay: ['money', 'share', 'zerodollar', 'swap'],
          description: 'Direct production of physical goods between people.',
          examples: 'Carpentry, 3D printing, furniture making, craftwork.' },
        { id: 'skill_pooling', label: 'Skill Pooling', anypay: ['money', 'share', 'zerodollar', 'swap'],
          description: 'Pool several skills toward a shared goal.',
          examples: 'Open source, house building, community projects.' },
        { id: 'helpout', label: 'Helpout', anypay: ['share', 'zerodollar', 'swap'],
          description: 'Direct everyday support.',
          examples: 'Moving help, errands, neighborly assistance.' },
      ],
    },
    {
      id: 'stay', label: 'STAY',
      models: [
        { id: 'stay_exchange', label: 'Stay Exchange', anypay: ['share', 'zerodollar', 'swap'],
          description: 'Share or swap existing accommodation.',
          examples: 'Couchsurfing, home exchange, spare rooms.' },
        { id: 'stay_pooling', label: 'Stay Pooling', anypay: ['money'],
          description: 'Several people jointly fund a place to stay.',
          examples: 'Splitting a hotel room, Airbnb, vacation rental, nomad apartment.' },
      ],
    },
    {
      id: 'social', label: 'SOCIAL',
      models: [
        { id: 'social_activity_sharing', label: 'Social Network / Activity Sharing', anypay: [],
          description: 'People create, discover, and join shared activities. Focus: meeting people, leisure, and social connection.',
          examples: 'Discover local activities, join interest-based groups, and connect with people for hiking, games, sports, dining, and spontaneous meetups.' },
      ],
    },
    {
      id: 'social_time', label: 'SOCIAL\nTIME',
      models: [
        { id: 'social_time', label: 'Social Time', anypay: ['free', 'zerodollar'],
          description: 'People contribute time, experience, and voluntary work to community projects. Projects state their own requirements; people decide for themselves whether to join.',
          examples: 'Animal shelter help, environmental action, reforestation, community gardens, health drives, education projects, repair days.' },
      ],
    },
  ];

  // ─── SELECTIONS ───
  // Same principle as before: every value here is independent state that
  // a click only ever flips on its own node; a row is only ever hidden
  // because its *parent* selection was cleared, never reset explicitly.
  // Nothing commits until SUBMIT.
  //
  // Row 0 (header):      live | listings | next
  // Row 1:
  //   under 'live':      need_ride | offer_ride
  //   under 'listings':  list_offer | list_search
  //   under 'next':      m1..m4 (unchanged)
  // Row 2-3 (listings):  domain (7 hexagons, from DOMAINS)
  // Row 4 (listings):    model — only rendered if the domain has > 1 models
  // Row 4 or 5:          LOCATION / DETAILS / [ANYPAY] / SUBMIT
  //   - 'live' path lands on this row right under the ride choice (row 2)
  //   - 'listings' path lands here after domain (+ model, if any)
  //   - ANYPAY is only shown if the effective model has anypay options
  let selMode = null;      // null | 'live' | 'listings' | 'next'
  let selRide = null;      // null | 'need_ride' | 'offer_ride'   (only under 'live')
  let selAction = null;    // null | 'list_offer' | 'list_search' (only under 'listings')
  let selCategory = null;  // null | one of DOMAINS[].id
  let selModel = null;     // null | a model id from the selected domain
  let selAnypay = [];      // array of ANYPAY_OPTIONS[].id — multi-select
  let anypayModalOpen = false;
  let detailsValues = {};  // { mode, title, categoryId|categoryIds, date, description, contact }
  let detailsModalOpen = false;
  let selLocation:
  | { geometry: 'point'; point: { latitude: number; longitude: number } }
  | { geometry: 'route'; from: { latitude: number; longitude: number }; to: { latitude: number; longitude: number } }
  | null = null;
  let locationModalOpen = false;

  const CATEGORY_IDS = new Set(DOMAINS.map(d => d.id));

  function toggle(currentVal, id) {
    return currentVal === id ? null : id;
  }

  // Current domain object + the model that's actually "in effect" for
  // AnyPay purposes: either the one the user picked, or — for domains
  // with only one model — that single model automatically.
  $: currentDomain = selCategory ? DOMAINS.find(d => d.id === selCategory) : null;
  $: hasModelChoice = !!currentDomain && currentDomain.models.length > 1;
  $: effectiveModel = !currentDomain ? null
    : hasModelChoice ? (currentDomain.models.find(m => m.id === selModel) || null)
    : currentDomain.models[0];
  $: dispatch('tooltip', effectiveModel);

  function go(id) {
    if (didDrag) return;
    if (id === 'bbq') return; // permanently inert placeholder

    if (id === 'live' || id === 'listings' || id === 'next') {
      const next = toggle(selMode, id);
      if (next !== selMode) { selRide = null; selAction = null; selCategory = null; selModel = null; selAnypay = []; detailsValues = {}; selLocation = null; }
      selMode = next;
      return;
    }
    if (id === 'need_ride' || id === 'offer_ride') { selRide = toggle(selRide, id); selAnypay = []; detailsValues = {}; selLocation = null; return; }
    if (id === 'list_offer' || id === 'list_search') {
      const next = toggle(selAction, id);
      if (next !== selAction) { selCategory = null; selModel = null; selAnypay = []; detailsValues = {}; selLocation = null; }
      selAction = next;
      return;
    }
    if (CATEGORY_IDS.has(id)) {
      const next = toggle(selCategory, id);
      if (next !== selCategory) { selModel = null; selAnypay = []; detailsValues = {}; selLocation = null; }
      selCategory = next;
      return;
    }
    if (currentDomain && currentDomain.models.some(m => m.id === id)) {
      selModel = toggle(selModel, id);
      selAnypay = [];
      detailsValues = {};
      selLocation = null;
      return;
    }
    if (id === 'anypay') { anypayModalOpen = true; return; }
    if (id === 'details') { detailsModalOpen = true; return; }
    if (id === 'location') {
    locationModalOpen = true;
    return;
    }
    if (id === 'submit' || id === 'gosearch') {
      // The one true point of no return: hand off, then clear the slate.
      if (selMode === 'live') {
        dispatch(selRide === 'offer_ride' ? 'offerSubmit' : 'searchSubmit', {
          selMode, selRide, selAnypay,
        });
      } else {
        dispatch(selAction === 'list_offer' ? 'offerSubmit' : 'searchSubmit', {
          selMode, selAction, selCategory, selModel, selAnypay, detailsValues,
        });
      }
      selMode = null; selRide = null; selAction = null;
      selCategory = null; selModel = null; selAnypay = [];
      detailsValues = {}; selLocation = null;
      return;
    }
    // m1-m4: reserved for future sub-flows.
  }

  function onDetailsUpdate(e) {
    detailsValues = { ...detailsValues, [e.detail.key]: e.detail.value };
    // modal stays open — same as Anypay, the user closes it themselves
    // via the X button once they're done filling things in.
  }

  function onAnypayToggle(e) {
    const id = e.detail.id;
    selAnypay = selAnypay.includes(id) ? selAnypay.filter(x => x !== id) : [...selAnypay, id];
    // modal stays open — the user picks as many as they like, then
    // closes it themselves via the X button
  }

  function onLocationConfirm(e) {
  selLocation = e.detail;
  locationModalOpen = false;
  }

  function onLocationCancel() {
  locationModalOpen = false;
  }

  // ─── DERIVED NODE ROWS ───
  $: headerNodes = [
    { id: 'live',     label: 'LIVE',     col: 0, lrow: 0 },
    { id: 'listings', label: 'LISTINGS', col: 1, lrow: 0 },
    { id: 'next',     label: 'NEXT',     col: 2, lrow: 0 },
    { id: 'bbq',      label: 'BBQ',      col: 3, lrow: 0, noop: true },
  ].map(n => ({ ...n, dimmed: selMode !== null && n.id !== selMode, selected: n.id === selMode }));

  $: rideNodes = selMode === 'live' ? [
    { id: 'need_ride',  label: 'I NEED\nA RIDE',  col: 0, lrow: 1 },
    { id: 'offer_ride', label: 'I OFFER\nA RIDE', col: 1, lrow: 1 },
  ].map(n => ({ ...n, dimmed: selRide !== null && n.id !== selRide, selected: n.id === selRide })) : [];

  $: actionNodes = selMode === 'listings' ? [
    { id: 'list_offer',  label: 'OFFER',  col: 0, lrow: 1 },
    { id: 'list_search', label: 'SEARCH', col: 1, lrow: 1 },
  ].map(n => ({ ...n, dimmed: selAction !== null && n.id !== selAction, selected: n.id === selAction })) : [];

  $: missionNodes = selMode === 'next' ? [
    { id: 'm1', label: 'MISSION 1\nTV',      col: 0, lrow: 1 },
    { id: 'm2', label: 'MISSION 2\nGOV',     col: 1, lrow: 1 },
    { id: 'm3', label: 'MISSION 3\nOMNI',    col: 2, lrow: 1 },
    { id: 'm4', label: 'MISSION 4\nCONSERV', col: 3, lrow: 1 },
  ] : [];

  $: showCategories = selMode === 'listings' && selAction !== null;
  $: categoryNodes = showCategories ? DOMAINS.map((d, i) => ({
    id: d.id, label: d.label, col: i % 4, lrow: 2 + Math.floor(i / 4),
    dimmed: selCategory !== null && d.id !== selCategory, selected: d.id === selCategory,
  })) : [];

  $: showModelRow = showCategories && hasModelChoice;
  $: modelNodes = showModelRow ? currentDomain.models.map((m, i) => ({
    id: m.id, label: wrapLabel(m.label), col: i, lrow: 4,
    dimmed: selModel !== null && m.id !== selModel, selected: m.id === selModel,
  })) : [];

  // Two independent paths into the form: 'live' skips domain/model
  // entirely and drops straight to the form at row 2; 'listings' only
  // reaches it once there's an effective model (either picked, or
  // automatic for single-model domains) — at row 4 (no model row shown)
  // or row 5 (model row shown).
  $: showFormLive = selMode === 'live' && selRide !== null;
  $: showFormListings = showCategories && !!effectiveModel;
  $: showForm = showFormLive || showFormListings;
  $: formLrow = showFormLive ? 2 : (hasModelChoice ? 5 : 4);
  $: isSubmitKind = selMode === 'live' ? selRide === 'offer_ride' : selAction === 'list_offer';

  // AnyPay availability: driven by the effective model's table row when
  // we're in the 'listings' path (this is also what makes the ANYPAY hex
  // disappear entirely for Social, whose model has no anypay relations
  // at all). The 'live' path isn't in the table, so all 5 stay open.
  $: anypayAvailable = selMode === 'listings'
    ? (effectiveModel ? effectiveModel.anypay : [])
    : ANYPAY_OPTIONS.map(o => o.id);
  $: showAnypayHex = showForm && anypayAvailable.length > 0;

  // ─── RED → GREEN READINESS CHAIN ───
  // Every "done" flag below is a pure derivation off state that already
  // exists — nothing here is its own source of truth, so there's no way
  // for the readiness chain to drift out of sync with the actual data.
  //
  // detailsSchema comes from two different sources depending on path:
  // 'listings' keys off effectiveModel (the domain/model table), 'live'
  // keys off selRide directly, since there's no domain/model there at
  // all. Same FORM_SCHEMA object either way — need_ride/offer_ride just
  // live in it under their own keys instead of a model id.
  $: detailsSchema = selMode === 'live'
    ? (selRide ? FORM_SCHEMA[selRide] : null)
    : (effectiveModel ? FORM_SCHEMA[effectiveModel.id] : null);

    $: locationSchema = selMode === 'live'
  ? (selRide ? LOCATION_SCHEMA[selRide] : null)
  : (effectiveModel ? LOCATION_SCHEMA[effectiveModel.id] : null);

  // Every field group above is optional and independent — detailsDone
  // only checks the groups the current schema actually declares, so
  // need_ride/offer_ride (no title, no contact) are just as "complete"
  // as a full listing form once their smaller field set is filled in.
  $: detailsDone = !detailsSchema ? true : (
    (!detailsSchema.title || !!detailsValues.title) &&
    (!detailsSchema.description || !!detailsValues.description) &&
    (!detailsSchema.contact || !!detailsValues.contact) &&
    (!detailsSchema.category || (detailsSchema.category.multi
      ? (detailsValues.categoryIds || []).length > 0
      : !!detailsValues.categoryId)) &&
    (!detailsSchema.date || !detailsSchema.date.required || !!detailsValues.date)
  );

  $: locationDone = !locationSchema
  ? true
  : locationSchema.geometry === 'point'
    ? !!selLocation?.point
    : !!(selLocation?.from && selLocation?.to);

  $: anypayDone = !showAnypayHex || selAnypay.length > 0;

  $: submitReady = locationDone && detailsDone && anypayDone;

  // formRow nodes use their own red→green language (see the readiness
  // chain above) instead of the blue "selected" language every other
  // hexagon uses — `done` is the only thing that varies per node here.
  $: formNodes = showForm ? (() => {
    const base = [
      { id: 'location', label: 'LOCATION', col: 0, lrow: formLrow, formRow: true, done: locationDone },
      { id: 'details',  label: 'DETAILS',  col: 1, lrow: formLrow, formRow: true, done: detailsDone },
    ];
    if (showAnypayHex) {
      base.push({ id: 'anypay', label: 'ANYPAY', col: 2, lrow: formLrow, formRow: true, done: anypayDone });
    }
    const submitCol = showAnypayHex ? 3 : 2;
    base.push(
      isSubmitKind
        ? { id: 'submit',   label: 'SUBMIT', col: submitCol, lrow: formLrow, formRow: true, done: submitReady }
        : { id: 'gosearch', label: 'SEARCH', col: submitCol, lrow: formLrow, formRow: true, done: submitReady }
    );
    return base;
  })() : [];

  $: nodes = [...headerNodes, ...rideNodes, ...actionNodes, ...missionNodes, ...categoryNodes, ...modelNodes, ...formNodes];

  // ─── MENU GEOMETRY ───
  // anchorCol/anchorRow now live up top, next to the scale/neededBox
  // calculation that depends on them — see RESPONSIVE SCALE section.
  let didDrag = false;

  $: nodePositions = COL && ROW ? nodes.map(n => {
    const base = hexCenter(anchorCol + n.col, n.lrow, anchorCol, anchorRow, COL, ROW);
    return { ...n, px: base.x, py: base.y };
  }) : [];

  const gradId = 'hexgrad_' + Math.random().toString(36).slice(2);
  const glowId = 'hexglow_' + Math.random().toString(36).slice(2);

  // ─── MODEL TOOLTIP ───
  // Not its own state at all — just a view onto the selection that
  // already exists. effectiveModel is "the model currently in effect":
  // for single-model domains that's immediate on category selection,
  // for multi-model domains it becomes non-null once a model row is
  // picked. Same value on mobile and desktop, no hover/hold needed.

  // ─── DRAGGABLE ───
  function draggable(node) {
    let dragActive = false;
    let baseAnchorCol = 0, baseAnchorRow = 0;
    let startClientX = 0, startClientY = 0;

    function onDown(e) {
      // Pan gesture stays scoped to row 0 (the header hexes) plus empty
      // background space, so a quick tap elsewhere on a hexagon can't
      // accidentally turn into a menu-drag.
      const targetNode = e.target.closest('[data-node-id]');
      if (targetNode) {
        const entry = nodePositions.find(n => n.id === targetNode.getAttribute('data-node-id'));
        if (entry && entry.lrow !== 0) return;
      }
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
      const c = COL, r = ROW;
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
    resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        applySize(width, height);
      }
    });
    resizeObserver.observe(rootEl);

    applySize(rootEl.clientWidth, rootEl.clientHeight);

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

  <HexGrid hexes={bgHexes} radius={R} {scale} />

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
          fill={node.formRow
            ? (node.done ? 'rgba(46,204,113,0.32)' : 'rgba(255,90,90,0.16)')
            : (node.selected ? 'rgba(51,91,244,0.38)' : '#111')}
          style="pointer-events:all;"
        />
        <path
          d={hexPath(node.px, node.py, R)}
          fill="none"
          stroke={node.formRow
            ? (node.done ? '#57e389' : '#ff6b6b')
            : (node.selected ? '#8fb0ff' : `url(#${gradId})`)}
          stroke-width={((node.formRow ? node.done : node.selected) ? 3 : 1.5) * scale}
          opacity={(node.formRow ? node.done : node.selected) ? 1 : 0.85}
          filter={(node.formRow ? node.done : node.selected) ? `url(#${glowId})` : 'none'}
          style="pointer-events:all;"
        >
          {#if !(node.formRow ? node.done : node.selected)}
            <animate attributeName="opacity" values="0.5;1;0.5" dur="2.8s" repeatCount="indefinite"/>
          {/if}
        </path>
        {#each node.label.split('\n') as line, li}
          <text
            x={node.px}
            y={node.py + (li - (node.label.split('\n').length - 1) / 2) * (FONT + 3)}
            text-anchor="middle"
            dominant-baseline="middle"
            fill={node.formRow
              ? (node.done ? '#eafff0' : '#ffd6d6')
              : (node.selected ? '#e4ecff' : '#fff')}
            font-size={FONT}
            font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
            font-weight={(node.formRow ? node.done : node.selected) ? 700 : 600}
            letter-spacing="0.5"
            style="pointer-events:none; user-select:none;"
          >{line}</text>
        {/each}
      </g>
    {/each}
  </svg>

  {#if anypayModalOpen}
    <Anypay
      options={ANYPAY_OPTIONS}
      available={anypayAvailable}
      selected={selAnypay}
      on:toggle={onAnypayToggle}
      on:close={() => anypayModalOpen = false}
    />
  {/if}

  {#if detailsModalOpen}
    <Details
      schema={detailsSchema}
      values={detailsValues}
      on:update={onDetailsUpdate}
      on:close={() => detailsModalOpen = false}
    />
  {/if}

  {#if locationModalOpen}
  <Location
  schema={locationSchema}
  on:confirm={onLocationConfirm}
  on:cancel={onLocationCancel}
/>
  {/if}

</div>

<style>
 .hex-root {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #2b2b2b;
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
    z-index: 1; /* behind HexGrid's .hex-grid (z-index:2) */
    will-change: transform;
    backface-visibility: hidden;
    pointer-events: none;
  }

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
</style>