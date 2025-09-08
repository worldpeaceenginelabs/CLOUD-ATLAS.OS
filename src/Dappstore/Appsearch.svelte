<script>
    import { fade } from 'svelte/transition';
    import VirtualList from './VirtualList.svelte';
    import ListItem from './ListItem.svelte';
    import items from './data.ts';
    import { clickOutside } from "./click_outside.ts";

    let searchTerm = "";

    $: filteredList = items.filter(item => item.title.toLowerCase().indexOf(searchTerm.toLowerCase()) !== -1).sort((a, b) => a.title.localeCompare(b.title));

    let isFocused = false;

    let start;
    let end;
</script>

<div class="searchcontainer">
    <input
        class="searchfield"
        placeholder="dAppStore"
        bind:value={searchTerm}
        on:focus={() => isFocused = true}
        use:clickOutside
        on:outclick={() => (isFocused = false)}
    />
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; color: #abd6ff; padding: 0px; margin: 0px; text-decoration: none;">
        Home Screen</div>
</div>

{#if isFocused}
    <div class='container' transition:fade={{ duration: 500 }}>
        <VirtualList items={filteredList} bind:start bind:end let:item>
            <ListItem {...item} />
        </VirtualList>
    </div>
{/if}

<style>
    .searchcontainer {
        position: relative;
        text-align: center;
    }

    .searchfield {
        border: 1px solid #ccc;
        text-align: center;
        -moz-border-radius: 10px;
        -webkit-border-radius: 10px;
        border-radius: 10px;
        -moz-box-shadow: 2px 2px 3px #666;
        -webkit-box-shadow: 2px 2px 3px #666;
        box-shadow: 2px 2px 3px #666;
        font-size: 20px;
        padding: 4px 7px;
        outline: 0;
        -webkit-appearance: none;
        /* Apply glassmorphism style for the modal content */
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .searchfield:focus {
        border-color: #abd6ff;
    }

    .container {
        border-top: 1px solid #333;
        border-bottom: 1px solid #333;
        height: 83.33vh;
    }
</style>
