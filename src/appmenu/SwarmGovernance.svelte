<script lang="ts">
  import MissionFrame from '../components/shared/MissionFrame.svelte';

  let missionTitleMain = 'Mission 2';
  let missionTitleSub = 'Start your first Brainstorming';
</script>

<MissionFrame titleMain={missionTitleMain} titleSub={missionTitleSub}>
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
</MissionFrame>

<style>
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

</style>
