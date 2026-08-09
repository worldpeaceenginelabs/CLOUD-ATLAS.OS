<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import Anypay from './hexmenu/Anypay.svelte';
  import Details from './hexmenu/Details.svelte';
  import Location from './hexmenu/Location.svelte';
  import HexGrid from './hexmenu/HexGrid.svelte';
  import {
    DOMAINS, ANYPAY_OPTIONS, detailsFor, isDetailsComplete, isLocationComplete,
    MODES, SHORTCUT_MODES, ACTIONS, FORM_STEP_LABELS,
    type LocationValue,
  } from './hexmenu/domains';
  import { HEX_MESSAGES } from './hexmenu/hexMessages';
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
  // Content lives in hexMessages.ts — see that file's comment.
  let messageElement;
  let showMessageTimeout;

  function showMessage() {
    if (!messageElement) return;
    const mw = 300, mh = 200;
    const x = 20 + Math.random() * Math.max(20, vw - mw - 40);
    const y = 20 + Math.random() * Math.max(20, vh - mh - 40);
    messageElement.style.left = `${x}px`;
    messageElement.style.top = `${y}px`;
    messageElement.innerHTML = HEX_MESSAGES[Math.floor(Math.random()*HEX_MESSAGES.length)];
    messageElement.style.opacity = '1';
    if (showMessageTimeout) clearTimeout(showMessageTimeout);
    showMessageTimeout = setTimeout(() => {
      if (messageElement) messageElement.style.opacity = '0';
      showMessageTimeout = setTimeout(showMessage, 5000);
    }, 10000);
  }

  // ─── DOMAIN / MODEL TABLE ───
  // Sourced entirely from domains.ts (see import above). One entry per
  // domain, each with its own model list (length varies — 1 to 4). A
  // domain with <= 1 model has no model-selection row at all; the form
  // appears right after the domain is picked, using that single model
  // as the "effective model" for its AnyPay/Location/Details config. A
  // model with an empty anypay[] (only Social, today) makes the ANYPAY
  // hex disappear from the form entirely — no special-casing needed,
  // it all falls out of the domains.ts table.

  // ─── SELECTIONS ───
  // Every value here is independent state that a click only ever flips
  // on its own node; a row is only ever hidden because its *parent*
  // selection was cleared, never reset explicitly — with one
  // deliberate exception: selAction. Switching selAction (OFFER↔SEARCH,
  // or a shortcut mode's own two buttons) never clears anything
  // downstream — domain, model, anypay, details, and location all
  // survive an action switch, since selAction isn't a parent of any of
  // them, it's a sibling. Only an actual change to domain or model
  // (a real parent) still invalidates what depends on it. SUBMIT no
  // longer clears the slate either — selections persist after
  // dispatch, so the same intent can be re-submitted under a different
  // action without re-entering anything.
  //
  // selAction is the one shared ACTION concept for every mode — a
  // shortcut mode (see activeShortcut below) and 'listings' just show
  // different row-1 buttons for the same underlying ACTIONS[].id value.
  // Under a shortcut mode, picking an action also fixes selDomain/
  // selModel internally, from that shortcut's own config — no domain/
  // model choice of its own, it's a fixed binding onto the same
  // DOMAINS table 'listings' uses.
  //
  // Row 0 (header):      MODES (from domains.ts)
  // Row 1:
  //   under a shortcut mode: activeShortcut.actions → selAction
  //   under the genericFlow mode: ACTIONS → selAction
  //   any other mode:            its own placeholderNodes, if any (unchanged, no flow wired up)
  // Row 2+ (listings):   domain (from DOMAINS)
  // Row +1 (listings):   model — only rendered if the domain has > 1 selectable models
  // Last row:             LOCATION / DETAILS / [ANYPAY] / SUBMIT-or-SEARCH
  //   - a shortcut mode lands on this row right under its action row
  //   - 'listings' lands here after domain (+ model, if any)
  //   - ANYPAY is only shown if the effective model has anypay options
  let selMode = null;      // null | one of MODES[].id
  let selAction = null;    // null | one of ACTIONS[].id (shared by every mode)
  let selDomain = null;    // null | one of DOMAINS[].id
  let selModel = null;     // null | a model id from the selected domain
  let selAnypay = [];      // array of ANYPAY_OPTIONS[].id — multi-select
  let anypayModalOpen = false;
  let detailsValues = {};  // { interactionMode, title, categoryId|categoryIds, date, description, contact }
  let detailsModalOpen = false;
  let selLocation: LocationValue | null = null;
  let locationModalOpen = false;

  const DOMAIN_IDS = new Set(DOMAINS.map(d => d.id));

  function toggle(currentVal, id) {
    return currentVal === id ? null : id;
  }

  // The active MODES entry, if any — drives isGenericFlow (below) the
  // same way activeShortcut drives the shortcut-mode path. HexMenu
  // never compares selMode to a literal id anywhere; it only asks
  // "does the active mode have this flag/binding".
  $: activeMode = selMode ? MODES.find(m => m.id === selMode) || null : null;
  $: isGenericFlow = !!activeMode?.genericFlow;

  // The shortcut config for the current mode, if any (see
  // SHORTCUT_MODES in domains.ts) — null when the active mode has no
  // fixed binding. Drives shortcutNodes below and effectiveModel's
  // resolution.
  $: activeShortcut = SHORTCUT_MODES.find(s => s.modeId === selMode) || null;

  // Current domain object + the model that's actually "in effect" for
  // AnyPay purposes: either the one the user picked, or — for domains
  // with only one selectable model — that single model automatically.
  //
  // listableModels excludes `internalOnly` models (today: ridehailing)
  // from the Listings model row — those are only reachable via a
  // shortcut mode's fixed binding (activeShortcut, resolved directly
  // against currentDomain.models below), never via this hex row, so the
  // existing Move models (vehicle_exchange, p2p_vehicle_rental,
  // route_sharing) stay exactly as they were, unaffected by
  // ridehailing now living in the same table.
  $: currentDomain = selDomain ? DOMAINS.find(d => d.id === selDomain) : null;
  $: listableModels = currentDomain ? currentDomain.models.filter(m => !m.internalOnly) : [];
  $: hasModelChoice = listableModels.length > 1;
  $: effectiveModel = !currentDomain ? null
    : activeShortcut ? (currentDomain.models.find(m => m.id === selModel) || null)
    : hasModelChoice ? (listableModels.find(m => m.id === selModel) || null)
    : (listableModels[0] || null);
  $: dispatch('tooltip', effectiveModel);

  // Assembles the outward-facing submit payload from the current
  // selections — unchanged from the existing implementation, just
  // placed here since it reads HexMenu's own selection state directly
  // (selDomain/selModel/selAction/selAnypay/detailsValues/selLocation
  // already match its parameter-free reads 1:1).
  function buildPayload() {
    return {
      tags: [
        ['domain', selDomain],
        ['model', selModel],
        ['action', selAction],
        ...selAnypay.map(id => ['anypay', id]),
      ],
      content: JSON.stringify({
        ...detailsValues,
        location: selLocation,
      }),
    };
  }

  function go(id) {
    if (didDrag) return;
    if (MODES.some(m => m.id === id && m.noop)) return; // inert placeholder hex (today: BBQ)

    if (MODES.some(m => m.id === id && !m.noop)) {
      const next = toggle(selMode, id);
      if (next !== selMode) { selAction = null; selDomain = null; selModel = null; selAnypay = []; detailsValues = {}; selLocation = null; }
      selMode = next;
      return;
    }
    if (activeShortcut) {
      const a = activeShortcut.actions.find(x => x.id === id);
      if (a) {
        // UI navigation only — the fachliche binding (which domain and
        // model this shortcut points to) comes entirely from
        // activeShortcut, never a literal here. Domain/model are this
        // shortcut's fixed binding, not a per-click choice, so they
        // stay set regardless of which way selAction toggles —
        // anypay/details/location are untouched too, same reasoning
        // as the genericFlow action row above.
        selAction = selAction === a.action ? null : a.action;
        selDomain = activeShortcut.domain;
        selModel = activeShortcut.model;
        return;
      }
    }
    if (isGenericFlow && ACTIONS.some(a => a.id === id)) {
      // Only selAction toggles here. Domain/model (and everything that
      // depends on them — anypay/details/location) are untouched: an
      // OFFER↔SEARCH switch is a change to selAction, not to any
      // higher-level selection, so nothing downstream invalidates.
      selAction = selAction === id ? null : id;
      return;
    }
    if (DOMAIN_IDS.has(id)) {
      const next = toggle(selDomain, id);
      if (next !== selDomain) { selModel = null; selAnypay = []; detailsValues = {}; selLocation = null; }
      selDomain = next;
      return;
    }
    if (listableModels.some(m => m.id === id)) {
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
    if (ACTIONS.some(a => a.submitNodeId === id)) {
      // Hand off via the existing buildPayload()/submitEvent mechanism.
      // No state reset anymore — selections (including selAction)
      // persist after submit, so e.g. an OFFER can be followed by a
      // SEARCH on the same intent without re-entering anything.
      const actionCfg = ACTIONS.find(a => a.id === selAction);
      const payload = buildPayload();
      console.log(payload);
      dispatch(actionCfg.submitEvent, payload);
      return;
    }
    // A mode with placeholderNodes (today: 'next') is reserved: those
    // hexagons render but go nowhere.
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
  $: headerNodes = MODES.map((m, i) => ({
    id: m.id, label: m.label, col: i, lrow: 0, noop: m.noop,
    dimmed: selMode !== null && m.id !== selMode, selected: m.id === selMode,
  }));

  // A shortcut mode's row-1 buttons (today: LIVE's "I NEED A RIDE" / "I
  // OFFER A RIDE") — fully data-driven off activeShortcut, so HexMenu
  // doesn't know these are about rides at all, only that the active
  // mode has its own fixed set of action buttons.
  $: shortcutNodes = activeShortcut ? activeShortcut.actions.map((a, i) => ({
    id: a.id, label: a.label, col: i, lrow: 1, action: a.action,
    dimmed: selAction !== null && a.action !== selAction, selected: a.action === selAction,
  })) : [];

  $: actionNodes = isGenericFlow ? ACTIONS.map((a, i) => ({
    id: a.id, label: a.label, col: i, lrow: 1, action: a.id,
    dimmed: selAction !== null && a.id !== selAction, selected: a.id === selAction,
  })) : [];

  // A mode with no genericFlow and no shortcut binding just renders its
  // own placeholderNodes as-is (today: 'next') — no literal mode id
  // checked here either.
  $: placeholderNodes = activeMode?.placeholderNodes ? activeMode.placeholderNodes.map((m, i) => ({
    id: m.id, label: m.label, col: i, lrow: 1,
  })) : [];

  // Hex-grid wrap width for the domain row — a generic layout choice
  // (how many hexes fit per row before wrapping), not fachliche data,
  // so it stays a local constant here rather than moving to domains.ts.
  const ITEMS_PER_ROW = 4;

  $: showDomains = isGenericFlow && selAction !== null;
  // How many rows the domain grid actually needs — derived from
  // DOMAINS.length, never assumed. This is what lets formLrow (below)
  // stay correct regardless of how many domains a different app's
  // domains.ts declares, instead of baking in "domains always fit in
  // at most 2 rows".
  $: domainRows = showDomains ? Math.ceil(DOMAINS.length / ITEMS_PER_ROW) : 0;
  $: domainNodes = showDomains ? DOMAINS.map((d, i) => ({
    id: d.id, label: d.label, col: i % ITEMS_PER_ROW, lrow: 2 + Math.floor(i / ITEMS_PER_ROW),
    dimmed: selDomain !== null && d.id !== selDomain, selected: d.id === selDomain,
  })) : [];

  $: showModelRow = showDomains && hasModelChoice;
  $: modelRowLrow = 2 + domainRows;
  $: modelNodes = showModelRow ? listableModels.map((m, i) => ({
    id: m.id, label: wrapLabel(m.label), col: i, lrow: modelRowLrow,
    dimmed: selModel !== null && m.id !== selModel, selected: m.id === selModel,
  })) : [];

  // Two independent paths into the form: a shortcut mode (see
  // activeShortcut) skips the domain/model hex rows entirely and drops
  // straight to the form right under its own action row (row 2);
  // 'listings' only reaches it once there's an effective model (either
  // picked, or automatic for single-model domains) — right after
  // however many domain/model rows actually rendered. No row number
  // here is hand-picked; formLrow is 2 (header + action row) plus
  // whatever showed up in between.
  $: showFormShortcut = !!activeShortcut && selAction !== null;
  $: showFormListings = showDomains && !!effectiveModel;
  $: showForm = showFormShortcut || showFormListings;
  $: formLrow = showFormShortcut ? 2 : 2 + domainRows + (showModelRow ? 1 : 0);
  $: activeActionCfg = ACTIONS.find(a => a.id === selAction) || null;

  // AnyPay availability now comes from the same place for both modes —
  // the effective model's table row (this is also what makes the
  // ANYPAY hex disappear entirely for Social, whose model has no anypay
  // relations at all; and stays fully open for ridehailing, whose
  // anypay list is all 5 ids).
  $: anypayAvailable = effectiveModel ? effectiveModel.anypay : [];
  $: showAnypayHex = showForm && anypayAvailable.length > 0;

  // ─── RED → GREEN READINESS CHAIN ───
  // Every "done" flag below is a pure derivation off state that already
  // exists — nothing here is its own source of truth, so there's no way
  // for the readiness chain to drift out of sync with the actual data.
  //
  // detailsSchema/locationSchema come from the same place regardless of
  // path now — effectiveModel — since a shortcut mode resolves to a
  // real model via its fixed binding (see activeShortcut), same as any
  // 'listings' model. detailsFor() is the one place that knows whether
  // a model's Details schema varies by action; HexMenu doesn't need to.
  $: detailsSchema = effectiveModel ? detailsFor(effectiveModel, selAction) : null;

  $: locationSchema = effectiveModel ? effectiveModel.location : null;

  // Every field group in the schema is optional and independent —
  // isDetailsComplete() only checks the groups the current schema
  // actually declares, so a shortcut mode's smaller field set (no
  // title, no contact) is just as "complete" as a full listing form
  // once its own fields are filled in. Same idea for isLocationComplete
  // — both live in domains.ts (see detailsFor()'s comment) so HexMenu
  // never needs to know the field vocabulary itself.
  $: detailsDone = isDetailsComplete(detailsSchema, detailsValues);
  $: locationDone = isLocationComplete(locationSchema, selLocation);

  $: anypayDone = !showAnypayHex || selAnypay.length > 0;

  $: submitReady = locationDone && detailsDone && anypayDone;

  // formRow nodes use their own red→green language (see the readiness
  // chain above) instead of the blue "selected" language every other
  // hexagon uses — `done` is the only thing that varies per node here.
  $: formNodes = showForm ? (() => {
    const base = [
      { id: 'location', label: FORM_STEP_LABELS.location, col: 0, lrow: formLrow, formRow: true, done: locationDone },
      { id: 'details',  label: FORM_STEP_LABELS.details,  col: 1, lrow: formLrow, formRow: true, done: detailsDone },
    ];
    if (showAnypayHex) {
      base.push({ id: 'anypay', label: FORM_STEP_LABELS.anypay, col: 2, lrow: formLrow, formRow: true, done: anypayDone });
    }
    const submitCol = showAnypayHex ? 3 : 2;
    base.push({
      id: activeActionCfg.submitNodeId, label: activeActionCfg.submitLabel,
      col: submitCol, lrow: formLrow, formRow: true, done: submitReady,
    });
    return base;
  })() : [];

  $: nodes = [...headerNodes, ...shortcutNodes, ...actionNodes, ...placeholderNodes, ...domainNodes, ...modelNodes, ...formNodes];

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
  geometry={locationSchema?.geometry ?? 'point'}
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