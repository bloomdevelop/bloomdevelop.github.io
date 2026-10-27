type Rgb = [number, number, number];

type PaletteName = "coral" | "blue" | "green" | "violet" | "gold";

interface Hero {
	color: PaletteName;
	anchorX: number;
	anchorY: number;
	sizeRatio: number;
	rotation: number;
	variant: 0 | 1;
	delay: number;
	duration: number;
	spins: number;
	alpha: number;
	x: number;
	y: number;
	size: number;
}

interface Speck {
	shape: "petal" | "flower" | "sparkle" | "dot";
	color: PaletteName;
	angle: number;
	distance: number;
	delay: number;
	duration: number;
	size: number;
	rotation: number;
	spin: number;
	alpha: number;
	drift: number;
}

interface Sprites {
	flowers: [HTMLCanvasElement, HTMLCanvasElement];
	softFlowers: [HTMLCanvasElement, HTMLCanvasElement];
	petal: HTMLCanvasElement;
	sparkle: HTMLCanvasElement;
}

const TAU = Math.PI * 2;
const BURST_AT = 360;
const REVEAL_AT = 720;
const BRAND_OUT_AT = 1300;
const DONE_AT = 2050;

const root = document.querySelector<HTMLElement>("[data-component='intro']");

if (root && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
	startIntro(root);
}

function startIntro(intro: HTMLElement) {
	const canvas = intro.querySelector<HTMLCanvasElement>("[data-intro-canvas]");
	const veil = intro.querySelector<HTMLElement>("[data-intro-veil]");
	const brand = intro.querySelector<HTMLElement>("[data-intro-brand]");
	const ctx = canvas?.getContext("2d", { alpha: true });

	if (!canvas || !ctx) {
		veil?.remove();
		return;
	}

	const introCanvas = canvas;
	const introContext = ctx;
	const failsafe = window.setTimeout(() => finish(), 5000);
	document.documentElement.dataset.intro = "running";

	const colors = readPalette(intro);
	const surface = readColor(intro, "--surface", [255, 255, 255]);
	const sprites = createSprites(colors);
	const random = makeRandom(Date.now() ^ (Math.random() * 0xffffffff));
	const heroes = createHeroes(random);
	const specks = createSpecks(random);
	const dprScale = () => Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 2 : 1.5);

	let width = 0;
	let height = 0;
	let dpr = 1;
	let finished = false;
	let frame = 0;
	let start = performance.now();

	const timers = [
		window.setTimeout(() => {
			document.documentElement.dataset.intro = "revealing";
		}, REVEAL_AT),
		window.setTimeout(() => {
			brand?.remove();
		}, BRAND_OUT_AT),
		window.setTimeout(() => finish(), DONE_AT),
	];

	function resize() {
		width = window.innerWidth;
		height = window.innerHeight;
		dpr = dprScale();
		introCanvas.width = Math.max(1, Math.round(width * dpr));
		introCanvas.height = Math.max(1, Math.round(height * dpr));
		introCanvas.style.width = `${width}px`;
		introCanvas.style.height = `${height}px`;
		introContext.setTransform(dpr, 0, 0, dpr, 0, 0);
		layoutHeroes(heroes);
	}

	function paint(now: number) {
		const elapsed = Math.max(0, now - start);
		introContext.clearRect(0, 0, width, height);

		if (!finished) {
			paintBackground(elapsed);
			paintBurst(elapsed);
		} else {
			paintAmbient(elapsed);
		}
	}

	function paintBackground(elapsed: number) {
		const alpha = backgroundAlpha(elapsed);

		if (alpha <= 0) {
			return;
		}

		introContext.save();
		introContext.globalAlpha = alpha;
		introContext.fillStyle = rgba(surface, 1);
		introContext.fillRect(0, 0, width, height);

		const glow = introContext.createRadialGradient(
			width / 2,
			height / 2,
			0,
			width / 2,
			height / 2,
			Math.max(width, height) * 0.7,
		);
		glow.addColorStop(0, rgba(lighten(colors.coral, 0.72), 0.24));
		glow.addColorStop(0.55, rgba(lighten(colors.gold, 0.66), 0.08));
		glow.addColorStop(1, rgba(surface, 0));
		introContext.globalAlpha = alpha * 0.8;
		introContext.fillStyle = glow;
		introContext.fillRect(0, 0, width, height);
		introContext.restore();
	}

	function paintBurst(elapsed: number) {
		const burstElapsed = elapsed - BURST_AT;

		if (burstElapsed > 0) {
			introContext.save();
			for (const hero of heroes) {
				paintHero(hero, burstElapsed);
			}
			for (const speck of specks) {
				paintSpeck(speck, burstElapsed);
			}
			introContext.restore();
		}
	}

	function paintHero(hero: Hero, burstElapsed: number) {
		const local = (burstElapsed - hero.delay) / hero.duration;

		if (local <= 0) {
			return;
		}

		const p = easeOutCubic(Math.min(1, local));
		const softness = smoothstep(0.38, 1, p);
		const startSize = Math.max(18, hero.size * 0.035);
		const size = startSize + (hero.size - startSize) * p;
		const x = width / 2 + (hero.x - width / 2) * p;
		const y = height / 2 + (hero.y - height / 2) * p;
		const rotation =
			hero.rotation - hero.spins * TAU * (1 - easeOutQuart(Math.min(1, local)));
		const alpha = hero.alpha * smoothstep(0, 0.1, p);
		const image = sprites[hero.color].flowers[hero.variant];

		introContext.globalAlpha = alpha;
		introContext.translate(x, y);
		introContext.rotate(rotation);

		if (softness < 1) {
			introContext.globalAlpha = alpha * (1 - softness);
			introContext.drawImage(image, -size / 2, -size / 2, size, size);
		}
		if (softness > 0) {
			introContext.globalAlpha = alpha * softness;
			introContext.drawImage(
				sprites[hero.color].softFlowers[hero.variant],
				-size / 2,
				-size / 2,
				size,
				size,
			);
		}

		introContext.setTransform(dpr, 0, 0, dpr, 0, 0);
	}

	function paintSpeck(speck: Speck, burstElapsed: number) {
		const local = (burstElapsed - speck.delay) / speck.duration;

		if (local <= 0) {
			return;
		}

		if (local >= 1) {
			return;
		}

		const p = easeOutCubic(local);
		const distance = speck.distance * p;
		const x = width / 2 + Math.cos(speck.angle) * distance;
		const y =
			height / 2 +
			Math.sin(speck.angle) * distance * 0.82 +
			Math.sin(p * Math.PI) * speck.drift;
		const visible =
			smoothstep(0, 0.08, local) * (1 - smoothstep(0.62, 1, local)) * speck.alpha;

		if (visible <= 0.005) {
			return;
		}

		introContext.save();
		introContext.translate(x, y);
		introContext.rotate(speck.rotation + speck.spin * p);
		introContext.globalAlpha = visible;

		if (speck.shape === "dot") {
			introContext.fillStyle = rgba(colors[speck.color], 1);
			introContext.beginPath();
			introContext.arc(0, 0, speck.size * 0.23, 0, TAU);
			introContext.fill();
		} else {
			let image: HTMLCanvasElement;
			if (speck.shape === "flower") {
				image = sprites[speck.color].flowers[0];
			} else if (speck.shape === "sparkle") {
				image = sprites[speck.color].sparkle;
			} else {
				image = sprites[speck.color].petal;
			}
			introContext.drawImage(image, -speck.size / 2, -speck.size / 2, speck.size, speck.size);
		}

		introContext.restore();
	}

	function paintAmbient(elapsed: number) {
		for (const hero of heroes) {
			const drift = Math.sin(elapsed * 0.00014 + hero.anchorX * 9 + hero.anchorY * 5);
			const size = hero.size * (1 + drift * 0.006);
			introContext.globalAlpha = hero.alpha;
			introContext.save();
			introContext.translate(hero.x, hero.y + Math.cos(elapsed * 0.00011 + hero.anchorY * 8) * 3);
			introContext.rotate(hero.rotation + drift * 0.012);
			introContext.drawImage(
				sprites[hero.color].softFlowers[hero.variant],
				-size / 2,
				-size / 2,
				size,
				size,
			);
			introContext.restore();
		}
		introContext.globalAlpha = 1;
	}

	function finish() {
		if (finished) {
			return;
		}

		finished = true;
		window.clearTimeout(failsafe);
		for (const timer of timers) {
			window.clearTimeout(timer);
		}

		document.documentElement.dataset.intro = "done";
		introCanvas.style.zIndex = "0";
		brand?.remove();
		veil?.remove();
		intro.removeAttribute("data-playing");
		intro.dataset.ambient = "true";
		cancelAnimationFrame(frame);
		start = performance.now() - DONE_AT;
		paint(performance.now());
	}

	function loop(now: number) {
		paint(now);
		if (!finished) {
			frame = requestAnimationFrame(loop);
		}
	}

	resize();
	layoutHeroes(heroes);
	paint(start);
	intro.dataset.playing = "true";
	veil?.remove();
	frame = requestAnimationFrame(loop);

	window.addEventListener("resize", () => {
		resize();
		paint(performance.now());
	});
}

function backgroundAlpha(elapsed: number) {
	if (elapsed <= 950) {
		return 1;
	}
	if (elapsed >= 1850) {
		return 0;
	}
	return 1 - smoothstep(950, 1850, elapsed);
}

function layoutHeroes(heroes: Hero[]) {
	const width = window.innerWidth;
	const height = window.innerHeight;
	const maxDimension = Math.max(width, height);
	const portraitScale = width < 620 ? 0.86 : 1;

	for (const hero of heroes) {
		hero.x = width * hero.anchorX;
		hero.y = height * hero.anchorY;
		hero.size = Math.min(maxDimension * hero.sizeRatio * portraitScale, 940);
	}
}

function createHeroes(random: () => number): Hero[] {
	const specs: Array<
		Pick<Hero, "color" | "anchorX" | "anchorY" | "sizeRatio" | "rotation" | "variant">
	> = [
		{ color: "coral", anchorX: -0.045, anchorY: -0.08, sizeRatio: 0.4, rotation: -0.55, variant: 0 },
		{ color: "violet", anchorX: 1.035, anchorY: -0.1, sizeRatio: 0.43, rotation: 0.6, variant: 1 },
		{ color: "blue", anchorX: 1.08, anchorY: 0.47, sizeRatio: 0.3, rotation: 1.1, variant: 0 },
		{ color: "green", anchorX: 0.01, anchorY: 1.04, sizeRatio: 0.46, rotation: -1.4, variant: 1 },
		{ color: "coral", anchorX: 0.98, anchorY: 1.02, sizeRatio: 0.36, rotation: 0.35, variant: 1 },
		{ color: "gold", anchorX: -0.06, anchorY: 0.54, sizeRatio: 0.26, rotation: 0.9, variant: 0 },
		{ color: "blue", anchorX: 0.6, anchorY: -0.04, sizeRatio: 0.21, rotation: -0.9, variant: 1 },
	];

	return specs.map((spec, index) => ({
		...spec,
		delay: index * 34 + random() * 90,
		duration: 980 + random() * 280,
		spins: (random() < 0.5 ? -1 : 1) * (0.3 + random() * 0.5),
		alpha: 0.37 + random() * 0.05,
		x: 0,
		y: 0,
		size: 0,
	}));
}

function createSpecks(random: () => number): Speck[] {
	const colors: PaletteName[] = ["coral", "blue", "green", "violet", "gold"];
	const shapes: Speck["shape"][] = ["petal", "petal", "petal", "sparkle", "flower", "dot"];
	const count = window.innerWidth < 620 ? 30 : 48;
	const maxDimension = Math.max(window.innerWidth, window.innerHeight);

	return Array.from({ length: count }, (_, index) => {
		const shape = shapes[Math.floor(random() * shapes.length)];
		return {
			shape,
			color: colors[Math.floor(random() * colors.length)],
			angle: random() * TAU,
			distance: maxDimension * (0.48 + random() * 0.48),
			delay: index * 2.6 + random() * 120,
			duration: 900 + random() * 420,
			size: (shape === "flower" ? 28 : 13) + random() * (shape === "flower" ? 34 : 30),
			rotation: random() * TAU,
			spin: (random() < 0.5 ? -1 : 1) * (1.2 + random() * 3.4),
			alpha: 0.42 + random() * 0.38,
			drift: (random() - 0.5) * 90,
		};
	});
}

function readPalette(element: HTMLElement): Record<PaletteName, Rgb> {
	return {
		coral: readColor(element, "--intro-coral", [255, 164, 111]),
		blue: readColor(element, "--intro-blue", [24, 130, 252]),
		green: readColor(element, "--intro-green", [56, 187, 98]),
		violet: readColor(element, "--intro-violet", [70, 65, 217]),
		gold: readColor(element, "--intro-gold", [210, 154, 2]),
	};
}

function readColor(element: HTMLElement, variable: string, fallback: Rgb): Rgb {
	const probe = document.createElement("span");
	probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none";
	probe.style.color = `var(${variable})`;
	element.append(probe);
	const color = getComputedStyle(probe).color;
	probe.remove();
	return parseColor(color, fallback);
}

function parseColor(color: string, fallback: Rgb): Rgb {
	const parseCanvas = document.createElement("canvas");
	parseCanvas.width = 1;
	parseCanvas.height = 1;
	const parseContext = parseCanvas.getContext("2d", { willReadFrequently: true });

	if (!parseContext) {
		return fallback;
	}

	parseContext.fillStyle = color;
	parseContext.fillRect(0, 0, 1, 1);
	const [red, green, blue, alpha] = parseContext.getImageData(0, 0, 1, 1).data;
	return alpha > 0 ? [red, green, blue] : fallback;
}

function createSprites(colors: Record<PaletteName, Rgb>): Record<PaletteName, Sprites> {
	const entries = Object.entries(colors) as Array<[PaletteName, Rgb]>;
	const result = {} as Record<PaletteName, Sprites>;

	for (const [name, color] of entries) {
		const flowers: [HTMLCanvasElement, HTMLCanvasElement] = [
			makeFlower(color, colors.gold, 6, 0),
			makeFlower(color, colors.gold, 7, 0.16),
		];

		result[name] = {
			flowers,
			softFlowers: [soften(flowers[0]), soften(flowers[1])],
			petal: makePetal(color),
			sparkle: makeSparkle(color),
		};
	}

	return result;
}

function makeFlower(color: Rgb, centerColor: Rgb, petalCount: number, angleOffset: number) {
	const canvas = document.createElement("canvas");
	canvas.width = 512;
	canvas.height = 512;
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		return canvas;
	}

	ctx.translate(256, 256);

	for (let index = 0; index < petalCount; index++) {
		const angle = angleOffset + (index / petalCount) * TAU;
		ctx.save();
		ctx.rotate(angle);
		const gradient = ctx.createLinearGradient(0, -8, 0, -206);
		gradient.addColorStop(0, rgba(lighten(color, 0.52), 0.98));
		gradient.addColorStop(0.55, rgba(lighten(color, 0.08), 0.97));
		gradient.addColorStop(1, rgba(color, 0.68));
		ctx.fillStyle = gradient;
		ctx.beginPath();
		ctx.moveTo(0, -8);
		ctx.bezierCurveTo(48, -48, 88, -144, 0, -198);
		ctx.bezierCurveTo(-88, -144, -48, -48, 0, -8);
		ctx.closePath();
		ctx.fill();
		ctx.restore();
	}

	const center = ctx.createRadialGradient(0, 0, 1, 0, 0, 42);
	center.addColorStop(0, rgba(lighten(centerColor, 0.82), 1));
	center.addColorStop(0.58, rgba(lighten(centerColor, 0.58), 0.94));
	center.addColorStop(1, rgba(color, 0.42));
	ctx.fillStyle = center;
	ctx.beginPath();
	ctx.arc(0, 0, 41, 0, TAU);
	ctx.fill();

	return canvas;
}

function makePetal(color: Rgb) {
	const canvas = document.createElement("canvas");
	canvas.width = 256;
	canvas.height = 256;
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		return canvas;
	}

	ctx.translate(128, 128);
	const gradient = ctx.createLinearGradient(0, 104, 0, -118);
	gradient.addColorStop(0, rgba(lighten(color, 0.55), 0.96));
	gradient.addColorStop(0.55, rgba(lighten(color, 0.1), 0.98));
	gradient.addColorStop(1, rgba(color, 0.84));
	ctx.fillStyle = gradient;
	ctx.beginPath();
	ctx.moveTo(0, 120);
	ctx.bezierCurveTo(57, 52, 56, -68, 0, -122);
	ctx.bezierCurveTo(-56, -68, -57, 52, 0, 120);
	ctx.closePath();
	ctx.fill();
	return canvas;
}

function makeSparkle(color: Rgb) {
	const canvas = document.createElement("canvas");
	canvas.width = 256;
	canvas.height = 256;
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		return canvas;
	}

	ctx.translate(128, 128);
	const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 118);
	gradient.addColorStop(0, rgba(lighten(color, 0.65), 1));
	gradient.addColorStop(0.55, rgba(lighten(color, 0.25), 0.96));
	gradient.addColorStop(1, rgba(color, 0.56));
	ctx.fillStyle = gradient;
	ctx.beginPath();
	ctx.moveTo(0, -118);
	ctx.quadraticCurveTo(12, -16, 118, 0);
	ctx.quadraticCurveTo(12, 16, 0, 118);
	ctx.quadraticCurveTo(-12, 16, -118, 0);
	ctx.quadraticCurveTo(-12, -16, 0, -118);
	ctx.closePath();
	ctx.fill();
	return canvas;
}

function soften(source: HTMLCanvasElement) {
	const canvas = document.createElement("canvas");
	canvas.width = source.width;
	canvas.height = source.height;
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		return canvas;
	}
	ctx.filter = "blur(13px)";
	ctx.drawImage(source, 0, 0);
	return canvas;
}

function makeRandom(seed: number) {
	let value = seed >>> 0;
	return () => {
		value += 0x6d2b79f5;
		let result = value;
		result = Math.imul(result ^ (result >>> 15), result | 1);
		result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
		return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
	};
}

function lighten([red, green, blue]: Rgb, amount: number): Rgb {
	return [
		Math.round(red + (255 - red) * amount),
		Math.round(green + (255 - green) * amount),
		Math.round(blue + (255 - blue) * amount),
	];
}

function rgba([red, green, blue]: Rgb, alpha: number) {
	return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function smoothstep(start: number, end: number, value: number) {
	const position = Math.min(1, Math.max(0, (value - start) / (end - start)));
	return position * position * (3 - 2 * position);
}

function easeOutCubic(value: number) {
	return 1 - (1 - value) ** 3;
}

function easeOutQuart(value: number) {
	return 1 - (1 - value) ** 4;
}
