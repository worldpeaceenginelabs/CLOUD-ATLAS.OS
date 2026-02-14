<script>
	export let avatar;
	export let title;
	export let content;
	export let href;
	export let target;
	export let color;
	export let categorypic;
	export let categorytext;
</script>


{#if href}
<a href="{href}" target="{target}">
	<div class='card' style:background-color={color}>
		<img class="avatar" src="{avatar}" alt="{title}">
		<h2>{title}</h2>
		<p>{@html content}</p>
		<div class="category">
			{#if categorypic}
			<img width="20px" height="20px" src="{categorypic}" alt="{categorytext}">
			{/if}
			{#if categorytext}
			<p style:font-weight="bold">{categorytext}</p>
			{/if}
		</div>
	</div>
</a>
{:else}
<div class='card' style:background-color={color}>
	<img class="avatar" src="{avatar}" alt="{title}">
	<h2>{title}</h2>
	<p>{@html content}</p>
	<div class="category">
		{#if categorypic}
		<img width="20px" height="20px" src="{categorypic}" alt="{categorytext}">
		{/if}
		{#if categorytext}
		<p style:font-weight="bold">{categorytext}</p>
		{/if}
	</div>
</div>
{/if}


<style>
	.category {
		text-align: right;
	}

	.card {
		
		position: relative;
		margin: 0.5em;
		padding: 0.5em 0.5em 0.5em 6em;
		border: 1px solid #eee;
		border-radius: 4px;
		box-shadow: 2px 2px 4px rgba(0,0,0,0.1);
		min-height: 5em;
	}

	.card::after {
		clear: both;
		display: block;
	}

	.avatar {
		position: absolute;
		width: 5em;
		height: 5em;
		left: 0.5em;
		top: 0.5em;
		background: no-repeat 50% 50%;
		background-size: cover;
		border: 0px;
	}

	h2 {
		color: black;
		margin: 0 0 0.5em 0;
		font-size: 16px;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
        'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;           
	}

	p {
		color: black;
		margin: 0 0 0.5em 0;
		font-size: 14px;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
        'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
	}

	a { text-decoration: none; }

</style>