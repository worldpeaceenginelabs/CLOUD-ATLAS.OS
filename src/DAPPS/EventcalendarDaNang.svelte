<script lang="ts">
	let events = [
		// DAILY (specific weekdays)
		{
			eventDate: "2025-04-08",
			eventTime: "10:00 AM",
			title: "🧘‍♀️ Free YOGA BEACH TRIBE Class – Find Your Zen! 🌊",
			details: "Join us DAILY for a FREE yoga class where you can stretch, relax, and connect with your inner peace. 🧘‍♂️💫 This is a great chance to unwind, improve your flexibility, and meet like-minded people in a beautiful, peaceful environment. 🧘‍♀️  What to bring? Yoga mat, but a towel works as well on the sand (or go mat-free and toughen up like a pro 😝) Come as you are! Come ready to relax, stretch, and flow. Who’s in? 👇",
			location: { name: "Công viên Sao Biển Beach", link: "https://maps.app.goo.gl/XREbFP8pjKX9tqZY6" },
			category: "Yoga",
			frequency: "daily",
			weekdays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
		},

		// WEEKLY
		{
			eventDate: "2025-04-13",
			eventTime: "6:00 PM",
			title: "🤤 EAT LIKE A LOCAL 🍲🍴",
			details: "Tired of touristy restaurants? Join us a few times per week for an authentic local food experience! We’re hitting up a hidden gem where a local grandma cooks the best, freshest, realest food you can get. No menus, just a spread of delicious home-cooked dishes – buffet style! Check out the pics below – this is the kind of food we’ll be enjoying! 🍛 🛑 No menus ✅ Depending on the location, we will either enjoy a buffet-style feast or order together and share, just like the locals do 🔥 Grandma’s cooking at its finest 💸 30,000 - 50.000 VND max! 📍 Where? Secret local spots (shared before we go) ⏰ When? a few times per week Come hungry, leave happy. Who’s in? 👇",
			location: { name: "TÂY HỒ QUÁN", link: "https://maps.app.goo.gl/rxveR11i8ipk7361A" },
			category: "Food",
			frequency: "weekly",
			weekdays: []
		},

		{
			eventDate: "2025-04-13",
			eventTime: "3:00 PM",
			title: "🌍 MUNDO LINGO 🗣️",
			details: "A place where people from all over the world come together, grab their language stickers at the door, and dive into a fun, laid-back evening. The stickers make it easy-peasy to approach anyone—just spot your languages and start chatting! Whether you're here to practice, teach, or just have a good time, everyone’s welcome! Come for the languages, stay for the connections. See you there! 🚀✨",
			location: { name: "GỐM Garden Coffee", link: "https://maps.app.goo.gl/ZHpdB9kkHw5A3jD6A" },
			category: "Meetup",
			frequency: "weekly",
			weekdays: []
		},

		{
			eventDate: "2025-04-08",
			eventTime: "7:00 PM",
			title: "💻 The Weekly HACKATHON 🚀",
			details: "Every Tuesday, we’re kicking off Da Nang’s ultimate hack night—code, create, and collaborate in a chill, beer-fueled atmosphere. Whether you’re a coding wizard or just curious, this is the place to be. 💥 The challenge? Build an app—useful, fun, weird… whatever! You can: ✅ Hack along with Bo, who’ll be sharing Cloud Atlas OS, a community-owned Google Maps that runs without servers. Whatever you imagine, we can bring it to a worldwide audience at zero cost. ✅ Work on your own genius idea ✅ Team up and jam on something crazy ✅ Or just hang out, have a drink, and absorb the vibes ⚡ Got a wild AI, Web3, or hacker project in mind? Drop it in the chat—we might make it happen! Bring your laptop, grab a drink, and let’s build some next-level sh*t. 🚀🔥 Who’s in? 👇",
			location: { name: " Icon Rooftop Restaurant - Danang Riverside", link: "https://maps.app.goo.gl/eQh7ge1hreRR7cMc7" },
			category: "Meetup",
			frequency: "weekly",
			weekdays: []
		},

		{
			eventDate: "2025-04-09",
			eventTime: "4:00 PM",
			title: "🌍 THE NETWORK 🌱🔗",
			details: "🌟 Welcome to The Network – A Global Networking Community with Hostless Local Meetings! 🌟 No matter what question, problem, or issue you have, there is a 99% chance that someone had already been through it and figured it out. That willingness to help each other is the best part of The Network. This beautiful and authentic event, born in Lisbon - Europe’s digital nomad haven - is now connecting solo travelers, digital nomads, and entrepreneurs across cities worldwide! ❤️🎉🙏 🌍 Goal: Empowering Connections & Cultivating Opportunities 🚀 🔗 Expand your professional and social network 💡 Exchange ideas, skills & opportunities 📚 Learn from each other's experiences 🔎 Explore new places with like-minded people 🤝 Networking Opportunities: ✅ Collaborate and share insights ✅ Forge valuable connections ✅ Grow Your Network What to Expect: Casual and Hostless: No formal hosts or schedules - just show up, meet fellow solo travelers, and decide as a group where the adventure takes you! Open to Everyone: Whether you’re a local or just passing through, all are welcome to join. How It Works: Arrive at the meeting spot at the scheduled time. Look for fellow The Network participants (🥷) - friendly faces and curious adventurers! Jump in—introduce yourself, ask for help, or offer your expertise! 🚀 Decide as a group where to host yourself. (for instance we tried every week another location, sometimes bars, sometimes restaurants, sometimes a nice place in a park or on a beach, having BBQ. The possibilities are endless) ✨ Let’s make solo travel social, one city at a time. ✨ 🔗 Connect with us and let's grow together! 🌱",
			location: { name: "Mia Food and Drink", link: "https://maps.app.goo.gl/yjarfNHnNCY9beM6A" },
			category: "Meetup",
			frequency: "weekly",
			weekdays: []
		},

		{
			eventDate: "2025-04-11",
			eventTime: "9:30 PM",
			title: "🍹 FREE COMMUNITY EVENT: DANANG BAR CRAWL! 🍹",
			details: "Location-independence doesn\'t just mean working from anywhere—it means LIVING and CONNECTING from anywhere too! Break Outwards is excited to partner with our sister company Bar Crawl Tours to bring you a FREE community-building event that perfectly aligns with our mission of creating meaningful connections through unique experiences. 🌟 WHY JOIN US? This isn\'t just another tourist bar hop—it's a carefully curated journey through Da Nang\'s vibrant nightlife where authentic connections happen naturally. Whether you\'re a digital nomad, expat, traveler, or local resident, this event brings diverse people together in a fun, safe environment. ✨ WHAT\'S INCLUDED (ALL FREE!): Entry to 4 iconic venues across Da Nang 1 complimentary drink at each location Expert guides who know the city intimately Built-in community of like-minded adventurers An experience that goes beyond the typical \"digital nomad meetup\" 🕘 THE ROUTE & SCHEDULE: 9:30 PM: The Craft Rooftop (Meeting Point) @danangrooftop 10:30 PM: Hair of the Dog @HairOfTheDogClubDaNang 11:30 PM: Karma @karmahousedanang 12:30 AM: Nuna @nunaclublounge 📍 STARTING LOCATION: The Craft Rooftop Tầng thượng, 1B Đ. Lê Duẩn, Hải Châu 1, Hải Châu, Đà Nẵng 550000, Vietnam 🔍 IMPORTANT NOTES: Drinking is 100% OPTIONAL — Many attendees come just for the social experience! Arrive around 9:30 PM; crawl leaves frist stop at approximately 10:30 PM First come, first served Transportation between venues is self-arranged ( we walk ) This event embodies the Break Outwards philosophy that curiosity is our currency and the world is our office—even after work hours! It\'s about expanding your comfort zone and creating connections that enrich your location-independent lifestyle. Tag someone who needs a night out or come solo and leave with new friends! #BreakOutwards #BarCrawlTours #DaNangNightlife #CommunityFirst #DigitalNomadLife #LocationIndependence Follow both @breakoutwards and @BarCrawlTours for more community events! Bar Crawl Tours: https://vlnk.one/@bct Break Outwards: https://vlnk.one/@BrkOut",
			location: { name: "Da Nang Rooftop - Craft Beer", link: "https://maps.app.goo.gl/R4Ts2EKb549qWsdp9" },
			category: "Meetup",
			frequency: "weekly",
			weekdays: []
		},

		{
			eventDate: "2025-04-11",
			eventTime: "7:30 PM",
			title: "🍹 Nomad night 🍹",
			details: "Our meet up on Friday night 🥰 🌍 Danang Nomad Night – – Connect, Share & Chill! 🎱✨ Looking for a fun way to meet fellow digital nomads, remote workers, and entrepreneurs in Danang? Join Danang Nomad Night—your weekly Friday evening meetup to network, share ideas, and have fun! 📍 Where? Garden by Bottega5, 42 Ngô Thì Sỹ 🕢 When? Every Friday at 7:30 PM Whether you’re new in town or a seasoned traveler, this is the perfect space to exchange experiences, find collaborations, and make new friends in a relaxed, friendly atmosphere. Grab a drink, play some pool, and enjoy great conversations with an amazing international crowd. ✅ No sign-up needed—just show up! For more details, contact Hana: +84972490977 See you there! 🚀 https://maps.app.goo.gl/79NvhUd3nmoskYr47?g_st=ic Event organized by Hana ( Hana’s Coworking )❤️",
			location: { name: "Garden by Bottega5", link: "https://maps.app.goo.gl/YuWZweu9bYz9QZpP9" },
			category: "Meetup",
			frequency: "weekly",
			weekdays: []
		},

		{
			eventDate: "2025-04-12",
			eventTime: "3:30 PM",
			title: "🌴 Saturday Beach Chill & Volleyball 🌴",
			details: "Kick off your sandals and join us for an afternoon of fun, friends, and a bit of friendly competition! From volleyball to badminton, frisbee to beach games, there’s something for everyone. Whether you’re new in town or a regular, come to unwind, play, and recharge after a week of hard work. Stick around to soak up the sunset vibes with great company! Bring a friend, some snacks, or just yourself – everyone’s welcome! 🏖 Feel free to contact Hana if you want to know more details. WhatsApp or Zalo +84972490977 🗓 Saturday ⏰ 3:30 PM 📍 https://maps.app.goo.gl/6A1ft7ZmSqxs7BnY6?g_st=ic Everyone is welcome. 🤗 https://chat.whatsapp.com/EuCffKTX3LD3vUcIVRyeai",
			location: { name: "Công viên Sao Biển Beach", link: "https://maps.app.goo.gl/6A1ft7ZmSqxs7BnY6?g_st=ic" },
			category: "Meetup",
			frequency: "weekly",
			weekdays: []
		},
		
		{
	eventDate: "2025-04-12",
	eventTime: "11:30 AM",
	title: "✨ Rebirthing Breathwork ✨",
	details: "✨ Rebirthing Breathwork workshop Sundays in Hoi An @11.30 am.\n✨\nIf you’ve been feeling stuck in your head, holding tension in your chest, or just low on energy lately — come breathe with me.\n\nThis is a space to reset your nervous system, release what’s been quietly building inside, and reconnect to that calm, clear version of yourself that’s always been there underneath.\n\nIt’s not about pushing or performing. It’s about softening back into your body and letting the breath do what it knows how to do.\n\nWe use conscious connected breathing to move stress hormones, regulate the vagus nerve, and open space inside for presence, creativity, and deeper rest.\n\nNo experience needed — just bring water, an eye mask if you want, and a willingness to feel.",
	location: { name: "Epic Rejuvenation Spa", link: "https://maps.app.goo.gl/HpNeTtb7fBpQ2Pet6" },
	category: "Breathwork",
	frequency: "weekly",
	weekdays: []
},

{
	eventDate: "2025-04-15",
	eventTime: "7:00 PM",
	title: "🍹 Weekly Digital Nomad Meetup (Hostless) 🎉",
	details: "Calling all digital nomads, remote workers, and business builders!\n\nMy Casa will be hosting our Digital Nomad Meetup this Friday! Come to connect with other like-minded people living in or passing through Da Nang City.\n\nWhether you’re working as a freelancer, running your own business, or just curious to learn what others are up to — come join us.\n\nSee you all next week!",
	location: { name: "Section 30", link: "https://maps.app.goo.gl/Afr8u8zvZJKhDKGf7" },
	category: "Meetup",
	frequency: "weekly",
	weekdays: []
},

{
	eventDate: "2025-04-19",
	eventTime: "9:30 AM",
	title: "🌿 Kambo Healing Session 🌿",
	details: "Kambo is a holistic detoxification medicine which allows you to embrace healing, release stuck emotions, regenerate cells, overcome anxiety, boost your energy and immune system, and detox the body. 🌱",
	location: { name: "Feel called? Connect with the host.", link: "https://wa.me/79186502014" },
	category: "Plant Medicine",
	frequency: "weekly",
	weekdays: []
},

{
	eventDate: "2025-04-20",
	eventTime: "8:00 AM",
	title: "💪 Calisthenics Group Sessions on the Beach",
	details: "Hi everyone! My name is Andoni, I'm a personal trainer with experience in calisthenics (I'm also a life coach).\n\nEvery Monday, Wednesday and Friday, I organize a calisthenics group workout session. The workout is based on technique and resistance/reps.\n\n💪 Level: All levels are welcome! I will adapt the workout taking into account the members and their abilities.\n⏳ Duration: 1 hour sessions\n📍 Where: workout beach area\nhttps://maps.app.goo.gl/ZowXX7qhm6yN4NW99?g_st=ic\n😃 What to bring: open mind and smile!\n\n🏷️ Price:\n1 session: 350.000 VND\n2 sessions: 600.000 VND\n3 sessions: 800.000 VND\n\n🤝 1 to 1 SESSIONS AVAILABLE for people that want to go to the next level in their fitness journey.\n\nPlease send me a short message if you are in or have any questions.\n\nHave a great week!",
	location: { name: "Training spot on the beach", link: "https://maps.app.goo.gl/QS96f16sT4G1ZsUZ6?g_st=iw" },
	category: "Calisthenics",
	frequency: "daily",
	weekdays: ["Monday", "Wednesday", "Friday"]
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
	<h1>GoDaNang</h1>

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