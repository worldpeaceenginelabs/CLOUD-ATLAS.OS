<script lang="ts">
  import { createEventDispatcher } from 'svelte';


  // A plain create-form for a Swarm Governance mission. No edit/view
  // toggle, no author/permission checks, no publish-then-unlock state
  // machine, no backend wiring — this component's only job right now
  // is to collect the mission's fields and dispatch them on submit.
  //
  // This same component is meant to double later as a read-only
  // Mission-Details view when a mission entity is clicked on the map.
  // That wiring (and whatever "existing mission" hydration it needs)
  // is deliberately not built yet — see the task this came from.

  const dispatch = createEventDispatcher();

  type LaneId = 'brainstorming' | 'meetanddo' | 'petition' | 'crowdfunding';

  const LANES: { id: LaneId; label: string; placeholder: string; required?: true }[] = [
    { id: 'brainstorming', label: 'Brainstorm', placeholder: 'https://… (required)', required: true },
    { id: 'meetanddo', label: 'Meet & do', placeholder: 'https://…' },
    { id: 'petition', label: 'Petition', placeholder: 'https://…' },
    { id: 'crowdfunding', label: 'Fund', placeholder: 'https://…' },
  ];

  let title = '';
  let description = '';
  let links: Record<LaneId, string> = {
    brainstorming: '',
    meetanddo: '',
    petition: '',
    crowdfunding: '',
  };

  let location = '';

  function handleLocationSelected(lat: string, lon: string, displayName?: string) {
    locationLat = lat;
    locationLon = lon;
    if (displayName) locationAddress = displayName;
  }

  $: formValid =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    links.brainstorming.trim().length > 0 &&
    locationLat.trim().length > 0 &&
    locationLon.trim().length > 0;

  function handleSubmit() {
    if (!formValid) return;
    dispatch('submit', {
      title: title.trim(),
      description: description.trim(),
      location: location || undefined,
      links: {
        brainstorming: links.brainstorming.trim(),
        meetanddo: links.meetanddo.trim(),
        petition: links.petition.trim(),
        crowdfunding: links.crowdfunding.trim(),
      },
    });
  }
</script>

<form class="mf" on:submit|preventDefault={handleSubmit}>
  <h2 class="mf-heading">Swarm Governance</h2>

  <label class="mf-label" for="mf-title">Title</label>
  <input
    id="mf-title"
    class="mf-input"
    type="text"
    maxlength="200"
    placeholder="Mission title"
    bind:value={title}
  />

  <label class="mf-label" for="mf-description">Description</label>
  <textarea
    id="mf-description"
    class="mf-textarea"
    rows="5"
    maxlength="2000"
    placeholder="What is this mission about?"
    bind:value={description}
  ></textarea>

  <div class="mf-lanes">
    {#each LANES as lane (lane.id)}
      <div class="mf-lane">
        <label class="mf-label" for="mf-lane-{lane.id}">
          {lane.label}{lane.required ? ' *' : ''}
        </label>
        <input
          id="mf-lane-{lane.id}"
          class="mf-input"
          type="url"
          inputmode="url"
          placeholder={lane.placeholder}
          bind:value={links[lane.id]}
        />
      </div>
    {/each}
  </div>

  <span class="mf-label">Location *</span>


  <button type="submit" class="mf-submit" disabled={!formValid}>
    Submit mission
  </button>
</form>

<style>
  .mf {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    color: #eee;
    font-family: inherit;
  }

  .mf-heading {
    margin: 0 0 0.75rem;
    font-size: 1.1rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #fff;
  }

  .mf-label {
    margin-top: 0.75rem;
    font-size: 0.75rem;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.6);
  }

  .mf-input,
  .mf-textarea {
    box-sizing: border-box;
    width: 100%;
    padding: 0.5rem 0.65rem;
    margin-top: 0.25rem;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    color: #fff;
    font-size: 0.9rem;
    font-family: inherit;
  }

  .mf-textarea {
    resize: vertical;
  }

  .mf-input:focus,
  .mf-textarea:focus {
    outline: none;
    border-color: #7e57c2;
  }

  .mf-lanes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 0.75rem;
  }

  .mf-lane {
    display: flex;
    flex-direction: column;
  }

  .mf-submit {
    margin-top: 1.5rem;
    padding: 0.65rem 1rem;
    background: #7e57c2;
    border: none;
    border-radius: 8px;
    color: #fff;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
  }

  .mf-submit:disabled {
    background: rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.4);
    cursor: not-allowed;
  }

  @media (max-width: 480px) {
    .mf-lanes {
      grid-template-columns: 1fr;
    }
  }
</style>
