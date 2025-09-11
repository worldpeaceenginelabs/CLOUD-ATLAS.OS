<script lang="ts">
  export let type: 'text' | 'email' | 'password' | 'number' | 'url' | 'textarea' = 'text';
  export let value = '';
  export let placeholder = '';
  export let label = '';
  export let required = false;
  export let disabled = false;
  export let maxlength: number | undefined = undefined;
  export let min: string | number | undefined = undefined;
  export let max: string | number | undefined = undefined;
  export let step: string | number | undefined = undefined;
  export let rows: number | undefined = undefined;
  export let error = '';
  export let helpText = '';

  let inputElement: HTMLInputElement | HTMLTextAreaElement;

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    if (type === 'number') {
      value = (parseFloat(target.value) || 0).toString();
    } else {
      value = target.value;
    }
  }
</script>

<div class="form-group">
  {#if label}
    <label for={inputElement?.id || ''}>{label} {#if required}<span class="required">*</span>{/if}</label>
  {/if}
  
  {#if type === 'textarea'}
    <textarea
      bind:this={inputElement}
      bind:value
      {placeholder}
      {required}
      {disabled}
      {maxlength}
      {rows}
      on:input={handleInput}
      class="form-input textarea"
      class:error={error}
    ></textarea>
  {:else if type === 'number'}
    <input
      bind:this={inputElement}
      type="number"
      bind:value
      {placeholder}
      {required}
      {disabled}
      {maxlength}
      {min}
      {max}
      {step}
      on:input={handleInput}
      class="form-input"
      class:error={error}
    />
  {:else if type === 'email'}
    <input
      bind:this={inputElement}
      type="email"
      bind:value
      {placeholder}
      {required}
      {disabled}
      {maxlength}
      on:input={handleInput}
      class="form-input"
      class:error={error}
    />
  {:else if type === 'password'}
    <input
      bind:this={inputElement}
      type="password"
      bind:value
      {placeholder}
      {required}
      {disabled}
      {maxlength}
      on:input={handleInput}
      class="form-input"
      class:error={error}
    />
  {:else if type === 'url'}
    <input
      bind:this={inputElement}
      type="url"
      bind:value
      {placeholder}
      {required}
      {disabled}
      {maxlength}
      on:input={handleInput}
      class="form-input"
      class:error={error}
    />
  {:else}
    <input
      bind:this={inputElement}
      type="text"
      bind:value
      {placeholder}
      {required}
      {disabled}
      {maxlength}
      on:input={handleInput}
      class="form-input"
      class:error={error}
    />
  {/if}
  
  {#if helpText}
    <small class="help-text">{helpText}</small>
  {/if}
  
  {#if error}
    <div class="error-message">{error}</div>
  {/if}
</div>

<style>
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
  }

  .form-group label {
    color: white;
    font-weight: 500;
    font-size: 0.9em;
  }

  .required {
    color: #ff6b6b;
  }

  .form-input {
    padding: 12px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    font-size: 0.9em;
    backdrop-filter: blur(5px);
    transition: all 0.2s ease;
    font-family: inherit;
  }

  .form-input::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }

  .form-input:focus {
    outline: none;
    border-color: rgba(255, 255, 255, 0.6);
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.1);
  }

  .form-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .form-input.error {
    border-color: rgba(255, 0, 0, 0.4);
    box-shadow: 0 0 0 2px rgba(255, 0, 0, 0.1);
  }

  .textarea {
    resize: vertical;
    min-height: 80px;
  }

  .help-text {
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.8em;
    font-style: italic;
  }

  .error-message {
    color: #ff6b6b;
    font-size: 0.8em;
    margin-top: 4px;
  }

  /* Number input specific styles */
  .form-input[type="number"]::-webkit-outer-spin-button,
  .form-input[type="number"]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    appearance: none;
    margin: 0;
  }

  .form-input[type="number"] {
    -moz-appearance: textfield;
    appearance: textfield;
  }
</style>
