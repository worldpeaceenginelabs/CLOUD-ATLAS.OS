<script>
	let current = 'start';

	const states = {
		start: {
			center: 'NEXT',
			top: 'OFFER',
			right: '',
			bottom: 'SEARCH',
			left: '',

			transitions: {
				center: 'missions',
				top: 'offer',
				bottom: 'search'
			}
		},

		missions: {
			center: 'ANYMATCH',
			top: 'MISSION 3\nOMNIPEDIA',
			right: 'MISSION 4\nCONSERVATION',
			bottom: 'MISSION 1\nMISSIONTV',
			left: 'MISSION 2\nSWARMGOVERNANCE',
			transitions: {
				center: 'start'
			}
		},

		offer: {
			center: 'ABORT',
			top: 'OFFER',
			right: 'LISTINGS',
			bottom: 'SEARCH',
			left: 'LIVE',
			active: 'top',
			transitions: {
				center: 'start',
				left: 'live',
				right: 'offerForm'
			}
		},

		search: {
			center: 'ABORT',
			top: 'OFFER',
			right: 'LISTINGS',
			bottom: 'SEARCH',
			left: 'LIVE',
			active: 'bottom',
			transitions: {
				center: 'start',
				left: 'live',
				right: 'searchFilter'
			}
		},

		live: {
			center: 'ABORT',
			top: 'OFFER',
			right: 'LISTINGS',
			bottom: 'SEARCH',
			left: 'LIVE',
			active: 'left',
			transitions: {
				center: 'start'
			}
		},

		offerForm: {
			center: 'SUBMIT',
			centerSecondary: 'ABORT',
			top: 'LOCATION',
			right: 'DETAIL',
			bottom: 'ANYPAY',
			left: 'TOOL',
			transitions: {
				center: 'start'
			}
		},

		searchFilter: {
			center: 'SEARCH',
			centerSecondary: 'ABORT',
			top: 'LOCATION',
			right: '',
			bottom: 'ANYPAY',
			left: 'TOOL',
			transitions: {
				center: 'start'
			}
		}
	};

	$: ui = states[current];

	function go(direction) {
		const next = ui.transitions?.[direction];
		if (next) current = next;
	}

	// -------------------------
	// RICH HARRIS STYLE: ACTION
	// -------------------------
	function draggable(node) {
	let x = 50;
	let y = 50;

	let startX, startY;
	let startClientX = 0;
	let startClientY = 0;
	let dragging = false;

	function update() {
		node.style.left = `${x}vw`;
		node.style.top = `${y}vh`;
	}

	function onCapture(e) {
		const dx = e.clientX - startClientX;
		const dy = e.clientY - startClientY;

		if (dx * dx + dy * dy > 16) {
			e.stopPropagation();
		}
	}

	function onDown(e) {
		dragging = true;

		startClientX = e.clientX;
		startClientY = e.clientY;

		startX = x;
		startY = y;

		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
	}

	function onMove(e) {
		if (!dragging) return;

		const dx = e.clientX - startClientX;
		const dy = e.clientY - startClientY;

		x = startX + (dx / window.innerWidth) * 100;
		y = startY + (dy / window.innerHeight) * 100;

		update();
	}

	function onUp() {
		dragging = false;

		window.removeEventListener('pointermove', onMove);
		window.removeEventListener('pointerup', onUp);
	}

	node.addEventListener('pointerdown', onDown);
	node.addEventListener('click', onCapture, true);

	update();

	return {
		destroy() {
			node.removeEventListener('pointerdown', onDown);
			node.removeEventListener('click', onCapture, true);
		}
	};
}
</script>

<!-- PURE DECLARATIVE UI -->
<div class="radialWrapper" use:draggable>
	<div class="radial">

		{#if ui.top}
			<button class="sector top" class:active={ui.active === 'top'} on:click={() => go('top')}>
				<span>{ui.top}</span>
			</button>
		{/if}

		{#if ui.right}
			<button class="sector right" class:active={ui.active === 'right'} on:click={() => go('right')}>
				<span>{ui.right}</span>
			</button>
		{/if}

		{#if ui.bottom}
			<button class="sector bottom" class:active={ui.active === 'bottom'} on:click={() => go('bottom')}>
				<span>{ui.bottom}</span>
			</button>
		{/if}

		{#if ui.left}
			<button class="sector left" class:active={ui.active === 'left'} on:click={() => go('left')}>
				<span>{ui.left}</span>
			</button>
		{/if}

		<button class="center" on:click={() => go('center')}>
			<div>{ui.center}</div>

			{#if ui.centerSecondary}
				<small>{ui.centerSecondary}</small>
			{/if}
		</button>

	</div>
</div>

<style>
	.radialWrapper {
		position: fixed;
		transform: translate(-50%, -50%);
		cursor: grab;
		user-select: none;
		touch-action: none;
		z-index: 1000;
	}

	.radialWrapper:active {
		cursor: grabbing;
	}

	.radial {
		position: relative;
		width: 500px;
		height: 500px;
	}

	.sector {
		position: absolute;
		width: 180px;
		height: 180px;
		border: 2px solid #444;
		background: #161616;
		color: white;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: 0.2s;
	}

	.sector:hover {
		border-color: #888;
	}

	.sector span {
		transform: rotate(-45deg);
		font-weight: 600;
		letter-spacing: 1px;
	}

	.top { top: 30px; left: 160px; transform: rotate(45deg); }
	.right { top: 160px; right: 30px; transform: rotate(45deg); }
	.bottom { bottom: 30px; left: 160px; transform: rotate(45deg); }
	.left { top: 160px; left: 30px; transform: rotate(45deg); }

	.center {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 170px;
		height: 170px;
		transform: translate(-50%, -50%);
		border-radius: 50%;
		border: 3px solid #666;
		background: #111;
		color: white;
		cursor: pointer;

		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;

		font-size: 1.1rem;
		font-weight: 700;
	}

	.center small {
		color: #ff6666;
		font-size: 0.8rem;
		font-weight: 600;
	}

	.active {
		background: #0d2918;
		border-color: #00ff88;
		box-shadow: 0 0 24px rgba(0, 255, 136, 0.25);
	}
</style>