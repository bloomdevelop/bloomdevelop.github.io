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

function startIntro(intro: HTMLElement) {
	const canvas = intro.querySelector<HTMLCanvasElement>("[data-intro-canvas]");
	const veil = intro.querySelector<HTMLElement>("[data-intro-veil]");
	const brand = intro.querySelector<HTMLElement>("[data-intro-brand]");

	if (!canvas) {
		veil?.remove();
		return;
	}

	const colors = readPalette(intro);
	const surface = readColor(intro, "--surface", [255, 255, 255]);
	const sprites = createSprites(colors);
	const webgl = createWebGLRenderer(canvas, sprites);
	const ctx = webgl ? null : canvas.getContext("2d", { alpha: true });

	if (!webgl && !ctx) {
		veil?.remove();
		return;
	}

	const introCanvas = webgl?.canvas ?? canvas;
	const introContext = ctx as CanvasRenderingContext2D;
	document.documentElement.dataset.intro = "running";
	const random = makeRandom(Date.now() ^ (Math.random() * 0xffffffff));
	const heroes = createHeroes(random);
	const specks = createSpecks(random);
	const dprScale = () => Math.min(window.devicePixelRatio || 1, 1.5);

	let width = 0;
	let height = 0;
	let dpr = 1;
	let finished = false;
	let frame = 0;
	let start = performance.now();
	let revealStarted = false;
	let brandRemoved = false;
	let glow: CanvasGradient;
	const failsafe = window.setTimeout(() => finish(), 5000);

	function resize() {
		width = window.innerWidth;
		height = window.innerHeight;
		dpr = dprScale();
		introCanvas.width = Math.max(1, Math.round(width * dpr));
		introCanvas.height = Math.max(1, Math.round(height * dpr));
		introCanvas.style.width = `${width}px`;
		introCanvas.style.height = `${height}px`;
		if (webgl) {
			webgl.resize(width, height, dpr);
		} else {
			introContext.setTransform(dpr, 0, 0, dpr, 0, 0);
			glow = introContext.createRadialGradient(
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
		}
		layoutHeroes(heroes);
	}

	function paint(now: number) {
		const elapsed = Math.max(0, now - start);
		if (!revealStarted && elapsed >= REVEAL_AT) {
			revealStarted = true;
			document.documentElement.dataset.intro = "revealing";
		}
		if (!brandRemoved && elapsed >= BRAND_OUT_AT) {
			brandRemoved = true;
			brand?.remove();
		}
		if (webgl) {
			paintWebGL(elapsed);
			return;
		}
		introContext?.clearRect(0, 0, width, height);

		if (!finished) {
			paintBackground(elapsed);
			paintBurst(elapsed);
		} else {
			paintAmbient(elapsed);
		}
	}

	function paintWebGL(elapsed: number) {
		webgl?.clear();
		if (!finished) {
			const alpha = backgroundAlpha(elapsed);
			if (alpha > 0)
				webgl?.background(
					width,
					height,
					surface,
					colors.coral,
					colors.gold,
					alpha,
				);
			const burstElapsed = elapsed - BURST_AT;
			if (burstElapsed > 0) {
				for (const hero of heroes) {
					const local = (burstElapsed - hero.delay) / hero.duration;
					if (local <= 0) continue;
					const p = easeOutCubic(Math.min(1, local));
					const softness = smoothstep(0.38, 1, p);
					const startSize = Math.max(18, hero.size * 0.035);
					const size = startSize + (hero.size - startSize) * p;
					const x = width / 2 + (hero.x - width / 2) * p;
					const y = height / 2 + (hero.y - height / 2) * p;
					const rotation =
						hero.rotation -
						hero.spins * TAU * (1 - easeOutQuart(Math.min(1, local)));
					const alpha = hero.alpha * smoothstep(0, 0.1, p);
					const colorIndex = paletteIndex(hero.color);
					if (softness < 1)
						webgl?.sprite(
							colorIndex * 6 + hero.variant,
							x,
							y,
							size,
							rotation,
							alpha * (1 - softness),
						);
					if (softness > 0)
						webgl?.sprite(
							colorIndex * 6 + 2 + hero.variant,
							x,
							y,
							size,
							rotation,
							alpha * softness,
						);
				}
				for (const speck of specks) {
					const local = (burstElapsed - speck.delay) / speck.duration;
					if (local <= 0 || local >= 1) continue;
					const p = easeOutCubic(local);
					const distance = speck.distance * p;
					const x = width / 2 + Math.cos(speck.angle) * distance;
					const y =
						height / 2 +
						Math.sin(speck.angle) * distance * 0.82 +
						Math.sin(p * Math.PI) * speck.drift;
					const alpha =
						smoothstep(0, 0.08, local) *
						(1 - smoothstep(0.62, 1, local)) *
						speck.alpha;
					if (alpha <= 0.005) continue;
					const colorIndex = paletteIndex(speck.color);
					const sprite =
						speck.shape === "dot"
							? 30
							: colorIndex * 6 +
								(speck.shape === "flower"
									? 0
									: speck.shape === "sparkle"
										? 5
										: 4);
					webgl?.sprite(
						sprite,
						x,
						y,
						speck.size,
						speck.rotation + speck.spin * p,
						alpha,
						speck.shape === "dot" ? colors[speck.color] : undefined,
					);
				}
			}
		} else {
			for (const hero of heroes) {
				const drift = Math.sin(
					elapsed * 0.00014 + hero.anchorX * 9 + hero.anchorY * 5,
				);
				const size = hero.size * (1 + drift * 0.006);
				const y = hero.y + Math.cos(elapsed * 0.00011 + hero.anchorY * 8) * 3;
				webgl?.sprite(
					paletteIndex(hero.color) * 6 + 2 + hero.variant,
					hero.x,
					y,
					size,
					hero.rotation + drift * 0.012,
					hero.alpha,
				);
			}
		}
		webgl?.flush();
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
			smoothstep(0, 0.08, local) *
			(1 - smoothstep(0.62, 1, local)) *
			speck.alpha;

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
			introContext.drawImage(
				image,
				-speck.size / 2,
				-speck.size / 2,
				speck.size,
				speck.size,
			);
		}

		introContext.restore();
	}

	function paintAmbient(elapsed: number) {
		for (const hero of heroes) {
			const drift = Math.sin(
				elapsed * 0.00014 + hero.anchorX * 9 + hero.anchorY * 5,
			);
			const size = hero.size * (1 + drift * 0.006);
			introContext.globalAlpha = hero.alpha;
			introContext.save();
			introContext.translate(
				hero.x,
				hero.y + Math.cos(elapsed * 0.00011 + hero.anchorY * 8) * 3,
			);
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
		if (now - start >= DONE_AT) {
			finish();
			return;
		}
		paint(now);
		frame = requestAnimationFrame(loop);
	}

	resize();
	paint(start);
	intro.dataset.playing = "true";
	veil?.remove();
	frame = requestAnimationFrame(loop);

	window.addEventListener("resize", () => {
		resize();
		paint(performance.now());
	});
}

interface WebGLRenderer {
	canvas: HTMLCanvasElement;
	resize(width: number, height: number, dpr: number): void;
	clear(): void;
	background(
		width: number,
		height: number,
		surface: Rgb,
		coral: Rgb,
		gold: Rgb,
		alpha: number,
	): void;
	sprite(
		index: number,
		x: number,
		y: number,
		size: number,
		rotation: number,
		alpha: number,
		tint?: Rgb,
	): void;
	flush(): void;
}

const PALETTE_ORDER: PaletteName[] = [
	"coral",
	"blue",
	"green",
	"violet",
	"gold",
];
const ATLAS_CELL = 384;
const ATLAS_COLUMNS = 6;
const ATLAS_ROWS = 6;
const SPRITE_VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec2 a_uv;
attribute float a_alpha;
attribute vec3 a_tint;
uniform vec2 u_viewport;
varying vec2 v_uv;
varying float v_alpha;
varying vec3 v_tint;
void main() {
  vec2 clip = vec2(a_position.x / u_viewport.x * 2.0 - 1.0, 1.0 - a_position.y / u_viewport.y * 2.0);
  gl_Position = vec4(clip, 0.0, 1.0);
  v_uv = a_uv;
  v_alpha = a_alpha;
  v_tint = a_tint;
}`;
const SPRITE_FRAGMENT_SHADER = `
precision mediump float;
uniform sampler2D u_texture;
varying vec2 v_uv;
varying float v_alpha;
varying vec3 v_tint;
void main() {
  vec4 texel = texture2D(u_texture, v_uv);
  gl_FragColor = vec4(texel.rgb * v_tint, texel.a * v_alpha);
}`;
const BACKGROUND_VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_uv = a_position * 0.5 + 0.5;
}`;
const BACKGROUND_FRAGMENT_SHADER = `
precision mediump float;
uniform vec2 u_resolution;
uniform vec3 u_surface;
uniform vec3 u_coral;
uniform vec3 u_gold;
uniform float u_alpha;
uniform float u_radial;
varying vec2 v_uv;
void main() {
  if (u_radial < 0.5) {
    gl_FragColor = vec4(u_surface, u_alpha);
  } else {
    float radius = length((v_uv - 0.5) * u_resolution) / (max(u_resolution.x, u_resolution.y) * 0.7);
    float blend = smoothstep(0.0, 0.55, radius);
    float fade = 1.0 - smoothstep(0.55, 1.0, radius);
    vec3 color = mix(u_coral, u_gold, blend);
    float opacity = mix(0.24, 0.08, blend) * fade * u_alpha * 0.8;
    gl_FragColor = vec4(color, opacity);
  }
}`;

function paletteIndex(color: PaletteName) {
	return PALETTE_ORDER.indexOf(color);
}

function createWebGLRenderer(
	fallbackCanvas: HTMLCanvasElement,
	sprites: Record<PaletteName, Sprites>,
): WebGLRenderer | null {
	const canvas = document.createElement("canvas");
	canvas.setAttribute("data-intro-canvas", "");
	const options = {
		alpha: true,
		antialias: false,
		premultipliedAlpha: true,
		preserveDrawingBuffer: true,
	};
	const webgl2 = canvas.getContext(
		"webgl2",
		options,
	) as WebGL2RenderingContext | null;
	const gl = (webgl2 ||
		canvas.getContext("webgl", options)) as WebGLRenderingContext;
	if (!gl) return null;

	try {
		const spriteProgramResult = createProgram(
			gl,
			SPRITE_VERTEX_SHADER,
			SPRITE_FRAGMENT_SHADER,
			!!webgl2,
		);
		const backgroundProgramResult = createProgram(
			gl,
			BACKGROUND_VERTEX_SHADER,
			BACKGROUND_FRAGMENT_SHADER,
			!!webgl2,
		);
		if (!spriteProgramResult || !backgroundProgramResult) return null;
		const spriteProgram = spriteProgramResult as WebGLProgram;
		const backgroundProgram = backgroundProgramResult as WebGLProgram;
		const atlas = document.createElement("canvas");
		atlas.width = ATLAS_CELL * ATLAS_COLUMNS;
		atlas.height = ATLAS_CELL * ATLAS_ROWS;
		const atlasContext = atlas.getContext("2d");
		if (!atlasContext) return null;
		for (let colorIndex = 0; colorIndex < PALETTE_ORDER.length; colorIndex++) {
			const color = PALETTE_ORDER[colorIndex];
			const entries = [
				sprites[color].flowers[0],
				sprites[color].flowers[1],
				sprites[color].softFlowers[0],
				sprites[color].softFlowers[1],
				sprites[color].petal,
				sprites[color].sparkle,
			];
			for (let spriteIndex = 0; spriteIndex < entries.length; spriteIndex++) {
				atlasContext.drawImage(
					entries[spriteIndex],
					(spriteIndex % ATLAS_COLUMNS) * ATLAS_CELL,
					colorIndex * ATLAS_CELL,
					ATLAS_CELL,
					ATLAS_CELL,
				);
			}
		}
		atlasContext.fillStyle = "white";
		atlasContext.beginPath();
		atlasContext.arc(
			ATLAS_CELL * 0.5,
			ATLAS_CELL * 5.5,
			ATLAS_CELL * 0.24,
			0,
			TAU,
		);
		atlasContext.fill();
		const texture = gl.createTexture();
		const spriteBuffer = gl.createBuffer();
		const backgroundBuffer = gl.createBuffer();
		if (!texture || !spriteBuffer || !backgroundBuffer) return null;
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
		gl.bindBuffer(gl.ARRAY_BUFFER, backgroundBuffer);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
			gl.STATIC_DRAW,
		);
		fallbackCanvas.style.display = "none";
		fallbackCanvas.after(canvas);
		const data = new Float32Array(64 * 6 * 9);
		let cursor = 0;
		let viewportWidth = 1;
		let viewportHeight = 1;
		gl.enable(gl.BLEND);
		gl.blendFuncSeparate(
			gl.SRC_ALPHA,
			gl.ONE_MINUS_SRC_ALPHA,
			gl.ONE,
			gl.ONE_MINUS_SRC_ALPHA,
		);

		function background(
			width: number,
			height: number,
			surface: Rgb,
			coral: Rgb,
			gold: Rgb,
			alpha: number,
		) {
			gl.useProgram(backgroundProgram);
			gl.bindBuffer(gl.ARRAY_BUFFER, backgroundBuffer);
			const position = gl.getAttribLocation(backgroundProgram, "a_position");
			gl.enableVertexAttribArray(position);
			gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
			gl.uniform2f(
				gl.getUniformLocation(backgroundProgram, "u_resolution"),
				width,
				height,
			);
			gl.uniform3f(
				gl.getUniformLocation(backgroundProgram, "u_surface"),
				...(surface.map((channel) => channel / 255) as [
					number,
					number,
					number,
				]),
			);
			gl.uniform3f(
				gl.getUniformLocation(backgroundProgram, "u_coral"),
				...(lighten(coral, 0.72).map((channel) => channel / 255) as [
					number,
					number,
					number,
				]),
			);
			gl.uniform3f(
				gl.getUniformLocation(backgroundProgram, "u_gold"),
				...(lighten(gold, 0.66).map((channel) => channel / 255) as [
					number,
					number,
					number,
				]),
			);
			gl.uniform1f(gl.getUniformLocation(backgroundProgram, "u_alpha"), alpha);
			gl.uniform1f(gl.getUniformLocation(backgroundProgram, "u_radial"), 0);
			gl.drawArrays(gl.TRIANGLES, 0, 6);
			gl.uniform1f(gl.getUniformLocation(backgroundProgram, "u_radial"), 1);
			gl.drawArrays(gl.TRIANGLES, 0, 6);
		}

		function sprite(
			index: number,
			x: number,
			y: number,
			size: number,
			rotation: number,
			alpha: number,
			tint: Rgb = [255, 255, 255],
		) {
			if (alpha <= 0.005 || cursor + 54 > data.length) return;
			const column = index % ATLAS_COLUMNS;
			const row = Math.floor(index / ATLAS_COLUMNS);
			const u0 = (column * ATLAS_CELL + 1) / atlas.width;
			const u1 = ((column + 1) * ATLAS_CELL - 1) / atlas.width;
			const v0 = 1 - (row * ATLAS_CELL + 1) / atlas.height;
			const v1 = 1 - ((row + 1) * ATLAS_CELL - 1) / atlas.height;
			const cosine = Math.cos(rotation);
			const sine = Math.sin(rotation);
			const half = size / 2;
			const corners = [
				[-half, -half, u0, v0],
				[half, -half, u1, v0],
				[-half, half, u0, v1],
				[-half, half, u0, v1],
				[half, -half, u1, v0],
				[half, half, u1, v1],
			];
			for (const [localX, localY, u, v] of corners) {
				data[cursor++] = x + localX * cosine - localY * sine;
				data[cursor++] = y + localX * sine + localY * cosine;
				data[cursor++] = u;
				data[cursor++] = v;
				data[cursor++] = alpha;
				data[cursor++] = tint[0] / 255;
				data[cursor++] = tint[1] / 255;
				data[cursor++] = tint[2] / 255;
				data[cursor++] = 0;
			}
		}

		function flush() {
			if (!cursor) return;
			gl.useProgram(spriteProgram);
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.activeTexture(gl.TEXTURE0);
			gl.uniform1i(gl.getUniformLocation(spriteProgram, "u_texture"), 0);
			gl.uniform2f(
				gl.getUniformLocation(spriteProgram, "u_viewport"),
				viewportWidth,
				viewportHeight,
			);
			gl.bindBuffer(gl.ARRAY_BUFFER, spriteBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, cursor), gl.DYNAMIC_DRAW);
			const stride = 9 * Float32Array.BYTES_PER_ELEMENT;
			for (const [name, count, offset] of [
				["a_position", 2, 0],
				["a_uv", 2, 2],
				["a_alpha", 1, 4],
				["a_tint", 3, 5],
			] as const) {
				const location = gl.getAttribLocation(spriteProgram, name);
				gl.enableVertexAttribArray(location);
				gl.vertexAttribPointer(
					location,
					count,
					gl.FLOAT,
					false,
					stride,
					offset * Float32Array.BYTES_PER_ELEMENT,
				);
			}
			gl.drawArrays(gl.TRIANGLES, 0, cursor / 9);
			cursor = 0;
		}

		return {
			canvas,
			resize(width: number, height: number, dpr: number) {
				viewportWidth = width;
				viewportHeight = height;
				canvas.width = Math.max(1, Math.round(width * dpr));
				canvas.height = Math.max(1, Math.round(height * dpr));
				gl.viewport(0, 0, canvas.width, canvas.height);
			},
			clear() {
				cursor = 0;
				gl.clearColor(0, 0, 0, 0);
				gl.clear(gl.COLOR_BUFFER_BIT);
			},
			background,
			sprite,
			flush,
		};
	} catch {
		return null;
	}
}

function createProgram(
	gl: WebGLRenderingContext,
	vertexSource: string,
	fragmentSource: string,
	webgl2: boolean,
) {
	const vertex = createShader(gl, gl.VERTEX_SHADER, vertexSource, webgl2);
	const fragment = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource, webgl2);
	if (!vertex || !fragment) return null;
	const program = gl.createProgram();
	if (!program) return null;
	gl.attachShader(program, vertex);
	gl.attachShader(program, fragment);
	gl.linkProgram(program);
	return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null;
}

function createShader(
	gl: WebGLRenderingContext,
	type: number,
	source: string,
	webgl2: boolean,
) {
	const shader = gl.createShader(type);
	if (!shader) return null;
	if (webgl2) {
		source = source
			.replace(/\battribute\b/g, "in")
			.replace(/\bvarying\b/g, type === gl.VERTEX_SHADER ? "out" : "in")
			.replace(/\btexture2D\b/g, "texture")
			.replace(/\bgl_FragColor\b/g, "fragmentColor");
		if (type === gl.FRAGMENT_SHADER) {
			source = `#version 300 es\n${source.replace("precision mediump float;", "precision mediump float;\nout vec4 fragmentColor;")}`;
		} else {
			source = `#version 300 es\n${source}`;
		}
	}
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
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
		Pick<
			Hero,
			"color" | "anchorX" | "anchorY" | "sizeRatio" | "rotation" | "variant"
		>
	> = [
		{
			color: "coral",
			anchorX: -0.045,
			anchorY: -0.08,
			sizeRatio: 0.4,
			rotation: -0.55,
			variant: 0,
		},
		{
			color: "violet",
			anchorX: 1.035,
			anchorY: -0.1,
			sizeRatio: 0.43,
			rotation: 0.6,
			variant: 1,
		},
		{
			color: "blue",
			anchorX: 1.08,
			anchorY: 0.47,
			sizeRatio: 0.3,
			rotation: 1.1,
			variant: 0,
		},
		{
			color: "green",
			anchorX: 0.01,
			anchorY: 1.04,
			sizeRatio: 0.46,
			rotation: -1.4,
			variant: 1,
		},
		{
			color: "coral",
			anchorX: 0.98,
			anchorY: 1.02,
			sizeRatio: 0.36,
			rotation: 0.35,
			variant: 1,
		},
		{
			color: "gold",
			anchorX: -0.06,
			anchorY: 0.54,
			sizeRatio: 0.26,
			rotation: 0.9,
			variant: 0,
		},
		{
			color: "blue",
			anchorX: 0.6,
			anchorY: -0.04,
			sizeRatio: 0.21,
			rotation: -0.9,
			variant: 1,
		},
	];

	const colorOrder = [...PALETTE_ORDER];
	for (let index = colorOrder.length - 1; index > 0; index--) {
		const other = Math.floor(random() * (index + 1));
		[colorOrder[index], colorOrder[other]] = [
			colorOrder[other],
			colorOrder[index],
		];
	}

	return specs.map((spec, index) => ({
		...spec,
		color: colorOrder[index % colorOrder.length],
		anchorX: spec.anchorX + (random() - 0.5) * 0.18,
		anchorY: spec.anchorY + (random() - 0.5) * 0.18,
		sizeRatio: spec.sizeRatio * (0.8 + random() * 0.4),
		rotation: random() * TAU,
		variant: random() < 0.5 ? 0 : 1,
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
	const shapes: Speck["shape"][] = [
		"petal",
		"petal",
		"petal",
		"sparkle",
		"flower",
		"dot",
	];
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
			size:
				(shape === "flower" ? 28 : 13) +
				random() * (shape === "flower" ? 34 : 30),
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
	probe.style.cssText =
		"position:absolute;visibility:hidden;pointer-events:none";
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
	const parseContext = parseCanvas.getContext("2d", {
		willReadFrequently: true,
	});

	if (!parseContext) {
		return fallback;
	}

	parseContext.fillStyle = color;
	parseContext.fillRect(0, 0, 1, 1);
	const [red, green, blue, alpha] = parseContext.getImageData(0, 0, 1, 1).data;
	return alpha > 0 ? [red, green, blue] : fallback;
}

function createSprites(
	colors: Record<PaletteName, Rgb>,
): Record<PaletteName, Sprites> {
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

function makeFlower(
	color: Rgb,
	centerColor: Rgb,
	petalCount: number,
	angleOffset: number,
) {
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

const root = document.querySelector<HTMLElement>("[data-component='intro']");

if (root && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
	startIntro(root);
}
