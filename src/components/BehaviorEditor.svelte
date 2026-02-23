<script lang="ts">
  import { onMount, afterUpdate } from 'svelte';
  import type { Behavior, AreaBounds, LatLon } from '../types';
  import {
    models,
    isRoamingAreaMode, roamingAreaBounds, roamingPaintSignal,
    roamingCancelSignal, roamingClearSignal,
    isPathDrawingMode, pathWaypoints, pathPaintSignal,
    pathCancelSignal, pathClearSignal,
    editingModelId,
  } from '../store';
  import FormInput from './FormInput.svelte';
  import GlassmorphismButton from './GlassmorphismButton.svelte';

  export let behavior: Behavior | null = null;

  // Legacy compat props (still used by parent for backward compat)
  export let isRoamingEnabled = false;
  export let roamingSpeed = 1.0;
  export let roamingArea: AreaBounds | null = null;

  type BehaviorType = 'none' | 'roam' | 'path' | 'orbit' | 'follow' | 'herd';
  let selectedType: BehaviorType = 'none';

  // Path state
  let pathSpeed = 2.0;
  let pathSpeedValue = '2.0';
  let pathLoop = true;
  let pathClampToGround = true;
  let localWaypoints: LatLon[] = [];
  let isDrawingPath = false;

  // Herd state
  let herdCount = 10;
  let herdCountValue = '10';
  let herdMotionPattern: 'circle' | 'figure8' | 'wander' | 'fixed' = 'wander';
  let herdMotionRadius = 5;
  let herdMotionRadiusValue = '5';
  let herdMotionSpeed = 1.0;
  let herdMotionSpeedValue = '1.0';
  let herdCanvasType: 'roam' | 'path' = 'roam';

  // Orbit state
  let orbitTargetModelId = '';
  let orbitRadius = 50;
  let orbitRadiusValue = '50';
  let orbitSpeed = 2;
  let orbitSpeedValue = '2';
  let orbitAxis: 'y' | 'x' | 'z' = 'y';

  // Follow state
  let followTargetModelId = '';
  let followOffsetX = 0;
  let followOffsetXValue = '0';
  let followOffsetY = -10;
  let followOffsetYValue = '-10';
  let followOffsetZ = 0;
  let followOffsetZValue = '0';
  let followSpeed = 2;
  let followSpeedValue = '2';

  // Available target models (excluding current model being edited)
  $: targetModels = $models.filter(m => m.id !== $editingModelId);

  // Roaming local state (for paint area UX)
  let isPaintingArea = false;
  let areaBounds: AreaBounds | null = null;
  let roamingSpeedValue = roamingSpeed.toString();
  let lastPropSpeed = roamingSpeed;

  // Hydrate local state from behavior prop on mount (one-time, avoids cycles)
  onMount(() => {
    if (!behavior) return;
    selectedType = behavior.type;
    if (behavior.type === 'roam') {
      areaBounds = behavior.area;
      roamingSpeedValue = behavior.speed.toString();
      isRoamingEnabled = true;
      roamingSpeed = behavior.speed;
      roamingArea = behavior.area;
    } else if (behavior.type === 'path') {
      localWaypoints = [...behavior.waypoints];
      pathSpeed = behavior.speed;
      pathSpeedValue = behavior.speed.toString();
      pathLoop = behavior.loop;
      pathClampToGround = behavior.clampToGround;
    } else if (behavior.type === 'orbit') {
      orbitTargetModelId = behavior.targetModelId;
      orbitRadius = behavior.radius;
      orbitRadiusValue = behavior.radius.toString();
      orbitSpeed = behavior.speed;
      orbitSpeedValue = behavior.speed.toString();
      orbitAxis = behavior.axis;
    } else if (behavior.type === 'follow') {
      followTargetModelId = behavior.targetModelId;
      followOffsetX = behavior.offset.x;
      followOffsetXValue = behavior.offset.x.toString();
      followOffsetY = behavior.offset.y;
      followOffsetYValue = behavior.offset.y.toString();
      followOffsetZ = behavior.offset.z;
      followOffsetZValue = behavior.offset.z.toString();
      followSpeed = behavior.speed;
      followSpeedValue = behavior.speed.toString();
    } else if (behavior.type === 'herd') {
      herdCount = behavior.count;
      herdCountValue = behavior.count.toString();
      herdMotionPattern = behavior.motionPattern;
      herdMotionRadius = behavior.motionRadius;
      herdMotionRadiusValue = behavior.motionRadius.toString();
      herdMotionSpeed = behavior.motionSpeed;
      herdMotionSpeedValue = behavior.motionSpeed.toString();
      herdCanvasType = behavior.canvas.type;
    }
  });

  // Sync numeric strings
  $: roamingSpeed = parseFloat(roamingSpeedValue) || 1.0;
  $: pathSpeed = parseFloat(pathSpeedValue) || 2.0;
  $: herdCount = parseInt(herdCountValue) || 10;
  $: herdMotionRadius = parseFloat(herdMotionRadiusValue) || 5;
  $: herdMotionSpeed = parseFloat(herdMotionSpeedValue) || 1.0;
  $: orbitRadius = parseFloat(orbitRadiusValue) || 50;
  $: orbitSpeed = parseFloat(orbitSpeedValue) || 2;
  $: followOffsetX = parseFloat(followOffsetXValue) || 0;
  $: followOffsetY = parseFloat(followOffsetYValue) || -10;
  $: followOffsetZ = parseFloat(followOffsetZValue) || 0;
  $: followSpeed = parseFloat(followSpeedValue) || 2;

  afterUpdate(() => {
    if (roamingSpeed !== lastPropSpeed) {
      roamingSpeedValue = roamingSpeed.toString();
      lastPropSpeed = roamingSpeed;
    }
  });

  // Sync roaming area bounds from store
  $: if ($roamingAreaBounds) {
    areaBounds = $roamingAreaBounds;
    roamingArea = $roamingAreaBounds;
  }

  // Sync path waypoints from store
  $: if ($pathWaypoints.length > 0) {
    localWaypoints = [...$pathWaypoints];
  }

  // Emit behavior changes upward
  $: {
    if (selectedType === 'none') {
      behavior = null;
      isRoamingEnabled = false;
    } else if (selectedType === 'roam' && areaBounds) {
      behavior = { type: 'roam', area: areaBounds, speed: roamingSpeed };
      isRoamingEnabled = true;
      roamingArea = areaBounds;
    } else if (selectedType === 'path' && localWaypoints.length >= 2) {
      behavior = {
        type: 'path',
        waypoints: localWaypoints,
        speed: pathSpeed,
        loop: pathLoop,
        clampToGround: pathClampToGround,
      };
      isRoamingEnabled = false;
    } else if (selectedType === 'orbit' && orbitTargetModelId) {
      behavior = {
        type: 'orbit',
        targetModelId: orbitTargetModelId,
        radius: orbitRadius,
        speed: orbitSpeed,
        axis: orbitAxis,
      };
      isRoamingEnabled = false;
    } else if (selectedType === 'follow' && followTargetModelId) {
      behavior = {
        type: 'follow',
        targetModelId: followTargetModelId,
        offset: { x: followOffsetX, y: followOffsetY, z: followOffsetZ },
        speed: followSpeed,
      };
      isRoamingEnabled = false;
    } else if (selectedType === 'herd') {
      const canvasBehavior = herdCanvasType === 'roam' && areaBounds
        ? { type: 'roam' as const, area: areaBounds, speed: roamingSpeed }
        : localWaypoints.length >= 2
          ? { type: 'path' as const, waypoints: localWaypoints, speed: pathSpeed, loop: pathLoop, clampToGround: true }
          : null;
      if (canvasBehavior) {
        behavior = {
          type: 'herd',
          count: herdCount,
          members: generateHerdMembers(herdCount, herdMotionPattern, herdMotionRadius, herdMotionSpeed),
          motionPattern: herdMotionPattern,
          motionRadius: herdMotionRadius,
          motionSpeed: herdMotionSpeed,
          canvas: canvasBehavior,
        };
      }
      isRoamingEnabled = false;
    }
  }

  function generateHerdMembers(
    count: number,
    pattern: 'circle' | 'figure8' | 'wander' | 'fixed',
    radius: number,
    speed: number,
  ) {
    const members = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const spread = radius * 2;
      members.push({
        id: `herd_member_${i}`,
        localOffset: {
          x: (Math.random() - 0.5) * spread,
          y: (Math.random() - 0.5) * spread,
        },
        localMotion: pattern === 'fixed'
          ? { type: 'fixed' as const }
          : { type: pattern, radius, width: radius, speed },
        scale: 0.8 + Math.random() * 0.4,
        phaseOffset: Math.random() * Math.PI * 2,
      });
    }
    return members;
  }

  function selectType(type: BehaviorType) {
    if (selectedType === type) return;
    selectedType = type;
    if (type === 'none') {
      behavior = null;
      isRoamingEnabled = false;
    }
  }

  // ─── Roaming Area Paint ──────────────────────────────

  function startPaintingArea() {
    isPaintingArea = true;
    isRoamingAreaMode.set(true);
    roamingPaintSignal.update(n => n + 1);
  }

  function confirmArea() {
    if (areaBounds) {
      roamingAreaBounds.set(areaBounds);
      roamingArea = areaBounds;
    }
    isPaintingArea = false;
    isRoamingAreaMode.set(false);
  }

  function cancelPaintingArea() {
    roamingCancelSignal.update(n => n + 1);
    isPaintingArea = false;
    isRoamingAreaMode.set(false);
  }

  function clearArea() {
    areaBounds = null;
    roamingAreaBounds.set(null);
    roamingArea = null;
    roamingClearSignal.update(n => n + 1);
  }

  function handlePaintAreaClick() {
    if (isPaintingArea) confirmArea();
    else startPaintingArea();
  }

  // ─── Path Drawing ────────────────────────────────────

  function startDrawingPath() {
    isDrawingPath = true;
    isPathDrawingMode.set(true);
    pathPaintSignal.update(n => n + 1);
  }

  function confirmPath() {
    isDrawingPath = false;
    isPathDrawingMode.set(false);
  }

  function cancelDrawingPath() {
    pathCancelSignal.update(n => n + 1);
    isDrawingPath = false;
    isPathDrawingMode.set(false);
    localWaypoints = [];
  }

  function clearPath() {
    pathClearSignal.update(n => n + 1);
    localWaypoints = [];
    pathWaypoints.set([]);
  }

  function handleDrawPathClick() {
    if (isDrawingPath) confirmPath();
    else startDrawingPath();
  }
</script>

<div class="behavior-section">
  <!-- Behavior type picker (row 1) -->
  <div class="type-picker">
    <button class="type-btn" class:active={selectedType === 'none'} on:click={() => selectType('none')}>None</button>
    <button class="type-btn" class:active={selectedType === 'roam'} on:click={() => selectType('roam')}>Roam</button>
    <button class="type-btn" class:active={selectedType === 'path'} on:click={() => selectType('path')}>Path</button>
  </div>
  <!-- Behavior type picker (row 2) -->
  <div class="type-picker">
    <button class="type-btn" class:active={selectedType === 'orbit'} on:click={() => selectType('orbit')}>Orbit</button>
    <button class="type-btn" class:active={selectedType === 'follow'} on:click={() => selectType('follow')}>Follow</button>
    <button class="type-btn" class:active={selectedType === 'herd'} on:click={() => selectType('herd')}>Herd</button>
  </div>

  <!-- ═══ ROAM ═══ -->
  {#if selectedType === 'roam'}
    <div class="behavior-body">
      <p class="behavior-hint">Paint a rectangle on the map. The model will wander randomly inside it.</p>

      <div class="area-controls">
        <GlassmorphismButton variant="primary" size="small" onClick={handlePaintAreaClick}>
          {isPaintingArea ? 'Confirm Area' : 'Paint Area'}
        </GlassmorphismButton>
        {#if isPaintingArea}
          <GlassmorphismButton variant="secondary" size="small" onClick={cancelPaintingArea}>Cancel</GlassmorphismButton>
        {/if}
        {#if areaBounds && !isPaintingArea}
          <GlassmorphismButton variant="secondary" size="small" onClick={clearArea}>Clear</GlassmorphismButton>
        {/if}
      </div>

      {#if areaBounds && !isPaintingArea}
        <div class="bounds-grid">
          <span>N {areaBounds.north.toFixed(4)}</span>
          <span>S {areaBounds.south.toFixed(4)}</span>
          <span>E {areaBounds.east.toFixed(4)}</span>
          <span>W {areaBounds.west.toFixed(4)}</span>
        </div>
      {/if}

      {#if isPaintingArea}
        <div class="painting-hint">Click two points on the map to define the area.</div>
      {/if}

      <FormInput type="number" bind:value={roamingSpeedValue} label="Speed (m/s)" min="0.1" max="20" step="0.1" />
    </div>
  {/if}

  <!-- ═══ PATH ═══ -->
  {#if selectedType === 'path'}
    <div class="behavior-body">
      <p class="behavior-hint">Click points on the map to draw a path. The model follows the waypoints.</p>

      <div class="area-controls">
        <GlassmorphismButton variant="primary" size="small" onClick={handleDrawPathClick}>
          {isDrawingPath ? 'Done' : 'Draw Path'}
        </GlassmorphismButton>
        {#if isDrawingPath}
          <GlassmorphismButton variant="secondary" size="small" onClick={cancelDrawingPath}>Cancel</GlassmorphismButton>
        {/if}
        {#if localWaypoints.length > 0 && !isDrawingPath}
          <GlassmorphismButton variant="secondary" size="small" onClick={clearPath}>Clear</GlassmorphismButton>
        {/if}
      </div>

      {#if isDrawingPath}
        <div class="painting-hint">Click on the map to add waypoints. Click Done when finished.</div>
      {/if}

      {#if localWaypoints.length > 0}
        <div class="waypoint-count">{localWaypoints.length} waypoint{localWaypoints.length === 1 ? '' : 's'}</div>
      {/if}

      <FormInput type="number" bind:value={pathSpeedValue} label="Speed (m/s)" min="0.1" max="50" step="0.1" />

      <label class="checkbox-option">
        <input type="checkbox" bind:checked={pathLoop} />
        <span>Loop path</span>
      </label>

      <label class="checkbox-option">
        <input type="checkbox" bind:checked={pathClampToGround} />
        <span>Clamp to ground</span>
      </label>
    </div>
  {/if}

  <!-- ═══ ORBIT ═══ -->
  {#if selectedType === 'orbit'}
    <div class="behavior-body">
      <p class="behavior-hint">The model orbits around another model at a set radius and speed.</p>

      <div class="form-group">
        <div class="form-label" id="orbit-target-label">Target Model</div>
        {#if targetModels.length === 0}
          <div class="painting-hint">No other models on the map. Add a model first, then set this one to orbit it.</div>
        {:else}
          <select class="app-select" bind:value={orbitTargetModelId} aria-labelledby="orbit-target-label">
            <option value="">Select a model…</option>
            {#each targetModels as m}
              <option value={m.id}>{m.name}</option>
            {/each}
          </select>
        {/if}
      </div>

      <FormInput type="number" bind:value={orbitRadiusValue} label="Radius (m)" min="1" max="10000" step="1" />
      <FormInput type="number" bind:value={orbitSpeedValue} label="Speed (m/s)" min="0.1" max="100" step="0.1" />

      <div class="form-group">
        <div class="form-label" id="orbit-axis-label">Orbit Axis</div>
        <div class="type-picker compact" role="group" aria-labelledby="orbit-axis-label">
          <button class="type-btn" class:active={orbitAxis === 'y'} on:click={() => orbitAxis = 'y'}>Y (up)</button>
          <button class="type-btn" class:active={orbitAxis === 'x'} on:click={() => orbitAxis = 'x'}>X</button>
          <button class="type-btn" class:active={orbitAxis === 'z'} on:click={() => orbitAxis = 'z'}>Z</button>
        </div>
      </div>
    </div>
  {/if}

  <!-- ═══ FOLLOW ═══ -->
  {#if selectedType === 'follow'}
    <div class="behavior-body">
      <p class="behavior-hint">The model follows another model at a fixed offset, smoothly catching up.</p>

      <div class="form-group">
        <div class="form-label" id="follow-target-label">Target Model</div>
        {#if targetModels.length === 0}
          <div class="painting-hint">No other models on the map. Add a model first, then set this one to follow it.</div>
        {:else}
          <select class="app-select" bind:value={followTargetModelId} aria-labelledby="follow-target-label">
            <option value="">Select a model…</option>
            {#each targetModels as m}
              <option value={m.id}>{m.name}</option>
            {/each}
          </select>
        {/if}
      </div>

      <FormInput type="number" bind:value={followOffsetXValue} label="Offset X (m)" min="-500" max="500" step="1" />
      <FormInput type="number" bind:value={followOffsetYValue} label="Offset Y (m)" min="-500" max="500" step="1" />
      <FormInput type="number" bind:value={followOffsetZValue} label="Offset Z (m)" min="-500" max="500" step="1" />
      <FormInput type="number" bind:value={followSpeedValue} label="Speed (m/s)" min="0.1" max="100" step="0.1" />
    </div>
  {/if}

  <!-- ═══ HERD ═══ -->
  {#if selectedType === 'herd'}
    <div class="behavior-body">
      <p class="behavior-hint">Create a herd that moves as one group. Set count and motion pattern.</p>

      <FormInput type="number" bind:value={herdCountValue} label="Herd Size" min="2" max="200" step="1" />

      <div class="form-group">
        <div class="form-label" id="motion-pattern-label">Motion Pattern</div>
        <div class="type-picker compact" role="group" aria-labelledby="motion-pattern-label">
          <button class="type-btn" class:active={herdMotionPattern === 'wander'} on:click={() => herdMotionPattern = 'wander'}>Wander</button>
          <button class="type-btn" class:active={herdMotionPattern === 'circle'} on:click={() => herdMotionPattern = 'circle'}>Circle</button>
          <button class="type-btn" class:active={herdMotionPattern === 'figure8'} on:click={() => herdMotionPattern = 'figure8'}>Figure 8</button>
          <button class="type-btn" class:active={herdMotionPattern === 'fixed'} on:click={() => herdMotionPattern = 'fixed'}>Fixed</button>
        </div>
      </div>

      {#if herdMotionPattern !== 'fixed'}
        <FormInput type="number" bind:value={herdMotionRadiusValue} label="Motion Radius (m)" min="1" max="50" step="1" />
        <FormInput type="number" bind:value={herdMotionSpeedValue} label="Motion Speed" min="0.1" max="5" step="0.1" />
      {/if}

      <div class="form-group">
        <div class="form-label" id="herd-movement-label">Herd Movement</div>
        <div class="type-picker compact" role="group" aria-labelledby="herd-movement-label">
          <button class="type-btn" class:active={herdCanvasType === 'roam'} on:click={() => herdCanvasType = 'roam'}>Roam Area</button>
          <button class="type-btn" class:active={herdCanvasType === 'path'} on:click={() => herdCanvasType = 'path'}>Follow Path</button>
        </div>
      </div>

      {#if herdCanvasType === 'roam'}
        <div class="area-controls">
          <GlassmorphismButton variant="primary" size="small" onClick={handlePaintAreaClick}>
            {isPaintingArea ? 'Confirm Area' : 'Paint Area'}
          </GlassmorphismButton>
          {#if isPaintingArea}
            <GlassmorphismButton variant="secondary" size="small" onClick={cancelPaintingArea}>Cancel</GlassmorphismButton>
          {/if}
          {#if areaBounds && !isPaintingArea}
            <GlassmorphismButton variant="secondary" size="small" onClick={clearArea}>Clear</GlassmorphismButton>
          {/if}
        </div>
        {#if isPaintingArea}
          <div class="painting-hint">Click two points to paint the roaming area.</div>
        {/if}
        <FormInput type="number" bind:value={roamingSpeedValue} label="Herd Speed (m/s)" min="0.1" max="20" step="0.1" />
      {:else}
        <div class="area-controls">
          <GlassmorphismButton variant="primary" size="small" onClick={handleDrawPathClick}>
            {isDrawingPath ? 'Done' : 'Draw Path'}
          </GlassmorphismButton>
          {#if isDrawingPath}
            <GlassmorphismButton variant="secondary" size="small" onClick={cancelDrawingPath}>Cancel</GlassmorphismButton>
          {/if}
          {#if localWaypoints.length > 0 && !isDrawingPath}
            <GlassmorphismButton variant="secondary" size="small" onClick={clearPath}>Clear</GlassmorphismButton>
          {/if}
        </div>
        {#if isDrawingPath}
          <div class="painting-hint">Click on the map to add waypoints.</div>
        {/if}
        {#if localWaypoints.length > 0}
          <div class="waypoint-count">{localWaypoints.length} waypoint{localWaypoints.length === 1 ? '' : 's'}</div>
        {/if}
        <FormInput type="number" bind:value={pathSpeedValue} label="Herd Speed (m/s)" min="0.1" max="50" step="0.1" />
        <label class="checkbox-option">
          <input type="checkbox" bind:checked={pathLoop} />
          <span>Loop path</span>
        </label>
      {/if}
    </div>
  {/if}
</div>

<style>
  .behavior-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .type-picker {
    display: flex;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    padding: 3px;
    gap: 2px;
  }

  .type-picker.compact {
    margin-bottom: 8px;
  }

  .type-btn {
    flex: 1;
    padding: 8px 0;
    text-align: center;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.82rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: inherit;
    -webkit-tap-highlight-color: transparent;
  }

  .type-btn.active {
    background: rgba(74, 222, 128, 0.15);
    color: #4ade80;
    font-weight: 600;
  }

  .type-btn:not(.active):hover {
    color: rgba(255, 255, 255, 0.7);
  }

  .behavior-body {
    padding: 4px 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .behavior-hint {
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.78rem;
    line-height: 1.4;
    margin: 0;
  }

  .area-controls {
    display: flex;
    gap: 8px;
  }

  .bounds-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 8px;
    font-family: monospace;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.6);
  }

  .painting-hint {
    background: rgba(74, 222, 128, 0.1);
    border: 1px solid rgba(74, 222, 128, 0.25);
    border-radius: 8px;
    padding: 8px 10px;
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.8rem;
  }

  .waypoint-count {
    padding: 6px 10px;
    background: rgba(0, 188, 212, 0.1);
    border: 1px solid rgba(0, 188, 212, 0.25);
    border-radius: 8px;
    color: #4dd0e1;
    font-size: 0.8rem;
    font-weight: 500;
  }

  .checkbox-option {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.85rem;
  }

  .checkbox-option input[type="checkbox"] {
    margin: 0;
    accent-color: #4ade80;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-label {
    color: rgba(255, 255, 255, 0.7);
    font-weight: 500;
    font-size: 0.82rem;
  }

  .app-select {
    width: 100%;
    box-sizing: border-box;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    padding: 10px 14px;
    color: white;
    font-size: 0.85rem;
    font-family: inherit;
    cursor: pointer;
    -webkit-appearance: none;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.5)' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
  }
  .app-select:focus {
    outline: none;
    border-color: rgba(74, 222, 128, 0.5);
  }
  .app-select option {
    background: #1a1a2e;
    color: white;
  }
</style>
