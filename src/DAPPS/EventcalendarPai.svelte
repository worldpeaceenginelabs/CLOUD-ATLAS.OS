<script lang="ts">
	let events = [
		{
			eventDate: "2025-04-09",
			eventTime: "4:00 PM",
			title: "🌍 THE NETWORK 🌱🔗",
			details: "🌟 Welcome to The Network – A Global Networking Community with Hostless Local Meetings! 🌟 No matter what question, problem, or issue you have, there is a 99% chance that someone had already been through it and figured it out. That willingness to help each other is the best part of The Network. This beautiful and authentic event, born in Lisbon - Europe’s digital nomad haven - is now connecting solo travelers, digital nomads, and entrepreneurs across cities worldwide! ❤️🎉🙏 🌍 Goal: Empowering Connections & Cultivating Opportunities 🚀 🔗 Expand your professional and social network 💡 Exchange ideas, skills & opportunities 📚 Learn from each other's experiences 🔎 Explore new places with like-minded people 🤝 Networking Opportunities: ✅ Collaborate and share insights ✅ Forge valuable connections ✅ Grow Your Network What to Expect: Casual and Hostless: No formal hosts or schedules - just show up, meet fellow solo travelers, and decide as a group where the adventure takes you! Open to Everyone: Whether you’re a local or just passing through, all are welcome to join. How It Works: Arrive at the meeting spot at the scheduled time. Look for fellow The Network participants (🥷) - friendly faces and curious adventurers! Jump in—introduce yourself, ask for help, or offer your expertise! 🚀 Decide as a group where to host yourself. (for instance we tried every week another location, sometimes bars, sometimes restaurants, sometimes a nice place in a park or on a beach, having BBQ. The possibilities are endless) ✨ Let’s make solo travel social, one city at a time. ✨ 🔗 Connect with us and let's grow together! 🌱",
			location: { name: "Mainstreet 711 (the one at Atlas Central)", link: "https://maps.app.goo.gl/UVepDfrWniHj3m9dA" },
			category: "Meetup",
			frequency: "weekly",
			weekdays: []
		},
	];

	let openIndex: number | null = null;
	let selectedCategory: string = "All";

	const toggle = (index: number) => {
		openIndex = openIndex === index ? null : index;
	};

	const getNextOccurrences = (event) => {
		const today = new Date();
		const nextOccurrences = [];
		const maxDays = 7;

		const addOccurrence = (date) => {
			const { eventDate, time, full } = splitDateAndTime(date.toISOString().split('T')[0], event.eventTime);
			nextOccurrences.push({ ...event, eventDate, eventTime: time, fullDate: full });
		};

		for (let i = 0; i <= maxDays; i++) {
			const currentDate = new Date(today);
			currentDate.setDate(today.getDate() + i);

			switch (event.frequency) {
				case 'once':
					if (new Date(event.eventDate).toDateString() === currentDate.toDateString()) {
						addOccurrence(currentDate);
					}
					break;
				case 'daily':
					if (event.weekdays.length === 0 || event.weekdays.includes(currentDate.toLocaleString('en-US', { weekday: 'long' }))) {
						addOccurrence(currentDate);
					}
					break;
				case 'weekly':
					if (event.weekdays.length === 0) {
						const startDate = new Date(event.eventDate);
						const daysDifference = Math.floor((currentDate - startDate) / (1000 * 60 * 60 * 24));
						if (daysDifference % 7 === 0) {
							addOccurrence(currentDate);
						}
					} else if (event.weekdays.includes(currentDate.toLocaleString('en-US', { weekday: 'long' }))) {
						addOccurrence(currentDate);
					}
					break;
				case 'monthly(same date)':
					if (event.eventDate.split('-')[2] === String(currentDate.getDate()).padStart(2, '0')) {
						addOccurrence(currentDate);
					}
					break;
				case 'monthly(same weekday)':
					if (event.weekdays.includes(currentDate.toLocaleString('en-US', { weekday: 'long' })) && new Date(event.eventDate).getDate() <= currentDate.getDate()) {
						addOccurrence(currentDate);
					}
					break;
			}
		}

		return nextOccurrences;
	};

	$: filteredEvents = (selectedCategory === "All"
		? events.flatMap(getNextOccurrences)
		: events.filter((e) => e.category === selectedCategory).flatMap(getNextOccurrences))
		.sort((a, b) => {
		const dateA = new Date(`${a.eventDate} ${a.eventTime}`);
		const dateB = new Date(`${b.eventDate} ${b.eventTime}`);
		if (dateA < dateB) return -1;
		if (dateA > dateB) return 1;
		return a.title.localeCompare(b.title);
	});

	const categories = ["All", ...new Set(events.map(e => e.category))];

	const splitDateAndTime = (dateStr: string, timeStr: string) => {
		const [hour, minutePart] = timeStr.split(':');
		const [minute, ampm] = minutePart.split(' ');
		let hours = parseInt(hour);
		if (ampm === 'PM' && hours !== 12) hours += 12;
		if (ampm === 'AM' && hours === 12) hours = 0;
		const date = new Date(dateStr);
		date.setHours(hours, parseInt(minute));
		const formattedTime = `${(hours % 12 || 12).toString().padStart(2, '0')}:${minute} ${ampm}`;
		const formattedDate = date.toLocaleDateString();
		const weekday = date.toLocaleString('en-US', { weekday: 'long' });
		return { eventDate: formattedDate, time: formattedTime, full: date, weekday };
	};

	const getCalendarLinks = (event) => {
		const { full: start } = splitDateAndTime(event.eventDate, event.eventTime);
		const end = new Date(start.getTime() + 60 * 60 * 1000); // +1 hour
		const format = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");

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
	};
</script>

<main>
	<h1>GoPai</h1>

	<select bind:value={selectedCategory} style="margin-bottom: 20px;">
		{#each categories as category}
			<option value={category}>{category}</option>
		{/each}
	</select>

	<div class="event-container">
		{#each filteredEvents as event, index}
			<div class="event" on:click={() => toggle(index)}>
				<strong>{splitDateAndTime(event.eventDate, event.eventTime).weekday}, {splitDateAndTime(event.eventDate, event.eventTime).eventDate} {splitDateAndTime(event.eventDate, event.eventTime).time}</strong> - {event.title}
				{#if openIndex === index}
					<div class="details">
						<p>{event.details}</p>
						<p><strong>Location:</strong> <a href={event.location.link} target="_blank">{event.location.name}</a></p>
						<p><strong>Frequency:</strong> {event.frequency} {event.weekdays?.length ? `on ${event.weekdays.join(', ')}` : ''}</p>
						<div style="margin-top: 10px;">
							<a href={getCalendarLinks(event).apple} target="_blank"><img src="https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg" alt="Apple" width="16" height="16" /> Add to Apple Calendar</a><br>
							<a href={getCalendarLinks(event).google} target="_blank"><img src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Google_2015_logo.svg/2560px-Google_2015_logo.svg.png" alt="Google" width="16" height="16" /> Add to Google Calendar</a>
						</div>
					</div>
				{/if}
			</div>
		{/each}
	</div>
</main>

<style>
	body {
		margin: 0;
		font-family: system-ui, sans-serif;
		color: white;
		background: #111;
	}

	main {
		padding: 2rem;
		text-align: center;
	}

	h1 {
		font-size: 3rem;
		margin-bottom: 1rem;
		background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
		background-size: 400% 400%;
		animation: gradient 10s ease infinite;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	select {
		padding: 0.5rem;
		font-size: 1rem;
		margin-bottom: 1rem;
	}

	.event-container {
		max-width: 600px;
		margin: 0 auto;
	}

	.event {
		background: rgba(255,255,255,0.05);
		border: 1px solid rgba(255,255,255,0.1);
		border-radius: 12px;
		padding: 1rem;
		margin-bottom: 1rem;
		cursor: pointer;
	}

	.event:hover {
		background: rgba(255,255,255,0.1);
	}

	.details {
		margin-top: 0.5rem;
		text-align: left;
	}

	a {
		color: #90cdf4;
		text-decoration: none;
	}

	a:hover {
		text-decoration: underline;
	}

	@keyframes gradient {
		0% {background-position: 0% 50%;}
		50% {background-position: 100% 50%;}
		100% {background-position: 0% 50%;}
	}
</style>