<script lang="ts">
  import { slide } from 'svelte/transition';
  import { writable } from 'svelte/store';

  export let isVisible = writable(true);

  function toggleInfobox() {
    isVisible.update(visible => !visible);
  }
</script>

{#if $isVisible}
<div class="main_div" transition:slide={{ duration: 500 }}>

  <div style="position: fixed; left: 0px; top: 5px; width: 100%; display: flex; justify-content: center; align-items: center;">
    <div class="animated-gradient" style="width: 100%; height: 30px; position: relative; display: flex; align-items: center;">
      <h5 style="margin: 0; position: absolute; left: 50%; transform: translateX(-50%); width: 100%;">⚠️ Decentralized Government coming 2025 ⚠️</h5>
      
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div class="close" style="margin: 0; position: absolute; right: 10px; cursor: pointer;" on:click={toggleInfobox}>
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

  </div>
  </div>

  <div class="textbox" style="text-align:center;">
    <h3><strong>We've developed Crowd Engineering into a Social Network application...</strong></h3>
    <h4><strong>Cloud Atlas OS is a Community-Owned real-world platform 🔥 featuring a Community-Driven dApp Store 🔥 with Built-In Backend 🔥 Spatial Intelligence baked in 🔥 Run by the people, for the people.<br><br>But this is more than just a map...</strong><br><br>
    <strong>“You never change things by fighting the existing reality. To change something, build a new model that makes the existing model obsolete." Buckminster Fuller</strong><br><br>
    </h4>
  
    
    <h4 style="text-align:justify;">
    <strong>What is Cloud Atlas?</strong><br>
    Cloud Atlas is a decentralized, community-owned real-world platform - free from centralized servers and monopolistic control. Entirely owned by you and the public, it’s truly a Global Public Collective Computer!<br><br>
    <strong>Our Main Directive:</strong> "Make the world work for 100% of humanity, in the shortest possible time, through spontaneous cooperation, without ecological offense or the disadvantage of anyone." <strong>Buckminster Fuller</strong><br><br>
    <strong>Where Your Vision Meets Collective Action...</strong><br>
    The <strong>Home Screen</strong> is a social network for crowdengineering good deeds where you can actively create and participate in missions addressing <strong>local and global</strong> issues. It offers a space to <strong>brainstorm (zoom.us)</strong> solutions,  with people from all walks of life, realize your solutions through collaborations or sheer manpower with <strong>in-person ActionEvents (Telegram's live location feature allows up to 200,000 users to coordinate seamlessly)</strong>, secure eventually necessary permissions to enhance public spaces via <strong>Petition (change.org)</strong>, and turn your visionary ideas into reality with the power of <strong>Crowdfunding (gofundme.com).</strong><br><br>
    
    <strong>Your creations will never be limited to just one environment again...</strong><br>
    The <strong>Dapp Store</strong> is a dedicated space designed to prominently feature your digital creations, each uniquely associated with coordinates on the map. A coordinate can represent everything: <strong>posts, profiles, links, API, streams, live-stream, apps, games (including your Steam, Epic,... games), your non-profit business, your for-profit business</strong> - you name it - Literally! For mobile, desktop, AR, and VR out of the box!<br><br>
    
    <strong>In-Browser Development:</strong> The <strong>Stackblitz IDE</strong> is seamlessly integrated (settings icon top-right), enabling you to propose, create, and implement new applications, enhancements, and bug fixes directly - <strong>in Browser</strong> — all without the need for installing a coding environment. Contributions can be made effortlessly via a simple pull request. (For developers and non-technicians: <a target="_blank" href="https://githubnext.com/projects/copilot-workspace">GitHub Copilot Workspace coming - "If you can describe it, you can code it"</a>)<br><br>
    
    <strong>It’s free and scales 99% autonomously!</strong> More users mean more app storage and computational power.
    <strong>No need for back-end servers!</strong> Cloud Atlas syncs via public tracker networks using BitTorrent, with Nostr as a fallback coming soon. However, persistent storage and computational power (cloud/servers) can be simply added if needed.<br><br>
    </h4>


    <div class="center"><h4><strong>What's stopping you from creating right now? Your creativity is the limit.</strong></h4></div>
    
    <div class="center">
      <a class="neumorphic" target="_blank" href="https://github.com/worldpeaceenginelabs/METAVERSE-SEED">Check out our GitHub and Collaboration Hub</a><br>
    </div>
    
  
    
    <h4><strong>🔥 Want more apps? Reach out to me and our community anytime on GitHub, Element.io (DEVChat), or during our upcoming weekly Zoom brainstorming sessions on YouTube.</strong></h4><br>

    <strong>Cloud Atlas, my passion project, intentionally remains non-profit and free forever. Why I Need Your Support? While Cloud Atlas is my passion, I also have to meet my day-to-day living expenses. Instead of requesting large sums of money to hire developers or to cover substantial project costs, I’ve decided to take a more sustainable and humble approach. I am seeking support to continue my journey as a digital nomad, which allows me to live and work full-time on Cloud Atlas with minimal expenses. With just €6,000 a year, I can live comfortably in Southeast Asia, dedicating all my time and energy to developing and growing Cloud Atlas. This amount covers my living costs and allows me to focus on what truly matters—building this platform for the benefit of all. Please consider supporting me by contributing to my Bitcoin address <a target="_blank" href="https://bitcoinblockexplorers.com/address/12KQqWzc4BkVgm6syqEMjy3yoBd7hhoCHA">12KQqWzc4BkVgm6syqEMjy3yoBd7hhoCHA</a> or via <a target="_blank" href="https://paypal.me/worldpeaceengine">PayPal Me</a>. Everything above €6,000 a year will flow directly into enhancing Cloud Atlas.</strong>
    <br><br>
    <div class="center"><h4><strong>⚠️ Please note our one essential guideline:⚠️</strong></h4></div>
    <h4 style="text-align:justify;">
      1. In our unique gathering, let’s embrace our unique backgrounds and perspectives. We strive for a space where everyone feels comfortable, so please leave discussions of politics, religion, nationality, gender, age, and profession at the door.<br><br>
      2. Our meeting thrives on collective participation, no one person orchestrates our time together. If someone becomes too prominent, we trust in our collective wisdom to guide the conversation back to balance. Remember, those who help to moderate or remind others of our guidelines are not assuming leadership; they are simply helping to preserve our shared space. Stepping in to guide or moderate does not make one the leader; there are no leaders here.<br><br>
      3. If a member seeks help, we champion a culture where everyone pitches in to assist.<br><br>
      4. Together, we’ll create a space that’s collaborative, respectful, and leaderless. Thank you for contributing to our collective journey.<br><br>
      5. This introduction reinforces the idea that even those who help ensure the meeting runs smoothly are not taking on a leadership role, but rather contributing to the group’s collective operation.
    </h4>
  </div>


  <div style="position: fixed; bottom: 5px; left: 0; height: 30px; width: 100%; display: flex; justify-content: center; align-items: center;">
    <a href="https://worldpeaceenginelabs.org/" target="_blank">
        <img class="bottomicons" style="background-color: white;" src="./icons/tree-icon.gif" alt="" title="World Peace Engine Labs" height="30" width="30">
    </a>
    <a href="https://bitcoinblockexplorers.com/address/12KQqWzc4BkVgm6syqEMjy3yoBd7hhoCHA" target="_blank">
      <img class="bottomicons" src="./icons/bitcoin.png" alt="" title="Donate Bitcoin" height="30" width="30">
  </a>
    <a href="https://app.element.io/#/room/#METAVERSE-DAO_CLOUD-ATLAS_community:gitter.im" target="_blank">
        <img class="bottomicons" src="chat-icon.svg" alt="" title="Developer Chat" height="30" width="30">
    </a>
    <a href="https://github.com/worldpeaceenginelabs/METAVERSE-SEED#readme" target="_blank">
        <img class="bottomicons" src="github-icon.svg" alt="" title="GitHub" height="30" width="30">
    </a>
    <a href="https://twitter.com/peace_engine" target="_blank">
        <img class="bottomicons" src="x-icon.svg" alt="" title="X" height="30" width="30">
    </a>
    <a href="https://www.youtube.com/@worldpeaceenginelabs3955/videos" target="_blank">
        <img class="bottomicons" src="youtube-icon.svg" alt="" title="Youtube" height="30" width="30">
    </a>
</div>


</div>
{:else}
<h5 class="toggle-bar-hidden" on:click={toggleInfobox}>About</h5>
{/if}

<style>
  a {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    color: white;
    padding: 0px;
    margin: 0px;
    text-decoration: none;           
  }

  a:visited{text-decoration: none; color: white;}

  a:active{text-decoration: none; color: white;}

  a:hover {
    color: #abd6ff;
  }

  h5 {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    color: white;
    font-weight: normal;
  }

  h4 {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    color: white;
    font-weight: normal;
  }

  .textbox{
    overflow-y: auto;
    top: 50px;
    position: fixed;
    bottom: 50px;
    padding: 20px;
    
  }

  .center {
    text-align: center;
  }

  .toggle-bar-hidden {
    height: 15px;
    background: #ccc;
    color: black;
    cursor: pointer;
    z-index: 20;
    position: fixed;
    bottom: -18px;
    left: 50%;
    transform: translateX(-50%);
    width: 95%;
    max-width: 800px;
    backdrop-filter: blur(10px);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    padding: 5px;
    background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
    background-size: 400% 400%;
    animation: gradientBG 15s ease infinite;
  }

  .toggle-bar-hidden:hover {
    background: #abd6ff;
  }


  .main_div {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);    
    color: #fff;
    overflow: hidden;
    position: fixed;
    bottom: 5px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10;
    width: 98%;
    max-width: 800px;
    height: 500px;
  }

  .bottomicons{
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    padding: 2.5px;
    margin-left: 2.5px;
    margin-right: 2.5px;
  }

  .bottomicons:hover{
    background: #abd6ff;
  }
  

  .animated-gradient {
    background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
    background-size: 400% 400%;
    animation: gradientBG 15s ease infinite;
  }

  @keyframes gradientBG {
    0% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  }

  .neumorphic {
    background: #e0e5ec;
    border-radius: 10px;
    box-shadow: 6px 6px 10px #a3b1c6, -6px -6px 10px #ffffff;
  }

  .glassmorphism {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
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
  animation: fade-in var(--speed) ease-out 0.25s both;
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: scale(1.1);
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


 /* WebKit Scrollbar Styles */
 ::-webkit-scrollbar {
      width: 12px;
      height: 12px;
    }

    ::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.3);
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    ::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.3);
      backdrop-filter: blur(10px);
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.5);
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    ::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.5);
    }

    /* Firefox Scrollbar Styles */
    * {
      scrollbar-width: thin;
      scrollbar-color: rgba(255, 255, 255, 0.3) rgba(255, 255, 255, 0.1);
    }

    *::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.3);
    }

    *::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.3);
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.5);
    }

    *::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.5);
    }
</style>
