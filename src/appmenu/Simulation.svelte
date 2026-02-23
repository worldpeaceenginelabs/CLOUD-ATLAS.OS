<script lang="ts">
  import { fade } from 'svelte/transition';
  import { onMount } from 'svelte';
  import { models, scenes } from '../store';
  import { idb } from '../idb';
  import type { SceneData, SceneModelData, Interaction, ModelData } from '../types';
  import GlassmorphismButton from '../components/GlassmorphismButton.svelte';

  let view: 'list' | 'create' | 'edit' = 'list';
  let editingScene: SceneData | null = null;

  // Create form
  let newName = '';
  let newDescription = '';

  // Track which models are in the scene being edited
  let sceneModels: SceneModelData[] = [];
  let sceneInteractions: Interaction[] = [];

  onMount(async () => {
    try {
      const loaded = await idb.loadScenes();
      scenes.set(loaded);
    } catch { /* IDB may not have scenes store yet */ }
  });

  function startCreate() {
    newName = '';
    newDescription = '';
    sceneModels = [];
    sceneInteractions = [];
    editingScene = null;
    view = 'create';
  }

  function startEdit(scene: SceneData) {
    editingScene = scene;
    newName = scene.name;
    newDescription = scene.description;
    sceneModels = [...scene.models];
    sceneInteractions = [...scene.interactions];
    view = 'edit';
  }

  function backToList() {
    view = 'list';
    editingScene = null;
  }

  function addModelToScene(model: ModelData) {
    if (sceneModels.find(m => m.id === model.id)) return;
    sceneModels = [...sceneModels, {
      id: model.id,
      name: model.name,
      source: model.source,
      url: model.url,
      localPosition: { x: 0, y: 0, z: 0 },
      rotation: { heading: model.transform.heading, pitch: model.transform.pitch, roll: model.transform.roll },
      scale: model.transform.scale,
      behavior: model.behavior,
      tags: [],
    }];
  }

  function removeModelFromScene(modelId: string) {
    sceneModels = sceneModels.filter(m => m.id !== modelId);
    sceneInteractions = sceneInteractions.filter(i => i.sourceId !== modelId && i.targetId !== modelId);
  }

  function addProximityInteraction() {
    if (sceneModels.length < 2) return;
    const id = `interaction_${Date.now()}`;
    sceneInteractions = [...sceneInteractions, {
      id,
      sourceId: sceneModels[0].id,
      targetId: sceneModels[1]?.id,
      config: { type: 'proximity', radius: 50, action: { type: 'notify', message: 'Models are close!' } },
    }];
  }

  function removeInteraction(id: string) {
    sceneInteractions = sceneInteractions.filter(i => i.id !== id);
  }

  async function saveScene() {
    if (!newName.trim()) return;

    const origin = $models.length > 0
      ? { latitude: $models[0].coordinates.latitude, longitude: $models[0].coordinates.longitude }
      : { latitude: 0, longitude: 0 };

    const scene: SceneData = {
      id: editingScene?.id || `scene_${Date.now()}`,
      name: newName.trim(),
      description: newDescription.trim(),
      origin,
      models: sceneModels,
      interactions: sceneInteractions,
      timestamp: editingScene?.timestamp || new Date().toISOString(),
    };

    await idb.saveScene(scene);
    const loaded = await idb.loadScenes();
    scenes.set(loaded);
    backToList();
  }

  async function deleteScene(id: string) {
    await idb.deleteScene(id);
    const loaded = await idb.loadScenes();
    scenes.set(loaded);
  }

  $: availableModels = $models.filter(m => !sceneModels.find(sm => sm.id === m.id));
</script>

<main transition:fade={{ duration: 300 }}>
  {#if view === 'list'}
    <div class="scene-list">
      <div class="header">
        <h2>Scenes</h2>
        <GlassmorphismButton variant="primary" size="small" onClick={startCreate}>New Scene</GlassmorphismButton>
      </div>

      {#if $scenes.length === 0}
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
          <p>No scenes yet. Create one to compose multiple 3D models into an interactive experience.</p>
        </div>
      {:else}
        {#each $scenes as scene}
          <button class="scene-card" on:click={() => startEdit(scene)}>
            <div class="scene-card-top">
              <span class="scene-name">{scene.name}</span>
              <span class="scene-meta">{scene.models.length} model{scene.models.length !== 1 ? 's' : ''}</span>
            </div>
            {#if scene.description}
              <p class="scene-desc">{scene.description}</p>
            {/if}
            <div class="scene-card-bottom">
              <span class="scene-date">{new Date(scene.timestamp).toLocaleDateString()}</span>
              <button class="delete-btn" on:click|stopPropagation={() => deleteScene(scene.id)} aria-label="Delete scene">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              </button>
            </div>
          </button>
        {/each}
      {/if}
    </div>
  {:else}
    <div class="scene-editor">
      <div class="header">
        <button class="back-btn" on:click={backToList} aria-label="Back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <h2>{view === 'create' ? 'New Scene' : 'Edit Scene'}</h2>
        <GlassmorphismButton variant="primary" size="small" onClick={saveScene}>Save</GlassmorphismButton>
      </div>

      <div class="form-section">
        <input class="app-input" type="text" bind:value={newName} placeholder="Scene name" />
        <textarea class="app-input textarea" bind:value={newDescription} placeholder="Description (optional)" rows="2"></textarea>
      </div>

      <div class="section-label">Models in Scene ({sceneModels.length})</div>
      {#if sceneModels.length === 0}
        <p class="hint">Add models from your existing 3D models below.</p>
      {/if}
      <div class="model-list">
        {#each sceneModels as sm}
          <div class="model-chip">
            <span class="model-chip-name">{sm.name}</span>
            {#if sm.behavior}
              <span class="model-chip-tag">{sm.behavior.type}</span>
            {/if}
            <button class="chip-remove" on:click={() => removeModelFromScene(sm.id)} aria-label="Remove from scene">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        {/each}
      </div>

      {#if availableModels.length > 0}
        <div class="section-label">Available Models</div>
        <div class="model-list">
          {#each availableModels as m}
            <button class="model-chip add" on:click={() => addModelToScene(m)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
              <span class="model-chip-name">{m.name}</span>
            </button>
          {/each}
        </div>
      {/if}

      <div class="section-label">Interactions ({sceneInteractions.length})</div>
      {#if sceneModels.length < 2}
        <p class="hint">Add at least 2 models to create interactions between them.</p>
      {:else}
        <GlassmorphismButton variant="secondary" size="small" onClick={addProximityInteraction}>
          + Proximity Trigger
        </GlassmorphismButton>
      {/if}

      {#each sceneInteractions as interaction}
        <div class="interaction-card">
          <div class="interaction-top">
            <span class="interaction-type">{interaction.config.type}</span>
            <button class="chip-remove" on:click={() => removeInteraction(interaction.id)} aria-label="Remove interaction">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div class="interaction-detail">
            {sceneModels.find(m => m.id === interaction.sourceId)?.name || '?'}
            &rarr;
            {sceneModels.find(m => m.id === interaction.targetId)?.name || '?'}
          </div>
          {#if interaction.config.type === 'proximity'}
            <div class="interaction-detail">Radius: {interaction.config.radius}m</div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</main>

<style>
  main {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: white;
    padding: 20px;
    max-width: 540px;
    margin: 0 auto;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 20px;
  }

  .header h2 {
    margin: 0;
    font-size: 1.3rem;
    font-weight: 600;
    flex: 1;
  }

  .back-btn {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    color: white;
    padding: 6px 8px;
    cursor: pointer;
    display: flex;
    transition: background 0.15s;
  }
  .back-btn:hover { background: rgba(255, 255, 255, 0.15); }

  .empty-state {
    text-align: center;
    padding: 40px 20px;
    color: rgba(255, 255, 255, 0.5);
  }
  .empty-state svg {
    margin-bottom: 16px;
    opacity: 0.4;
  }
  .empty-state p {
    font-size: 0.9rem;
    line-height: 1.5;
    max-width: 300px;
    margin: 0 auto;
  }

  .scene-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
    padding: 14px 16px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    cursor: pointer;
    color: white;
    text-align: left;
    transition: all 0.15s;
    font-family: inherit;
    margin-bottom: 8px;
  }
  .scene-card:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .scene-card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .scene-name {
    font-weight: 600;
    font-size: 0.95rem;
  }
  .scene-meta {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.4);
  }
  .scene-desc {
    font-size: 0.82rem;
    color: rgba(255, 255, 255, 0.55);
    margin: 0;
    line-height: 1.4;
  }
  .scene-card-bottom {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .scene-date {
    font-size: 0.72rem;
    color: rgba(255, 255, 255, 0.3);
  }

  .delete-btn {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.3);
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
    display: flex;
    transition: all 0.15s;
  }
  .delete-btn:hover {
    color: #f87171;
    background: rgba(248, 113, 113, 0.1);
  }

  .form-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 20px;
  }

  .app-input {
    width: 100%;
    box-sizing: border-box;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    padding: 11px 14px;
    color: white;
    font-size: 0.88rem;
    font-family: inherit;
    transition: border-color 0.15s;
    resize: none;
  }
  .app-input::placeholder { color: rgba(255, 255, 255, 0.3); }
  .app-input:focus { outline: none; border-color: rgba(74, 222, 128, 0.5); }

  .section-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 16px 0 8px;
  }

  .hint {
    font-size: 0.82rem;
    color: rgba(255, 255, 255, 0.4);
    margin: 0 0 8px;
    line-height: 1.4;
  }

  .model-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .model-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    font-size: 0.85rem;
  }
  .model-chip.add {
    cursor: pointer;
    border: 1px dashed rgba(74, 222, 128, 0.3);
    background: rgba(74, 222, 128, 0.04);
    color: rgba(255, 255, 255, 0.7);
    transition: all 0.15s;
    font-family: inherit;
  }
  .model-chip.add:hover {
    background: rgba(74, 222, 128, 0.1);
    border-color: rgba(74, 222, 128, 0.5);
  }

  .model-chip-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .model-chip-tag {
    font-size: 0.7rem;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(74, 222, 128, 0.15);
    color: #4ade80;
    font-weight: 600;
    text-transform: uppercase;
  }

  .chip-remove {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.35);
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
    display: flex;
    transition: all 0.15s;
    flex-shrink: 0;
  }
  .chip-remove:hover {
    color: #f87171;
    background: rgba(248, 113, 113, 0.1);
  }

  .interaction-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 14px;
    background: rgba(168, 85, 247, 0.06);
    border: 1px solid rgba(168, 85, 247, 0.15);
    border-radius: 10px;
    margin-top: 8px;
  }

  .interaction-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .interaction-type {
    font-size: 0.78rem;
    font-weight: 600;
    color: #d8b4fe;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .interaction-detail {
    font-size: 0.82rem;
    color: rgba(255, 255, 255, 0.6);
  }
</style>
