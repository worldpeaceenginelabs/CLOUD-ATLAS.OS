<script lang="ts">
  let missionTitleMain = 'Mission 2';
  let missionTitleSub = 'Start your first Brainstorming';
</script>

<div class="mission">
  <p class="mission-title">
    <span class="mission-title-main animated-gradient">{missionTitleMain}</span>
    <span class="mission-title-sub animated-gradient">{missionTitleSub}</span>
  </p>
  <p class="mission-bottom-heading">COMING SOON</p>
  
  <div class="mission-bottom">
    <p class="animated-gradient">
      <span class="mission-bottom-heading">A bold reimagining of governance</span>
       — where brainstorming, group action, petitioning, and crowdfunding merge into an action-driven system.
    </p>
    <p class="animated-gradient">
      <span class="mission-bottom-heading">From local challenges to global movements,</span>
      anyone can create or join missions.
    </p>
    <p class="animated-gradient">
      <span class="mission-bottom-heading">It's governance made accessible, participatory, and even fun</span>
      — like a game where everyone plays to make the world better.
    </p>
  </div>
</div>

<style>
  .mission {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 1.5rem;
    width: 100%;
    height: auto;
    min-height: 100%;
    min-width: 0;
    overflow-x: hidden;
    text-align: center;
    padding: 24px;
    box-sizing: border-box;
  }

  .mission-title {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    margin: 0;
    overflow-wrap: break-word;
  }

  .mission-title-main {
    font-weight: 700;
    font-size: clamp(2.25rem, 14vmin, 5.5rem);
    line-height: 1;
    letter-spacing: -0.02em;
    display: block;
    max-width: 100%;
    min-width: 0;
    overflow-wrap: break-word;
    word-break: break-word;
  }

  .mission-title-sub {
    font-weight: 700;
    font-size: clamp(1.2rem, 6.5vmin, 2.75rem);
    line-height: 1.3;
    letter-spacing: 0.02em;
    display: block;
    max-width: 100%;
    min-width: 0;
    overflow-wrap: break-word;
    word-break: break-word;
    padding-bottom: 2px;
  }

  .mission-bottom {
    font-size: clamp(0.95rem, 4vw, 25px);
    line-height: 1.5;
    width: 100%;
    margin: 0;
  }

  .mission-bottom p {
    margin: 0.35rem 0;
  }

  .mission-bottom-heading {
    color: #ffd700;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-right: 0.25rem;
    -webkit-text-fill-color: #ffd700;
    background: none;
  }

  .animated-gradient {
    background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
    background-size: 400% 400%;
    animation: gradientBG 5s ease infinite;
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  @keyframes gradientBG {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  @media (max-width: 600px) {
    .mission {
      padding: 16px;
      min-height: 100%;
    }
  }
</style>
