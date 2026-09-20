<script lang="ts">
  // hexmenu/OperatorAgreement.svelte
  // -----------------------------------------------------------------------
  // One-time operator agreement, shown the first time the person clicks a
  // gated hex (LIVE / OFFER). Owns its own chrome (.panel + CloseButton),
  // same pattern Omnipedia.svelte, SwarmGovernance.svelte and
  // Mission1.svelte each use independently — HexMenu just decides whether
  // to mount it and reacts to its events:
  //   accept — checkbox ticked and the accept button pressed
  //   close  — dismissed via the CloseButton (= not accepted)
  // -----------------------------------------------------------------------

  import { createEventDispatcher } from 'svelte';
  import CloseButton from '../shared/CloseButton.svelte';

  const dispatch = createEventDispatcher();

  let checked = false;

  function close() {
    dispatch('close');
  }

  function handleAccept() {
    if (!checked) return;
    dispatch('accept');
  }
</script>

<div class="panel">
  <CloseButton onClose={close} />

  <div class="scroll">
    <main>
      <div class="textbox">
        <p class="top-line">By checking this box, you confirm that you have read and agree to the following:</p>

        <div class="content">
          <p>You are stepping into full ownership of your digital presence. Cloud Atlas OS has no central operator — you are the operator. That means real freedom, and real responsibility.</p>
          <p>You agree to:</p>
          <ul>
            <li>Operate your instance in compliance with the laws of every country in which you use Cloud Atlas OS — including its tools, missions, matching, and listings.</li>
            <li>Accept full personal liability for your actions and any content you publish.</li>
            <li>Act with the awareness that freedom without accountability is not freedom — it's chaos.</li>
          </ul>
          <p>You understand that:</p>
          <ul>
            <li>Cloud Atlas OS is provided "as is," without warranties of any kind. It exercises no centralized control over your activity or content.</li>
            <li>Cloud Atlas OS does not track, monitor, or analyze what you do. Your privacy is structurally protected by design.</li>
            <li><strong>You are not invisible. Internet infrastructure — including your own ISP — remains subject to lawful authority. Unlawful activity can and will be traceable.</strong></li>
          </ul>
          <p class="accent">In short: Same rules as any device you own. Decentralized does not mean lawless.<br>With great power, comes great responsibility.</p>
        </div>

        <div class="bottom">
          <label class="checkbox-label">
            <input type="checkbox" bind:checked />
            <span>I have read and agree to the above.</span>
          </label>
          <button
            class="accept-btn"
            disabled={!checked}
            on:click={handleAccept}
          >Enter as Operator – I accept full responsibility</button>
        </div>
      </div>
    </main>
  </div>
</div>

<style>
  .panel {
    position: fixed;
    top: 50%;
    left: 4vw;
    transform: translateY(-50%);

    width: min(640px, 44vw);
    max-height: 88vh;
    box-sizing: border-box;

    /* Column: only .scroll scrolls, the CloseButton stays put. */
    display: flex;
    flex-direction: column;
    overflow: hidden;

    background: var(--accent-stripe), var(--glass-bg);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border: var(--glass-border);
    border-radius: var(--glass-radius);

    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);

    z-index: 9999;
  }

  @media (max-width: 700px) {
    .panel {
    position: fixed;
    inset: 0;

    width: 100%;
    height: 100dvh;
    max-height: none;

    transform: none;

    border-radius: var(--glass-radius);

    overflow: hidden;
    box-sizing: border-box;
    }
  }

  /* Only this area scrolls — the CloseButton (child of .panel) stays put. */
  .scroll {
    flex: 1 1 auto;
    min-height: 0; /* required, otherwise a flex child cannot scroll */
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: contain;
    padding: 2.5rem 1.5rem 1.5rem;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.28) transparent;
  }

  .scroll::-webkit-scrollbar {
    width: 6px;
  }

  .scroll::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.28);
    border-radius: 3px;
  }

  main {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    color: white;
    padding: 0%;
    margin: 0%;
    text-decoration: none;
  }

  /* No padding of its own anymore — .panel provides the frame. */
  .textbox {
    line-height: 1.65;
    color: rgba(255, 255, 255, 0.85);
    font-size: 14px;
    word-wrap: break-word;
    max-width: 100%;
    box-sizing: border-box;
  }

  .top-line {
    color: #ffd700;
    font-weight: 700;
    font-size: 15px;
    margin: 0 0 14px;
  }

  .content {
    margin-bottom: 20px;
    text-align: left;
  }

  .textbox p {
    margin: 0 0 14px;
  }

  .textbox ul {
    padding-left: 20px;
    margin: 8px 0 14px;
  }

  .textbox li {
    margin-bottom: 4px;
  }

  .accent {
    color: #ffd700;
    font-weight: 700;
    font-size: 15px;
    text-align: center;
    margin: 2px 0 14px;
  }

  .bottom {
    border-top: 1px solid rgba(255, 215, 0, 0.15);
    padding-top: 20px;
    margin-top: 8px;
  }

  .checkbox-label {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    cursor: pointer;
    margin-bottom: 16px;
    color: rgba(255, 255, 255, 0.9);
    font-size: 14px;
  }

  .checkbox-label input {
    margin-top: 3px;
    flex-shrink: 0;
  }

  .accept-btn {
    display: block;
    width: 100%;
    padding: 14px 20px;
    font-size: 15px;
    font-weight: 700;
    color: #17181b;
    background: #ffd700;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    transition: opacity 0.2s, background 0.2s;
  }

  .accept-btn:hover:not(:disabled) {
    background: #ffe44d;
  }

  .accept-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 600px) {
    .textbox {
      font-size: 13px;
    }

    .top-line {
      font-size: 14px;
    }
  }

  @media (max-width: 400px) {
    .textbox {
      font-size: 12.5px;
      line-height: 1.55;
    }
  }
</style>
