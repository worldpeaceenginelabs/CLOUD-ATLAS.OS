<script>
  import Brainstorming from "./Brainstorming.svelte";
  import ActionEvent from "./ActionEvent.svelte";
  import Petition from "./Petition.svelte";
  import Crowdfunding from "./Crowdfunding.svelte";
  import { onDestroy } from 'svelte';

  let showModal = false;
  let currentComponent = null;

  const components = {
    Brainstorming,
    ActionEvent,
    Petition,
    Crowdfunding,
  };

  function openModal(componentName) {
    currentComponent = components[componentName];
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    currentComponent = null;
  }

</script>




  <div style="padding: 20px;">
    <div class="box glassmorphism" on:click={() => openModal("Brainstorming")}>
      <div class="title">Start a Brainstorming (Zoom.us)</div>
      <div class="description">Flip the script on every bad news! Take every flood, fire, drought, blackout, eviction, protest, injustice, crisis, or failure—or any everyday issue, whether local or global—and turn it into a public brainstorm. Open to everyone, including entrepreneurs, to brainstorm their own challenges and co-create innovative products, services, and solutions. Collaborate with people from all walks of life to address both real-world problems and business opportunities, locally and globally.</div>
    </div>

    <div class="box glassmorphism" on:click={() => openModal("ActionEvent")}>
      <div class="title">Start an ActionEvent (Telegram)</div>
      <div class="description">From idea to impact—organize real-world missions with local teams. Rally your community, show up, and take action where it counts.</div>
    </div>

    <div class="box glassmorphism" on:click={() => openModal("Petition")}>
      <div class="title">Start a Petition (Change.org)</div>
      <div class="description">Make your voice count. Push for change, win approvals, and unlock collective power to reshape spaces, systems, and policies.</div>
    </div>

    <div class="box glassmorphism" on:click={() => openModal("Crowdfunding")}>
      <div class="title">Start a Crowdfunding (GoFundMe.com)</div>
      <div class="description">Fuel your mission. Raise the resources to launch your project and solutions—and turn bold ideas into real-world transformations.</div>
    </div>
  </div>




{#if showModal}
  <div class="modal">
    <div class="modal-content glassmorphism">

      <div class="close float-right" on:click={closeModal}>
        <svg viewBox="0 0 36 36" class="circle">
          <path
          stroke-dasharray="100, 100"
          d="M18 2.0845
            a 15.9155 15.9155 0 0 1 0 31.831
            a 15.9155 15.9155 0 0 1 0 -31.831"
          />
        </svg>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        </div>
        
      {#if currentComponent}
      <div style="padding: 20px;">
        <svelte:component this={currentComponent} />
      </div>
        {/if}
    </div>
  </div>
{/if}




<style>
  .box {
    padding: 15px;
    margin-bottom: 15px;
    border-radius: 10px;
    background-color: rgba(0, 0, 0, 0.5);
    box-shadow: 0 1px 5px rgba(0, 0, 0, 0.1);
    text-align: left;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    cursor: pointer;
  }

  .box:hover {
    transform: translateY(-5px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
  }

  .title {
    font-weight: bold;
    margin-bottom: 5px;
    color: white;
    font-size: 1em;
  }

  .description {
      font-size: 1em;
      color: #efefef; /* added the missing hash for the color */
  }

  @media screen and (max-width: 450px) {
      .title, .description {
          font-size: 0.8em;
      }
  }

  /* Modal styles */
  .modal {
    display: flex;
    justify-content: center;
    align-items: center;
    position: fixed;
    z-index: 1000;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    overflow: auto;
    background-color: rgba(0, 0, 0, 0.5);
  }

  .modal-content {
	  width: 95%;
	  max-width: 800px;  
  }

  .glassmorphism {
    /* Apply glassmorphism style for the modal content */
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .float-right {
        float: right;
    }

    .close {
  --size: 22px;
  --borderSize: 2px;
  --borderColor: rgba(255, 255, 255, 1);
  --speed: 0.5s;

  width: var(--size);
  height: var(--size);
  position: relative;
  background: #455A64;
  border-radius: 50%;
  box-shadow: 0 0 20px -5px rgba(255, 255, 255, 0.5);
  transition: 0.25s ease-in-out;
  cursor: pointer;
  animation: fade-in-scale-down var(--speed) ease-out 0.25s both;
}

/* Keyframes for fade-in-scale down effect */
@keyframes fade-in-scale-down {
    from {
        opacity: 0;
        transform: scale(1.1); /* Optional: add a slight zoom-in effect */
    }
    to {
        opacity: 1;
        transform: scale(1); /* Reset to normal scale */
    }
}

.close .circle path {
  stroke: var(--borderColor);
  fill: none;
  stroke-width: calc(var(--borderSize) / 2);
  stroke-linecap: round;
  animation: progress var(--speed) ease-out 0.25s both;
}

@keyframes progress {
  from {
    stroke-dasharray: 0 100;
  }
}

.close span {
  display: block;
  width: calc(var(--size) / 4 - 2px);
  height: var(--borderSize);
  background: var(--borderColor);
  box-shadow: 0 0 20px -5px rgba(255, 255, 255, 0.5);
  border-radius: 20px;
  position: absolute;
  --padding: calc(var(--size) / 3);
  transition: 0.25s ease-in-out;
  animation: slide-in var(--speed) ease-in-out 0.25s both;
}

@keyframes slide-in {
  from {
    width: 0;
  }
}

.close span:nth-child(2) {
  top: calc(var(--padding) - var(--borderSize) / 2);
  left: var(--padding);
  transform: rotate(45deg);
  transform-origin: top left;
}

.close span:nth-child(3) {
  top: calc(var(--padding) - var(--borderSize) / 2);
  right: var(--padding);
  transform: rotate(-45deg);
  transform-origin: top right;
}

.close span:nth-child(4) {
  bottom: calc(var(--padding) - var(--borderSize) / 2);
  left: var(--padding);
  transform: rotate(-45deg);
  transform-origin: bottom left;
}

.close span:nth-child(5) {
  bottom: calc(var(--padding) - var(--borderSize) / 2);
  right: var(--padding);
  transform: rotate(45deg);
  transform-origin: bottom right;
}

.close:hover {
  background: #37474F;
}

.close:hover span {
  width: calc(var(--size) / 4);
}

/* Responsive styles for smaller screens */
@media screen and (max-width: 400px) {
    .title, .description {
      font-size: 0.8em; /* Reduce text size */
    }

    .modal-content {
      max-height: 80vh; /* Adjust height for very small devices */
    }
  }
</style>


