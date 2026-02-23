<script lang="ts">
  import { fade } from 'svelte/transition';
  import { writable } from 'svelte/store';
  import CloseButton from './CloseButton.svelte';

  export let isVisible = writable(true);

  function toggleInfobox() {
    isVisible.update(visible => !visible);
  }
</script>

{#if $isVisible}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="backdrop" on:click={toggleInfobox} role="presentation" transition:fade={{ duration: 300 }}></div>
  <div class="main_div" transition:fade={{ duration: 300 }}>
    <CloseButton onClose={toggleInfobox} top="14px" right="16px" />
    <div class="textbox">
      <p class="headline">Cloud Atlas OS</p>
      <p class="tagline">Science fiction meets the real world.</p>

      <div style="text-align:center;">
        <h2><strong>What if the world was run by You and Me?</strong></h2>
        <p>We've evolved <strong>Crowd Engineering</strong> into a revolutionary <strong>Social Network application</strong></p>

        <iframe width="100%" height="480"
          src="https://www.youtube.com/embed/O6CHRdYSaH0"
          title="Cloud Atlas OS in Action – Da Nang Beach Mission"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen>
        </iframe>

        <p>A bold reimagining of governance—where brainstorming, group action, petitioning, and crowdfunding merge into an action-driven system. From local challenges to global movements, anyone can create or join missions. It's governance made accessible, participatory, and even fun—like a game where everyone plays to make the world better.</p>
        <p>"I used to complain about things in my city but never knew where to start. Cloud Atlas OS gave me a platform to turn frustration into collaboration. I launched a local cleanup mission, got support from people I never met before, and now we're organizing monthly events. My friends saw the impact and created their own missions too—this platform made me believe change is possible again." — Daniel R., Community Starter, Cloud Atlas OS</p>
        <p class="accent">Turning ideas into action just got easier.</p>
        <p class="accent">Small changes that change everything. One at a time.</p>
        <img src="butterfly.gif" width="200" height="200" alt="Butterfly" />
        <p><strong>"You never change things by fighting the existing reality. To change something, build a new model that makes the existing model obsolete." Buckminster Fuller</strong></p>
      </div>

      <br><br>

      <div style="text-align:justify;">
        <p>
          <strong>What is Cloud Atlas OS?</strong><br>
          <strong>Cloud Atlas OS</strong> is a <strong>real-world platform owned by the community</strong> — like a mix of <strong>Google Earth</strong>, <strong>Wikipedia (coming soon)</strong>, and an <strong>App Store (coming soon)</strong> — but without big companies or central servers in control.<br>
          It runs on a <strong>network of people's devices</strong>, so it's <strong>scalable</strong>, <strong>doesn't need servers</strong>, and is <strong>free to use</strong>.<br>
          It's fully owned by <strong>you and everyone</strong>, working as a <strong>Global Public Collective Computer</strong> — a worldwide system owned by everyone, powered by everyone, where data, apps, and smart tools are spread around the world instead of being locked in company systems.
          <br><br>
          The name <strong>Cloud Atlas</strong> reflects its vision: a living, global 'atlas' of everything happening on Earth — powered by a decentralized, human-powered 'cloud' of people, devices, and places. It's not just a platform — it's the foundation of a new, open internet.
          <br><br>

          <strong>Our Main Directive:</strong> "Make the world work for 100% of humanity, in the shortest possible time, through spontaneous cooperation, without ecological offense or the disadvantage of anyone." <strong>Buckminster Fuller</strong><br><br>
          <strong>Where Your Vision Meets Collective Action...</strong><br>
          The <strong>Home Screen</strong> is a social network for crowdengineering good deeds where you can actively create and participate in missions addressing <strong>local and global</strong> issues. It offers a space to <strong>brainstorm (zoom.us)</strong> solutions,  with people from all walks of life, realize your solutions through collaborations or sheer manpower with <strong>in-person ActionEvents (Telegram's live location lets up to 200,000 users coordinate in real time on a single map)</strong>, secure eventually necessary permissions to enhance public spaces via <strong>Petition (change.org)</strong>, and turn your visionary ideas into reality with the power of <strong>Crowdfunding (gofundme.com).</strong><br><br><br>
        </p>
      </div>

      <div style="text-align: center;"><strong>FOR DEVELOPERS</strong></div><br>

      <div style="text-align:justify;">
        <p><strong>For new apps built specifically for Cloud Atlas OS</strong>, you can focus entirely on the front-end, with the back-end taken care of for you. The only consideration is the structure of your database. It's as simple as building your app and letting Cloud Atlas OS handle the rest.<br><br> <strong>For existing apps, transitioning to Cloud Atlas OS is just as easy.</strong> You'll only need to replace your back-end driver with ours—typically just three lines of code—allowing your app to integrate seamlessly into the decentralized network without major changes.<br><br>
          <strong>Your creations will never be limited to just one environment again...</strong><br>
          The <strong>Dapp Store</strong> is a dedicated space designed to prominently feature your digital creations, each uniquely associated with coordinates on the map—where every coordinate tells a story: <strong>posts, profiles, links, API, streams, live-stream, apps, games (including your Steam, Epic,... games), your non-profit business, your for-profit business</strong> - you name it - Literally! For mobile, desktop, AR, and VR out of the box!<br><br>

          <strong>In-Browser Development:</strong> The <strong>Stackblitz IDE</strong> is seamlessly integrated (settings icon bottom-right), enabling you to propose, create, and implement new applications, enhancements, and bug fixes directly - <strong>in Browser</strong> — all without the need for installing a coding environment. Contributions are easy via a simple pull request. (For developers and non-technicians: <a target="_blank" href="https://githubnext.com/projects/copilot-workspace">GitHub Copilot Workspace coming - "If you can describe it, you can code it"</a>)<br><br>

          <strong>Don't get hung up on the tools:</strong><br>
          Pick what suits your flow. Elevate your concepts using:</p>
          <ul>
            <li><strong>Unreal Engine 5</strong> (Uses C++ as the primary programming language, with Blueprints for visual scripting, and also supports Python for scripting certain tasks.)</li>
            <li><strong>Unity 3D</strong> (Uses C# as the primary programming language, with Unity Visual Scripting (Bolt) for visual scripting.)</li>
            <li><strong>HTML, CSS, JS, APIs (JAMstack)</strong></li>
            <li><strong>WASM</strong> (C, C++, C#, and Rust, but for the Web)</li>
            <li><strong>WebContainers</strong> (Node.js in the browser)</li>
          </ul>
          <p>Then continue with <strong>Stackblitz IDE Integration</strong> (Live Edit).</p>

          <p><strong>It's free and scales 99% autonomously!</strong> More users mean more app storage and computational power.
          <strong>No need for back-end servers!</strong> Cloud Atlas syncs via public tracker networks using BitTorrent, with Nostr as a fallback coming soon. However, persistent storage and computational power (cloud/servers) can be simply added if needed.</p>
      </div>

      <div class="center"><p><strong>What's stopping you from creating right now? Your imagination is the only limit.</strong></p>

        <a class="cta-link" target="_blank" href="https://github.com/worldpeaceenginelabs/CLOUD-ATLAS-OS">Check out our GitHub</a><br>

        <p><strong>Want more apps? Reach out to me and our community anytime on GitHub, Element.io (DEVChat), or during our upcoming weekly Zoom brainstorming sessions on YouTube.</strong></p><br>

        <p><strong>Cloud Atlas, my passion project, intentionally remains non-profit and free forever. Why I Need Your Support? While Cloud Atlas is my passion, I also have to meet my day-to-day living expenses. Instead of requesting large sums of money to hire developers or to cover substantial project costs, I've decided to take a more sustainable and humble approach. I am seeking support to continue my journey as a digital nomad, which allows me to live and work full-time on Cloud Atlas with minimal expenses. With just €6,000 a year, I can live comfortably in Southeast Asia, dedicating all my time and energy to developing and growing Cloud Atlas. This amount covers my living costs and allows me to focus on what truly matters—building this platform for the benefit of all. Please consider supporting me by contributing to my Bitcoin address <a target="_blank" href="https://bitcoinblockexplorers.com/address/bc1qwwdmn33g90y3vwutpj6r6q6kwrdqp00x2mfrzp">bc1qwwdmn33g90y3vwutpj6r6q6kwrdqp00x2mfrzp</a> or via <a target="_blank" href="https://paypal.me/worldpeaceengine">PayPal Me</a>. Everything above €6,000 a year will flow directly into enhancing Cloud Atlas OS.</strong></p>
      </div>

      <br><br>

      <div class="center"><p class="accent">Please note our one essential guideline:</p></div>

      <div style="text-align:justify;">
        <p>
          1. In our unique gathering, let's embrace our unique backgrounds and perspectives. We strive for a space where everyone feels comfortable, so please leave discussions of politics, religion, nationality, gender, age, and profession at the door.<br><br>
          2. Our meeting thrives on collective participation, no one person orchestrates our time together. If someone becomes too prominent, we trust in our collective wisdom to guide the conversation back to balance. Remember, those who help to moderate or remind others of our guidelines are not assuming leadership; they are simply helping to preserve our shared space. Stepping in to guide or moderate does not make one the leader; there are no leaders here.<br><br>
          3. If a member seeks help, we champion a culture where everyone pitches in to assist.<br><br>
          4. Together, we'll create a space that's collaborative, respectful, and leaderless. Thank you for contributing to our collective journey.<br><br>
          5. This introduction reinforces the idea that even those who help ensure the meeting runs smoothly are not taking on a leadership role, but rather contributing to the group's collective operation.
        </p>
      </div>

      <div class="cta">
        Community-owned. Open-source. Yours.<br/>
        Redefine the way we live together.
      </div>

      <div class="bottom-icons">
        <a href="https://worldpeaceenginelabs.org/" target="_blank">
          <img class="bottomicon" style="background-color: white;" src="./icons/tree-icon.gif" alt="" title="World Peace Engine Labs" height="30" width="30">
        </a>
        <a href="https://github.com/worldpeaceenginelabs/CLOUD-ATLAS-OS" target="_blank">
          <img class="bottomicon" src="github-icon.svg" alt="" title="GitHub" height="30" width="30">
        </a>
        <a href="pear://keet/nfohh3zteag1bcakp8qntdaoiz3mpt9zq6x13wb1spguxuyc8k4ugyspuj43rxynu6yk68759erbex9txpag8fbwrobgrjkwwz5tz8dpyabr8yoq7paqw4ryi9a5973qmu5qz458iitgce3mxwekm9rpa6smoyedsyrto9tmowno15sqjmbd7wsgqq4jy" target="_blank">
          <img class="bottomicon" src="chat-icon.svg" alt="" title="Developer Chat on Keet" height="30" width="30">
        </a>
        <a href="https://twitter.com/cloudatlasos" target="_blank">
          <img class="bottomicon" src="x-icon.svg" alt="" title="X" height="30" width="30">
        </a>
        <a href="https://www.youtube.com/@cloudatlasos" target="_blank">
          <img class="bottomicon" src="youtube-icon.svg" alt="" title="Youtube" height="30" width="30">
        </a>
        <a href="https://bitcoinblockexplorers.com/address/bc1qwwdmn33g90y3vwutpj6r6q6kwrdqp00x2mfrzp" target="_blank">
          <img class="bottomicon" src="./icons/bitcoin.png" alt="" title="Donate Bitcoin" height="30" width="30">
        </a>
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 99;
    background: rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }

  .main_div {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 101;
    background: rgba(18, 18, 30, 0.92);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid rgba(255, 215, 0, 0.25);
    border-radius: 20px;
    padding: 36px 40px 32px;
    box-shadow:
      0 24px 80px rgba(0, 0, 0, 0.4),
      0 0 60px rgba(255, 215, 0, 0.06),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
    max-width: 520px;
    width: calc(100% - 48px);
    max-height: 85vh;
    overflow-y: auto;
    color: #fff;
  }

  .textbox {
    line-height: 1.65;
    color: rgba(255, 255, 255, 0.85);
    font-size: 14px;
    word-wrap: break-word;
    max-width: 100%;
    box-sizing: border-box;
  }

  .headline {
    color: #FFD700;
    font-weight: 800;
    font-size: 22px;
    line-height: 1.3;
    margin: 0 0 4px;
    padding-right: 36px;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  }

  .tagline {
    color: rgba(255, 215, 0, 0.7);
    font-size: 15px;
    font-style: italic;
    font-weight: 500;
    margin: 0 0 18px;
  }

  .accent {
    color: #FFD700;
    font-weight: 700;
    font-size: 15px;
    text-align: center;
    margin: 2px 0 14px;
  }

  .textbox strong {
    color: #FFD700;
    font-weight: 700;
  }

  .textbox p {
    margin: 0 0 14px;
  }

  .textbox p:last-child {
    margin-bottom: 0;
  }

  h2 {
    color: #FFD700;
    font-weight: 800;
    font-size: 18px;
    line-height: 1.3;
    margin: 0 0 10px;
  }

  .cta {
    color: rgba(255, 255, 255, 0.95);
    font-weight: 700;
    font-size: 15px;
    text-align: center;
    margin-top: 18px;
    padding-top: 16px;
    border-top: 1px solid rgba(255, 215, 0, 0.15);
    line-height: 1.5;
  }

  .cta-link {
    display: inline-block;
    background: rgba(255, 215, 0, 0.12);
    border: 1px solid rgba(255, 215, 0, 0.3);
    border-radius: 10px;
    padding: 8px 20px;
    color: #FFD700;
    font-weight: 700;
    transition: all 0.2s ease;
  }

  .cta-link:hover {
    background: rgba(255, 215, 0, 0.22);
    color: #FFD700;
  }

  .center {
    text-align: center;
  }

  .bottom-icons {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 5px;
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid rgba(255, 215, 0, 0.15);
  }

  .bottomicon {
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(10px);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    padding: 2.5px;
    transition: all 0.2s ease;
  }

  .bottomicon:hover {
    background: rgba(255, 215, 0, 0.2);
  }

  a {
    color: rgba(255, 215, 0, 0.85);
    text-decoration: none;
    transition: color 0.2s ease;
  }

  a:visited { text-decoration: none; color: rgba(255, 215, 0, 0.85); }
  a:active { text-decoration: none; color: rgba(255, 215, 0, 0.85); }

  a:hover {
    color: #FFD700;
  }

  .textbox ul {
    padding-left: 20px;
    margin: 8px 0;
  }

  .textbox li {
    margin-bottom: 4px;
  }

  .textbox iframe {
    border-radius: 12px;
    margin: 14px 0;
    border: 1px solid rgba(255, 215, 0, 0.15);
  }

  .textbox img {
    border-radius: 8px;
  }

  @media (max-width: 600px) {
    .main_div {
      padding: 28px 24px 24px;
      border-radius: 16px;
      max-height: 80vh;
      width: calc(100% - 40px);
    }

    .headline {
      font-size: 19px;
    }

    .textbox {
      font-size: 13px;
    }
  }

  @media (max-width: 400px) {
    .main_div {
      padding: 24px 18px 20px;
      border-radius: 14px;
      width: calc(100% - 32px);
    }

    .headline {
      font-size: 17px;
    }

    .textbox {
      font-size: 12.5px;
      line-height: 1.55;
    }

    .tagline {
      font-size: 13px;
    }
  }
</style>
