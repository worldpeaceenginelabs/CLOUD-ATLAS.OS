<script lang="ts">
  import { slide } from 'svelte/transition';
  import { writable } from 'svelte/store';
    import ScrollbarStyles from './ScrollbarStyles.svelte';

  export let isVisible = writable(true);

  function toggleInfobox() {
    isVisible.update(visible => !visible);
  }
</script>

<ScrollbarStyles />
{#if $isVisible}
<div class="main_div" transition:slide={{ duration: 500 }}>

  <div style="position: fixed; left: 0px; top: 5px; width: 100%; display: flex; justify-content: center; align-items: center;">
    <div class="animated-gradient" style="width: 100%; height: 30px; position: relative; display: flex; align-items: center;">
      <h4 style="margin: 0; position: absolute; left: 50%; transform: translateX(-50%); width: 100%;">Cloud Atlas OS</h4>
      
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

  <div class="textbox">
    <div style="text-align:center;">
    <h2><strong>What if the world was run by You and Me?</strong></h2>
    <h3>We’ve evolved <strong>Crowd Engineering</strong> into a revolutionary <strong>Social Network application</strong></h3>
    
    <iframe width="100%" height="480" 
    src="https://www.youtube.com/embed/O6CHRdYSaH0" 
    title="Cloud Atlas OS in Action – Da Nang Beach Mission" 
    frameborder="0" 
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
    allowfullscreen>
    </iframe>
  
    <h3>A bold reimagining of governance—where brainstorming, group action, petitioning, and crowdfunding merge into an action-driven system. From local challenges to global movements, anyone can create or join missions. It’s governance made accessible, participatory, and even fun—like a game where everyone plays to make the world better.</h3>
    <h3>"I used to complain about things in my city but never knew where to start. Cloud Atlas OS gave me a platform to turn frustration into collaboration. I launched a local cleanup mission, got support from people I never met before, and now we’re organizing monthly events. My friends saw the impact and created their own missions too—this platform made me believe change is possible again." — Daniel R., Community Starter, Cloud Atlas OS</h3>
    <h3><strong>Turning ideas into action just got easier.</strong></h3>
    <h3><strong>Small changes that change everything. One at a time.</strong></h3>
    <img src="butterfly.gif" width="200" height="200"/>
    <h4><strong>“You never change things by fighting the existing reality. To change something, build a new model that makes the existing model obsolete." Buckminster Fuller</strong></h4>
    </div>
    
    <br><br>
  
    <div style="text-align:justify;">
    <h4>
      <strong>What is Cloud Atlas OS?</strong><br>
      <strong>Cloud Atlas OS</strong> is a <strong>real-world platform owned by the community</strong> — like a mix of <strong>Google Earth</strong>, <strong>Wikipedia (coming soon)</strong>, and an <strong>App Store (coming soon)</strong> — but without big companies or central servers in control.<br>
      It runs on a <strong>network of people's devices</strong>, so it's <strong>scalable</strong>, <strong>doesn’t need servers</strong>, and is <strong>free to use</strong>.<br>
      It’s fully owned by <strong>you and everyone</strong>, working as a <strong>Global Public Collective Computer</strong> — a worldwide system owned by everyone, powered by everyone, where data, apps, and smart tools are spread around the world instead of being locked in company systems.
      <br><br>
      The name <strong>Cloud Atlas</strong> reflects its vision: a living, global 'atlas' of everything happening on Earth — powered by a decentralized, human-powered 'cloud' of people, devices, and places. It’s not just a platform — it’s the foundation of a new, open internet.
      <br><br>

      <strong>Our Main Directive:</strong> "Make the world work for 100% of humanity, in the shortest possible time, through spontaneous cooperation, without ecological offense or the disadvantage of anyone." <strong>Buckminster Fuller</strong><br><br>
      <strong>Where Your Vision Meets Collective Action...</strong><br>
      The <strong>Home Screen</strong> is a social network for crowdengineering good deeds where you can actively create and participate in missions addressing <strong>local and global</strong> issues. It offers a space to <strong>brainstorm (zoom.us)</strong> solutions,  with people from all walks of life, realize your solutions through collaborations or sheer manpower with <strong>in-person ActionEvents (Telegram’s live location lets up to 200,000 users coordinate in real time on a single map)</strong>, secure eventually necessary permissions to enhance public spaces via <strong>Petition (change.org)</strong>, and turn your visionary ideas into reality with the power of <strong>Crowdfunding (gofundme.com).</strong><br><br><br>
      </h4>
      </div>

      <div style="text-align: center;"><strong>FOR DEVELOPERS</strong></div><br>

      <div style="text-align:justify;">
      <h4><strong>For new apps built specifically for Cloud Atlas OS</strong>, you can focus entirely on the front-end, with the back-end taken care of for you. The only consideration is the structure of your database. It’s as simple as building your app and letting Cloud Atlas OS handle the rest.<br><br> <strong>For existing apps, transitioning to Cloud Atlas OS is just as easy.</strong> You’ll only need to replace your back-end driver with ours—typically just three lines of code—allowing your app to integrate seamlessly into the decentralized network without major changes.<br><br>
      <strong>Your creations will never be limited to just one environment again...</strong><br>
      The <strong>Dapp Store</strong> is a dedicated space designed to prominently feature your digital creations, each uniquely associated with coordinates on the map—where every coordinate tells a story: <strong>posts, profiles, links, API, streams, live-stream, apps, games (including your Steam, Epic,... games), your non-profit business, your for-profit business</strong> - you name it - Literally! For mobile, desktop, AR, and VR out of the box!<br><br>
      
      <strong>In-Browser Development:</strong> The <strong>Stackblitz IDE</strong> is seamlessly integrated (settings icon bottom-right), enabling you to propose, create, and implement new applications, enhancements, and bug fixes directly - <strong>in Browser</strong> — all without the need for installing a coding environment. Contributions are easy via a simple pull request. (For developers and non-technicians: <a target="_blank" href="https://githubnext.com/projects/copilot-workspace">GitHub Copilot Workspace coming - "If you can describe it, you can code it"</a>)<br><br>
      
      <strong>Don’t get hung up on the tools:</strong><br>
      Pick what suits your flow. Elevate your concepts using:
      <ul>
      <li><strong>Unreal Engine 5</strong> (Uses C++ as the primary programming language, with Blueprints for visual scripting, and also supports Python for scripting certain tasks.)</li>
      <li><strong>Unity 3D</strong> (Uses C# as the primary programming language, with Unity Visual Scripting (Bolt) for visual scripting.)</li>
      <li><strong>HTML, CSS, JS, APIs (JAMstack)</strong></li>
      <li><strong>WASM</strong> (C, C++, C#, and Rust, but for the Web)</li>
      <li><strong>WebContainers</strong> (Node.js in the browser)</li>
      </ul>
      <p>Then continue with <strong>Stackblitz IDE Integration</strong> (Live Edit).</p>


    <strong>It’s free and scales 99% autonomously!</strong> More users mean more app storage and computational power.
    <strong>No need for back-end servers!</strong> Cloud Atlas syncs via public tracker networks using BitTorrent, with Nostr as a fallback coming soon. However, persistent storage and computational power (cloud/servers) can be simply added if needed.<br><br>
    </h4>
    </div>

    <div class="center"><h4><strong>What's stopping you from creating right now? Your imagination is the only limit.</strong></h4>
    
    <a class="neumorphic" target="_blank" href="https://github.com/worldpeaceenginelabs/CLOUD-ATLAS-OS">Check out our GitHub</a><br>
    
    <h4><strong>🔥 Want more apps? Reach out to me and our community anytime on GitHub, Element.io (DEVChat), or during our upcoming weekly Zoom brainstorming sessions on YouTube.</strong></h4><br>

    <strong>Cloud Atlas, my passion project, intentionally remains non-profit and free forever. Why I Need Your Support? While Cloud Atlas is my passion, I also have to meet my day-to-day living expenses. Instead of requesting large sums of money to hire developers or to cover substantial project costs, I’ve decided to take a more sustainable and humble approach. I am seeking support to continue my journey as a digital nomad, which allows me to live and work full-time on Cloud Atlas with minimal expenses. With just €6,000 a year, I can live comfortably in Southeast Asia, dedicating all my time and energy to developing and growing Cloud Atlas. This amount covers my living costs and allows me to focus on what truly matters—building this platform for the benefit of all. Please consider supporting me by contributing to my Bitcoin address <a target="_blank" href="https://bitcoinblockexplorers.com/address/bc1qwwdmn33g90y3vwutpj6r6q6kwrdqp00x2mfrzp">bc1qwwdmn33g90y3vwutpj6r6q6kwrdqp00x2mfrzp</a> or via <a target="_blank" href="https://paypal.me/worldpeaceengine">PayPal Me</a>. Everything above €6,000 a year will flow directly into enhancing Cloud Atlas OS.</strong>
    </div>

    <br><br>
    
    <div class="center"><h4><strong>⚠️ Please note our one essential guideline:⚠️</strong></h4></div>
    
    <div style="text-align:justify;">
    <h4>
      1. In our unique gathering, let’s embrace our unique backgrounds and perspectives. We strive for a space where everyone feels comfortable, so please leave discussions of politics, religion, nationality, gender, age, and profession at the door.<br><br>
      2. Our meeting thrives on collective participation, no one person orchestrates our time together. If someone becomes too prominent, we trust in our collective wisdom to guide the conversation back to balance. Remember, those who help to moderate or remind others of our guidelines are not assuming leadership; they are simply helping to preserve our shared space. Stepping in to guide or moderate does not make one the leader; there are no leaders here.<br><br>
      3. If a member seeks help, we champion a culture where everyone pitches in to assist.<br><br>
      4. Together, we’ll create a space that’s collaborative, respectful, and leaderless. Thank you for contributing to our collective journey.<br><br>
      5. This introduction reinforces the idea that even those who help ensure the meeting runs smoothly are not taking on a leadership role, but rather contributing to the group’s collective operation.
    </h4>
    </div>
  </div>


  <div style="position: fixed; bottom: 5px; left: 0; height: 30px; width: 100%; display: flex; justify-content: center; align-items: center;">
    
    <a href="https://worldpeaceenginelabs.org/" target="_blank">
      <img class="bottomicons" style="background-color: white;" src="./icons/tree-icon.gif" alt="" title="World Peace Engine Labs" height="30" width="30">
  </a>

    <a href="https://github.com/worldpeaceenginelabs/CLOUD-ATLAS-OS" target="_blank">
      <img class="bottomicons" src="github-icon.svg" alt="" title="GitHub" height="30" width="30">
  </a>
 
    <a href="pear://keet/nfohh3zteag1bcakp8qntdaoiz3mpt9zq6x13wb1spguxuyc8k4ugyspuj43rxynu6yk68759erbex9txpag8fbwrobgrjkwwz5tz8dpyabr8yoq7paqw4ryi9a5973qmu5qz458iitgce3mxwekm9rpa6smoyedsyrto9tmowno15sqjmbd7wsgqq4jy" target="_blank">
        <img class="bottomicons" src="chat-icon.svg" alt="" title="Developer Chat on Keet" height="30" width="30">
    </a>
    
    <a href="https://twitter.com/cloudatlasos" target="_blank">
        <img class="bottomicons" src="x-icon.svg" alt="" title="X" height="30" width="30">
    </a>
    <a href="https://www.youtube.com/@cloudatlasos" target="_blank">
        <img class="bottomicons" src="youtube-icon.svg" alt="" title="Youtube" height="30" width="30">
    </a>
    <a href="https://bitcoinblockexplorers.com/address/bc1qwwdmn33g90y3vwutpj6r6q6kwrdqp00x2mfrzp" target="_blank">
      <img class="bottomicons" src="./icons/bitcoin.png" alt="" title="Donate Bitcoin" height="30" width="30">
  </a>
</div>


</div>
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


  h4 {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    color: white;
    font-weight: normal;
  }

  .textbox {
  overflow-y: auto;
  overflow-x: auto; /* Add horizontal scrolling if needed */
  word-wrap: break-word; /* Prevent text overflow */
  max-width: 100%; /* Ensure the container does not exceed the viewport width */
  box-sizing: border-box; /* Include padding and border in width calculation */
  top: 50px;
  position: fixed;
  bottom: 50px;
  padding: 10px;
}

  .center {
    text-align: center;
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
    color: black;
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


 /* Scrollbar styles provided by ScrollbarStyles component */
</style>
