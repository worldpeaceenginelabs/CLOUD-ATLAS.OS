<script lang="ts">
	let events = [
		{
			date: "2025-04-01T09:00",
			title: "Meditation Retreat",
			details: "Join us for a week-long meditation retreat in the mountains.",
			location: { name: "Mountain Temple", link: "https://maps.google.com?q=Mountain+Temple" },
			category: "Wellness"
		},
		{
			date: "2025-04-02T18:00",
			title: "Digital Nomad Meet-up",
			details: "Connect with other digital nomads in a cozy café.",
			location: { name: "Nomad Café", link: "https://maps.google.com?q=Nomad+Cafe" },
			category: "Networking"
		},
		{
			date: "2025-04-03T07:00",
			title: "Marathon Training Session",
			details: "Prepare for the upcoming marathon with a group training session.",
			location: { name: "City Park", link: "https://maps.google.com?q=City+Park" },
			category: "Fitness"
		},
		// Add more events as needed...
	];

	let openIndex: number | null = null;
	let selectedCategory: string = "All";

	const toggle = (index: number) => {
		openIndex = openIndex === index ? null : index;
	};

	// Filter events by category
	$: filteredEvents = selectedCategory === "All"
		? events
		: events.filter((e) => e.category === selectedCategory);

	// Get unique categories
	const categories = ["All", ...new Set(events.map(e => e.category))];

	function getCalendarLinks(event) {
		const start = new Date(event.date);
		const end = new Date(start.getTime() + 60 * 60 * 1000); // +1 hour
		const format = (date: Date) => date.toISOString().replace(/[-:]|\.\d{3}/g, "");

		const title = encodeURIComponent(event.title);
		const details = encodeURIComponent(event.details);
		const location = encodeURIComponent(event.location.name);
		const dates = `${format(start)}/${format(end)}`;

		return {
			google: `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`,
			apple: `data:text/calendar;charset=utf8,BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
URL:${event.location.link}
DTSTART:${format(start)}
DTEND:${format(end)}
SUMMARY:${event.title}
DESCRIPTION:${event.details}
LOCATION:${event.location.name}
END:VEVENT
END:VCALENDAR`.replace(/\n/g, '%0A')
		};
	}
</script>

<main>
	<h1>GoPai.com</h1>

	<select bind:value={selectedCategory} style="margin-bottom: 20px;">
		{#each categories as category}
			<option value={category}>{category}</option>
		{/each}
	</select>

	<div class="event-container">
		{#each filteredEvents as event, index}
			<div class="event" on:click={() => toggle(index)}>
				<strong>{new Date(event.date).toLocaleDateString()} {new Date(event.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong> - {event.title}
				{#if openIndex === index}
					<div class="details">
						<p>{event.details}</p>
						<p><strong>Location:</strong> <a href={event.location.link} target="_blank">{event.location.name}</a></p>
						<div style="margin-top: 10px;">
							<a href={getCalendarLinks(event).apple} target="_blank" style="display: flex; align-items: center; gap: 6px; margin-bottom: 5px;">
								<img src="https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg" alt="Apple" width="16" height="16" />
								📅 Add to Apple Calendar
							</a>
							<a href={getCalendarLinks(event).google} target="_blank" style="display: flex; align-items: center; gap: 6px;">
								<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Google_2015_logo.svg/2560px-Google_2015_logo.svg.png" alt="Google" width="16" height="16" />
								📅 Add to Google Calendar
							</a>
						</div>
					</div>
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
		text-align: center;
		color: white;
		padding: 20px;
		min-height: 100vh;
	}

	h1 {
		margin-bottom: 20px;
		background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
		background-size: 400% 400%;
		animation: gradientBG 15s ease infinite;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		font-size: 3rem;
	}

	select {
		padding: 10px;
		border-radius: 8px;
		border: none;
		font-size: 1rem;
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

	a {
		color: #f0f0f0;
		text-decoration: none;
	}

	a:hover {
		text-decoration: underline;
	}

	@keyframes gradientBG {
		0% { background-position: 0% 50%; }
		50% { background-position: 100% 50%; }
		100% { background-position: 0% 50%; }
	}

	@media (max-width: 768px) {
		h1 { font-size: 2.5rem; }
	}

	@media (max-width: 480px) {
		h1 { font-size: 2rem; }
	}
</style>
