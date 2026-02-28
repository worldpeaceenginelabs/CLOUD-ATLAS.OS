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
      <p class="headline">What if the world was run by You and Me?</p>
      <p class="tagline">Science fiction meets the real world.</p>

      <div style="text-align:center;">
      
        <p>We've evolved <strong>Crowd Engineering</strong> into a revolutionary<strong>Social Network application</strong></p>

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
        <p>"You never change things by fighting the existing reality. To change something, build a new model that makes the existing model obsolete." <strong>Buckminster Fuller</strong></p>
      </div>

      <br><br>

      <div style="text-align:justify;">
        <p>
          <strong>What is Cloud Atlas OS?</strong><br><br>

          Cloud Atlas OS is a community-owned super-app where the entire gig economy lives under one roof — ridesharing, delivery, freelance, spontaneous connections — with zero commissions. <strong>Keep 100% of what you earn.</strong> We'll teach you how to keep it, legally.<br><br>

          <span class="accent">But that's just the beginning.</span><br><br>

          Govern your city through <strong>SWARM GOVERNANCE</strong> — live brainstorming sessions, Telegram groups with up to 20,000 live positions in the field, Change.org petitions, GoFundMe crowdfunding, and real change — organized by you.<br><br>

          Stream your impact live on <strong>MissionTV</strong> and get paid for the causes you love — launching as our first communities organize.<br><br>

          Explore <strong>OMNIPEDIA</strong> — 6 million Wikipedia articles transformed into immersive 3D worlds on a live global map. Build apps, games, and experiences in seconds with the <strong>HOLODECK EDITOR</strong> — no coding required. And as the community shapes OMNIPEDIA and in turn the HOLODECK, a Genie 3 class worldmodel with spatial AGI emerges from it.<br><br>

          Think owning collectively Google Maps, Wikipedia, Amazon, Airbnb, Couchsurfing, Uber, DoorDash, UpWork, Fiverr, Spontacts, the whole gig, meet, and marketplace economy, Twitch, Kickstarter, and an App & Game Store with Genie 3 class worldmodel with spatial AGI — raised by the open-source community. 🔥

        </p>
        <p class="ps">P.S. In case it didn't sink in — you just became a co-owner of a Decentralized Autonomous Organization. No crypto. No CEO. No board. No headquarters. Just people, running it together, for themselves. Every ride, every delivery, every job, every sale on this platform? Yours. Not a CEO's. Not a shareholder's. Yours. Spread the word. It's your business now.</p>
        
        <div style="text-align:justify;">
          <p>
            <strong>Why?</strong><br><br>
  
            Something has always felt wrong.<br><br>
  
            You work hard. You do the right things. And somehow, at the end of the month, there's never quite enough. Meanwhile the platforms take their cut, the landlords raise the rent, the corporations write off their taxes, and the gap just keeps growing.<br><br>
  
            You're not lazy. You're not failing. The game was just never designed for you to win.<br><br>
  
            Buckminster Fuller saw this coming. Decades ago he asked one question — how do we make the world work for everyone? Not some people. Everyone. He called it the World Peace Game.<br><br>
  
            Not peace as in no war. Peace as in no one left behind.<br><br>
  
            Cloud Atlas is that game. Running. Right now. On your phone.<br><br>
  
            It's an app where you keep 100% of what you earn. Where your phone is the server and no company sits between you and your money. Where you find the right people, in the right place, who care about exactly what you care about.<br><br>
  
            Work, travel, organize, build, connect — all of it. Community owned. Zero commissions. No catch.<br><br>
  
            And the first thing it tells you when you open it —<br><br>
  
            <span class="accent">"Enter the World Peace Game"</span><br><br>
  
            Because that's what this is. Not an app launch. Not a startup. A different way of doing this. For everyone. Finally.<br><br>
          </p>
        </div>
        <br>
        <p>
          <strong>Our Main Directive:</strong> "Make the world work for 100% of humanity, in the shortest possible time, through spontaneous cooperation, without ecological offense or the disadvantage of anyone." <strong>Buckminster Fuller</strong><br><br><br>
        </p>
      </div>

      <div style="text-align: center;"><strong>FOR DEVELOPERS</strong></div><br>

      <div style="text-align:justify;">
        <p>
          <strong>Don't get hung up on the tools:</strong><br>
          Pick what suits your flow. Elevate your concepts using:</p>
          <ul>
            <li><strong>Unreal Engine 5</strong> (Uses C++ as the primary programming language, with Blueprints for visual scripting, and also supports Python for scripting certain tasks.)</li>
            <li><strong>Unity 3D</strong> (Uses C# as the primary programming language, with Unity Visual Scripting (Bolt) for visual scripting.)</li>
            <li><strong>HTML, CSS, JS, APIs (JAMstack)</strong></li>
            <li><strong>WASM</strong> (C, C++, C#, and Rust, but for the Web)</li>
            <li><strong>WebContainers</strong> (Node.js in the browser)</li>
          </ul>

          
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
      <br><br>
      <div style="text-align:justify;">
        <p>
          <strong>Support the Mission</strong><br><br>
          Cloud Atlas is intentionally non-profit and free forever. One person building it, living as a digital nomad in Southeast Asia on €6,000 a year — so every hour goes into this, not overhead.<br><br>
          If this resonates, consider supporting via Bitcoin. Everything above €6,000 goes directly into Cloud Atlas OS.
        </p>
      </div>

      <div class="cta">
        Community-owned. Open-source. Yours.<br/>
        Redefine the way we live together.
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
    max-width: 720px;
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

  .ps {
    color: rgba(255, 255, 255, 0.6);
    font-size: 13px;
    font-style: italic;
    text-align: center;
    margin-top: 14px !important;
  }

  .center {
    text-align: center;
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

  .ps {
    color: rgba(255, 255, 255, 0.6);
    font-size: 13px;
    font-style: italic;
    text-align: center;
    margin-top: 14px !important;
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
