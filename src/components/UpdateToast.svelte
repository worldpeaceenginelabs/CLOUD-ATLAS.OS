<script lang="ts">
  import { useRegisterSW } from 'virtual:pwa-register/svelte';

  const { needRefresh, updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_swUrl: string, registration?: ServiceWorkerRegistration) {
      if (registration) {
        setInterval(() => registration.update(), 15 * 60 * 1000);
      }
    },
  });

  function update() {
    updateServiceWorker(true);
  }

  function dismiss() {
    $needRefresh = false;
  }
</script>

{#if $needRefresh}
  <div class="update-toast" role="alert">
    <span class="update-toast-msg">A new version is available</span>
    <div class="update-toast-actions">
      <button class="update-toast-btn" on:click={update}>Update</button>
      <button class="update-toast-dismiss" on:click={dismiss}>Later</button>
    </div>
  </div>
{/if}

<style>
  .update-toast {
    position: fixed;
    bottom: 1.5rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.875rem 1.25rem;
    background: rgba(10, 10, 10, 0.92);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    color: #f0f0f0;
    font-size: 0.9rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    animation: toastSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .update-toast-msg {
    white-space: nowrap;
  }

  .update-toast-actions {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .update-toast-btn {
    padding: 0.4rem 0.9rem;
    border: none;
    border-radius: 8px;
    background: linear-gradient(-45deg, #23a6d5, #23d5ab);
    color: #000;
    font-weight: 600;
    font-size: 0.85rem;
    cursor: pointer;
    transition: opacity 0.2s;
  }
  .update-toast-btn:hover {
    opacity: 0.85;
  }

  .update-toast-dismiss {
    padding: 0.4rem 0.9rem;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    background: transparent;
    color: #aaa;
    font-size: 0.85rem;
    cursor: pointer;
    transition: color 0.2s;
  }
  .update-toast-dismiss:hover {
    color: #fff;
  }

  @keyframes toastSlideUp {
    from {
      transform: translateX(-50%) translateY(100%);
      opacity: 0;
    }
    to {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }
  }

  @media (max-width: 500px) {
    .update-toast {
      flex-direction: column;
      text-align: center;
      left: 1rem;
      right: 1rem;
      transform: none;
      animation-name: toastSlideUpMobile;
    }

    @keyframes toastSlideUpMobile {
      from {
        transform: translateY(100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
  }
</style>
