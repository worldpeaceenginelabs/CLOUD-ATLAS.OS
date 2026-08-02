<script>
    import { createEventDispatcher } from 'svelte';
  
    // schema: one entry from formSchema.ts, or null/undefined if this
    // model has no schema yet (see the 'vehicle_ride_sharing' gap note
    // there) — Details renders a small fallback instead of guessing.
    export let schema = null;
  
    // values: the field state, lifted and owned by the parent (HexMenu),
    // same pattern as Anypay's `selected` — Details never holds its own
    // copy, it only dispatches what changed and lets the parent decide
    // what to do with it.
    export let values = {};
  
    const dispatch = createEventDispatcher();
  
    const MODE_OPTIONS = [
      { id: 'in_person', label: 'In-Person' },
      { id: 'online', label: 'Online' },
      { id: 'both', label: 'Both' },
    ];
  
    function set(key, value) {
      dispatch('update', { key, value });
    }
  
    function pickCategory(id) {
      if (schema.category.multi) {
        const cur = values.categoryIds || [];
        const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id];
        set('categoryIds', next);
      } else {
        set('categoryId', id);
      }
    }
  
    function isCategorySelected(id) {
      return schema.category.multi
        ? (values.categoryIds || []).includes(id)
        : values.categoryId === id;
    }
  
    function onBackdrop(e) {
      if (e.target === e.currentTarget) dispatch('close');
    }
  </script>
  
  <div class="backdrop" on:click={onBackdrop}>
    <div class="modal" role="dialog" aria-modal="true" aria-label="Details">
      <button class="close" on:click={() => dispatch('close')} aria-label="Close">✕</button>
  
      {#if !schema}
        <h2>DETAILS</h2>
        <p class="hint">No fields defined for this model yet.</p>
      {:else}
        <h2>DETAILS</h2>
        <p class="hint">Fill in what applies, then close with ✕.</p>
  
        {#if schema.modeSelector}
          <div class="mode-row">
            {#each MODE_OPTIONS as m}
              <button
                class="mode-opt"
                class:selected={(values.mode || 'in_person') === m.id}
                on:click={() => set('mode', m.id)}
              >{m.label}</button>
            {/each}
          </div>
        {/if}
  
        <label class="field-label" for="details-title">{schema.titleLabel} *</label>
        <input
          id="details-title"
          class="text-input"
          placeholder={schema.titlePlaceholder}
          value={values.title || ''}
          on:input={(e) => set('title', e.currentTarget.value)}
        />
  
        <span class="field-label">Category *</span>
        <div class="options">
          {#each schema.category.options as opt}
            <button
              class="option"
              class:selected={isCategorySelected(opt.id)}
              on:click={() => pickCategory(opt.id)}
            >
              <span class="opt-name">{opt.name}</span>
              {#if opt.description}<span class="opt-desc">{opt.description}</span>{/if}
            </button>
          {/each}
        </div>
  
        {#if schema.date}
          <label class="field-label" for="details-date">
            {schema.date.label || 'Date & Time'}{schema.date.required ? ' *' : ''}
          </label>
          <input
            id="details-date"
            class="text-input"
            type="datetime-local"
            value={values.date || ''}
            on:input={(e) => set('date', e.currentTarget.value)}
          />
          {#if !schema.date.required}
            <p class="subtle">Optional — leave empty for recurring or open-ended.</p>
          {/if}
        {/if}
  
        <label class="field-label" for="details-description">Description *</label>
        <textarea
          id="details-description"
          class="textarea"
          placeholder={schema.descriptionPlaceholder}
          value={values.description || ''}
          on:input={(e) => set('description', e.currentTarget.value)}
        ></textarea>
  
        <label class="field-label" for="details-contact">Contact Link *</label>
        <input
          id="details-contact"
          class="text-input"
          placeholder="https://t.me/you or https://wa.me/123..."
          value={values.contact || ''}
          on:input={(e) => set('contact', e.currentTarget.value)}
        />
        <p class="subtle">{schema.contactHint}</p>
      {/if}
    </div>
  </div>
  
  <style>
    .backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 50;
      padding: 24px 0;
    }
  
    .modal {
      position: relative;
      background: #161616;
      border: 1px solid #333;
      border-radius: 14px;
      padding: 28px 24px 24px;
      width: min(360px, calc(100vw - 40px));
      max-height: calc(100vh - 48px);
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
  
    h2 {
      margin: 0 0 6px;
      color: #fff;
      font-size: 1em;
      letter-spacing: 1.5px;
      text-align: center;
    }
  
    .hint {
      margin: 0 0 18px;
      color: #888;
      font-size: 0.78em;
      text-align: center;
    }
  
    .close {
      position: absolute;
      top: 10px;
      right: 10px;
      background: none;
      border: none;
      color: #888;
      font-size: 1em;
      cursor: pointer;
      line-height: 1;
      padding: 6px;
    }
    .close:hover { color: #fff; }
  
    .mode-row {
      display: flex;
      gap: 6px;
      margin-bottom: 18px;
    }
    .mode-opt {
      flex: 1;
      border: 1.5px solid #333;
      background: #111;
      color: #aaa;
      border-radius: 8px;
      padding: 8px 4px;
      font-size: 0.78em;
      font-weight: 600;
      cursor: pointer;
    }
    .mode-opt.selected {
      background: rgba(51, 91, 244, 0.38);
      border-color: #8fb0ff;
      color: #fff;
    }
  
    .field-label {
      display: block;
      margin: 14px 0 6px;
      color: #ccc;
      font-size: 0.8em;
      font-weight: 600;
    }
  
    .text-input, .textarea {
      width: 100%;
      box-sizing: border-box;
      background: #0d0d0d;
      border: 1px solid #333;
      border-radius: 8px;
      padding: 10px 12px;
      color: #fff;
      font-size: 0.9em;
      font-family: inherit;
    }
    .text-input::placeholder, .textarea::placeholder { color: #666; }
    .textarea { min-height: 80px; resize: vertical; }
  
    .subtle {
      margin: 6px 0 0;
      color: #777;
      font-size: 0.72em;
    }
  
    .options {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
  
    .option {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
      border: 1.5px solid;
      border-image: linear-gradient(90deg, #335bf4, #2ae9c9) 1;
      background: #111;
      color: #fff;
      border-radius: 10px;
      padding: 10px 12px;
      text-align: left;
      cursor: pointer;
      transition: background 0.2s;
    }
    .option.selected {
      background: rgba(51, 91, 244, 0.38);
      border-image: none;
      border-color: #8fb0ff;
    }
    .opt-name {
      font-size: 0.9em;
      font-weight: 600;
      letter-spacing: 0.3px;
    }
    .opt-desc {
      font-size: 0.74em;
      color: #9aa4b2;
    }
  </style>