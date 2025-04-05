<script lang="ts">
    let events = [
        { date: "2025-04-01", title: "Meditation Retreat", details: "Join us for a week-long meditation retreat in the mountains." },
        { date: "2025-04-02", title: "Digital Nomad Meet-up", details: "Connect with other digital nomads in a cozy café." },
        { date: "2025-04-03", title: "Marathon Training Session", details: "Prepare for the upcoming marathon with a group training session." },
        { date: "2025-04-04", title: "Yoga Workshop", details: "Participate in a full-day yoga workshop to enhance your practice." },
        { date: "2025-04-05", title: "Remote Work Conference", details: "Learn new skills and network with other remote workers." },
        { date: "2025-04-06", title: "Cycling Tour", details: "Join us for a scenic cycling tour through the countryside." },
        { date: "2025-04-07", title: "Spiritual Healing Session", details: "Experience a group spiritual healing session." },
        { date: "2025-04-08", title: "Tech Networking Event", details: "Meet and network with tech professionals and enthusiasts." },
        { date: "2025-04-09", title: "Hiking Adventure", details: "Explore nature with a guided hiking adventure." },
        { date: "2025-04-10", title: "Mindfulness Seminar", details: "Attend a seminar on mindfulness and stress reduction techniques." }
    ];
  
    let openIndex = null;
  
    function toggle(index) {
        openIndex = openIndex === index ? null : index;
    }
  </script>
  
  <main>
    <h1>GoDaNang.com</h1>
    <div class="event-container">
        {#each events as event, index}
            <div class="event" on:click={() => toggle(index)}>
                <strong>{event.date}</strong> - {event.title}
                {#if openIndex === index}
                    <div class="details">{event.details}</div>
                {/if}
            </div>
        {/each}
    </div>
  </main>
  
  <style>
    html, body {
        height: 100%;
        margin: 0;
        overflow-y: auto;
    }
  
    main {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
        'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-align: center;
        color: white;
        padding: 20px;
        margin: 0;
        min-height: 100vh;
    }
  
    .event-container {
        max-width: 600px;
        margin: auto;
    }
  
    .event {
        cursor: pointer;
        padding: 15px;
        margin: 10px 0;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0);
        backdrop-filter: blur(25px) saturate(180%);
        border: 1px solid rgba(255, 255, 255, 0.3);
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
        transition: all 0.3s ease-in-out;
    }
  
    .event:hover {
        background: rgba(255, 255, 255, 0.15);
        box-shadow: 0 6px 15px rgba(0, 0, 0, 0.15);
    }
  
    .details {
        padding: 10px;
        margin-top: 5px;
        background: rgba(255, 255, 255, 0.03);
        border-radius: 8px;
        backdrop-filter: blur(20px) saturate(160%);
        border: 1px solid rgba(255, 255, 255, 0.25);
    }
  
    h1 {
        margin-bottom: 20px;
        background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
        background-size: 400% 400%;
        animation: gradientBG 15s ease infinite;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        line-height: 1.2;
        padding-bottom: 5px;
        font-size: 3rem; /* Adjust the default font size */
    }
  
    @keyframes gradientBG {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
    }
  
    @media (max-width: 768px) {
        h1 {
            font-size: 2.5rem; /* Adjust the font size for tablets */
        }
    }
  
    @media (max-width: 480px) {
        h1 {
            font-size: 2rem; /* Adjust the font size for mobile devices */
        }
    }
  </style>