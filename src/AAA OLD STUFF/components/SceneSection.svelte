<script lang="ts">
  import { onMount } from 'svelte';
  import { models, scenes } from '../store';
  import { idb } from '../idb';
  import type { SceneData, SceneModelData, Interaction, ModelData } from '../types';
  import GlassmorphismButton from './GlassmorphismButton.svelte';

  let view: 'list' | 'edit' = 'list';
  let editingScene: SceneData | null = null;

  let sceneName = '';
  let sceneDescription = '';
  let sceneModels: SceneModelData[] = [];
  let sceneInteractions: Interaction[] = [];

  onMount(async () => {
    try {
      const loaded = await idb.loadScenes();
      scenes.set(loaded);
    } catch { /* IDB may not have scenes store yet */ }
  });

  function startCreate() {
    sceneName = '';
    sceneDescription = '';
    sceneModels = [];
    sceneInteractions = [];
    editingScene = null;
    view = 'edit';
  }

  function startEdit(scene: SceneData) {
    editingScene = scene;
    sceneName = scene.name;
    sceneDescription = scene.description;
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
    sceneInteractions = [...sceneInteractions, {
      id: `interaction_${Date.now()}`,
      sourceId: sceneModels[0].id,
      targetId: sceneModels[1]?.id,
      config: { type: 'proximity', radius: 50, action: { type: 'notify', message: 'Models are close!' } },
    }];
  }

  function removeInteraction(id: string) {
    sceneInteractions = sceneInteractions.filter(i => i.id !== id);
  }

  async function saveScene() {
    if (!sceneName.trim()) return;

    const origin = $models.length > 0
      ? { latitude: $models[0].coordinates.latitude, longitude: $models[0].coordinates.longitude }
      : { latitude: 0, longitude: 0 };

    const scene: SceneData = {
      id: editingScene?.id || `scene_${Date.now()}`,
      name: sceneName.trim(),
      description: sceneDescription.trim(),
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

{#if view === 'list'}
  <div class="scene-list">
    <div class="list-header">
      <span class="list-title">{$scenes.length} scene{$scenes.length !== 1 ? 's' : ''}</span>
      <GlassmorphismButton variant="primary" size="small" onClick={startCreate}>+ New</GlassmorphismButton>
    </div>

    {#if $scenes.length === 0}
      <p class="empty-hint">Compose multiple 3D models into an interactive scene.</p>
    {:else}
      {#each $scenes as scene}
        <button class="scene-card" on:click={() => startEdit(scene)}>
          <div class="scene-card-top">
            <span class="sc-name">{scene.name}</span>
            <span class="sc-meta">{scene.models.length} model{scene.models.length !== 1 ? 's' : ''}</span>
          </div>
          {#if scene.description}
            <p class="sc-desc">{scene.description}</p>
          {/if}
          <div class="scene-card-bottom">
            <span class="sc-date">{new Date(scene.timestamp).toLocaleDateString()}</span>
            <button class="sc-delete" on:click|stopPropagation={() => deleteScene(scene.id)} aria-label="Delete scene">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
          </div>
        </button>
      {/each}
    {/if}
  </div>
{:else}
  <div class="scene-editor">
    <div class="editor-header">
      <button class="back-btn" on:click={backToList} aria-label="Back to list">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
      </button>
      <span class="editor-title">{editingScene ? 'Edit' : 'New'} Scene</span>
      <GlassmorphismButton variant="primary" size="small" onClick={saveScene}>Save</GlassmorphismButton>
    </div>

    <input class="scene-input" type="text" bind:value={sceneName} placeholder="Scene name" />
    <textarea class="scene-input textarea" bind:value={sceneDescription} placeholder="Description (optional)" rows="2"></textarea>

    <div class="sub-label">In Scene ({sceneModels.length})</div>
    {#each sceneModels as sm}
      <div class="model-chip">
        <span class="chip-name">{sm.name}</span>
        {#if sm.behavior}
          <span class="chip-tag">{sm.behavior.type}</span>
        {/if}
        <button class="chip-x" on:click={() => removeModelFromScene(sm.id)} aria-label="Remove">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
    {/each}

    {#if availableModels.length > 0}
      <div class="sub-label">Add Models</div>
      {#each availableModels as m}
        <button class="model-chip add" on:click={() => addModelToScene(m)}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 5v14M5 12h14"/></svg>
          <span class="chip-name">{m.name}</span>
        </button>
      {/each}
    {/if}

    <div class="sub-label">Interactions ({sceneInteractions.length})</div>
    {#if sceneModels.length < 2}
      <p class="empty-hint">Add 2+ models to define interactions.</p>
    {:else}
      <GlassmorphismButton variant="secondary" size="small" onClick={addProximityInteraction}>+ Proximity</GlassmorphismButton>
    {/if}

    {#each sceneInteractions as interaction}
      <div class="interaction-row">
        <span class="int-type">{interaction.config.type}</span>
        <span class="int-detail">
          {sceneModels.find(m => m.id === interaction.sourceId)?.name || '?'}
          &rarr;
          {sceneModels.find(m => m.id === interaction.targetId)?.name || '?'}
        </span>
        <button class="chip-x" on:click={() => removeInteraction(interaction.id)} aria-label="Remove">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .list-header, .editor-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }

  .list-title {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.5);
    font-weight: 500;
  }

  .editor-title {
    flex: 1;
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.8);
    font-weight: 600;
  }

  .back-btn {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.7);
    padding: 5px 7px;
    cursor: pointer;
    display: flex;
    transition: background 0.15s;
  }
  .back-btn:hover { background: rgba(255, 255, 255, 0.12); color: white; }

  .empty-hint {
    font-size: 0.78rem;
    color: rgba(255, 255, 255, 0.4);
    margin: 0 0 6px;
    line-height: 1.4;
  }

  .scene-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    cursor: pointer;
    color: white;
    text-align: left;
    transition: all 0.15s;
    font-family: inherit;
    margin-bottom: 6px;
  }
  .scene-card:hover { background: rgba(255, 255, 255, 0.08); border-color: rgba(255, 255, 255, 0.15); }

  .scene-card-top { display: flex; justify-content: space-between; align-items: center; }
  .sc-name { font-weight: 600; font-size: 0.85rem; }
  .sc-meta { font-size: 0.7rem; color: rgba(255, 255, 255, 0.4); }
  .sc-desc { font-size: 0.78rem; color: rgba(255, 255, 255, 0.5); margin: 0; line-height: 1.3; }
  .scene-card-bottom { display: flex; justify-content: space-between; align-items: center; }
  .sc-date { font-size: 0.68rem; color: rgba(255, 255, 255, 0.3); }

  .sc-delete {
    background: none; border: none; color: rgba(255, 255, 255, 0.3);
    cursor: pointer; padding: 3px; border-radius: 5px; display: flex; transition: all 0.15s;
  }
  .sc-delete:hover { color: #f87171; background: rgba(248, 113, 113, 0.1); }

  .scene-input {
    width: 100%;
    box-sizing: border-box;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    padding: 9px 12px;
    color: white;
    font-size: 0.82rem;
    font-family: inherit;
    transition: border-color 0.15s;
    margin-bottom: 6px;
    resize: none;
  }
  .scene-input::placeholder { color: rgba(255, 255, 255, 0.3); }
  .scene-input:focus { outline: none; border-color: rgba(74, 222, 128, 0.5); }

  .sub-label {
    font-size: 0.72rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.45);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 10px 0 6px;
  }

  .model-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    font-size: 0.8rem;
    margin-bottom: 4px;
    color: white;
  }
  .model-chip.add {
    cursor: pointer;
    border: 1px dashed rgba(74, 222, 128, 0.3);
    background: rgba(74, 222, 128, 0.03);
    color: rgba(255, 255, 255, 0.65);
    transition: all 0.15s;
    font-family: inherit;
    width: 100%;
    text-align: left;
  }
  .model-chip.add:hover { background: rgba(74, 222, 128, 0.08); border-color: rgba(74, 222, 128, 0.5); }

  .chip-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .chip-tag {
    font-size: 0.65rem; padding: 1px 5px; border-radius: 4px;
    background: rgba(74, 222, 128, 0.12); color: #4ade80;
    font-weight: 600; text-transform: uppercase;
  }
  .chip-x {
    background: none; border: none; color: rgba(255, 255, 255, 0.3);
    cursor: pointer; padding: 3px; border-radius: 5px; display: flex;
    flex-shrink: 0; transition: all 0.15s;
  }
  .chip-x:hover { color: #f87171; background: rgba(248, 113, 113, 0.1); }

  .interaction-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    background: rgba(168, 85, 247, 0.05);
    border: 1px solid rgba(168, 85, 247, 0.12);
    border-radius: 8px;
    margin-top: 4px;
    font-size: 0.78rem;
  }
  .int-type {
    font-weight: 600; color: #d8b4fe; text-transform: uppercase;
    letter-spacing: 0.3px; font-size: 0.68rem; flex-shrink: 0;
  }
  .int-detail { flex: 1; color: rgba(255, 255, 255, 0.55); }
</style>
