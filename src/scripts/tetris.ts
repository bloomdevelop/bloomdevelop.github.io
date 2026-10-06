type Mode = "easy" | "master" | "shirase";
type PieceType = "I" | "O" | "T" | "S" | "Z" | "J" | "L";
type Cell = PieceType | "mono" | null;
type Matrix = number[][];
type GameStatus = "ready" | "playing" | "paused" | "over" | "clear";
type Action =
	| "left"
	| "right"
	| "down"
	| "rotate-cw"
	| "rotate-ccw"
	| "hard-drop"
	| "hold";

interface Piece {
	type: PieceType;
	matrix: Matrix;
	rotation: number;
	x: number;
	y: number;
	lockMs: number;
	lockResets: number;
	activeFrames: number;
	softFrames: number;
	sonicDistance: number;
}

interface RepeatInput {
	action: Action;
	nextAt: number;
	interval: number;
}

const WIDTH = 10;
const HEIGHT = 20;
const CELL_SIZE = 32;
const FRAME_MS = 1000 / 60;
const PIECE_TYPES: PieceType[] = ["I", "O", "T", "S", "Z", "J", "L"];
const SHAPES: Record<PieceType, Matrix> = {
	I: [
		[0, 0, 0, 0],
		[1, 1, 1, 1],
		[0, 0, 0, 0],
		[0, 0, 0, 0],
	],
	O: [
		[1, 1],
		[1, 1],
	],
	T: [
		[0, 1, 0],
		[1, 1, 1],
		[0, 0, 0],
	],
	S: [
		[0, 1, 1],
		[1, 1, 0],
		[0, 0, 0],
	],
	Z: [
		[1, 1, 0],
		[0, 1, 1],
		[0, 0, 0],
	],
	J: [
		[1, 0, 0],
		[1, 1, 1],
		[0, 0, 0],
	],
	L: [
		[0, 0, 1],
		[1, 1, 1],
		[0, 0, 0],
	],
};

const JLSTZ_KICKS: Record<string, Array<[number, number]>> = {
	"0>1": [
		[0, 0],
		[-1, 0],
		[-1, -1],
		[0, 2],
		[-1, 2],
	],
	"1>0": [
		[0, 0],
		[1, 0],
		[1, 1],
		[0, -2],
		[1, -2],
	],
	"1>2": [
		[0, 0],
		[1, 0],
		[1, 1],
		[0, -2],
		[1, -2],
	],
	"2>1": [
		[0, 0],
		[-1, 0],
		[-1, -1],
		[0, 2],
		[-1, 2],
	],
	"2>3": [
		[0, 0],
		[1, 0],
		[1, -1],
		[0, 2],
		[1, 2],
	],
	"3>2": [
		[0, 0],
		[-1, 0],
		[-1, 1],
		[0, -2],
		[-1, -2],
	],
	"3>0": [
		[0, 0],
		[-1, 0],
		[-1, 1],
		[0, -2],
		[-1, -2],
	],
	"0>3": [
		[0, 0],
		[1, 0],
		[1, -1],
		[0, 2],
		[1, 2],
	],
};
const I_KICKS: Record<string, Array<[number, number]>> = {
	"0>1": [
		[0, 0],
		[-2, 0],
		[1, 0],
		[-2, 1],
		[1, -2],
	],
	"1>0": [
		[0, 0],
		[2, 0],
		[-1, 0],
		[2, -1],
		[-1, 2],
	],
	"1>2": [
		[0, 0],
		[-1, 0],
		[2, 0],
		[-1, -2],
		[2, 1],
	],
	"2>1": [
		[0, 0],
		[1, 0],
		[-2, 0],
		[1, 2],
		[-2, -1],
	],
	"2>3": [
		[0, 0],
		[2, 0],
		[-1, 0],
		[2, -1],
		[-1, 2],
	],
	"3>2": [
		[0, 0],
		[-2, 0],
		[1, 0],
		[-2, 1],
		[1, -2],
	],
	"3>0": [
		[0, 0],
		[1, 0],
		[-2, 0],
		[1, 2],
		[-2, -1],
	],
	"0>3": [
		[0, 0],
		[-1, 0],
		[2, 0],
		[-1, -2],
		[2, 1],
	],
};

const EASY_GRAVITY: Array<[number, number]> = [
	[0, 4],
	[8, 5],
	[19, 6],
	[35, 8],
	[40, 10],
	[50, 12],
	[60, 16],
	[70, 32],
	[80, 48],
	[90, 64],
	[101, 16],
	[112, 48],
	[121, 80],
	[132, 128],
	[144, 112],
	[156, 144],
	[167, 176],
	[177, 192],
	[200, 5120],
];
const MASTER_GRAVITY: Array<[number, number]> = [
	[0, 1024],
	[30, 1536],
	[35, 2048],
	[40, 2560],
	[50, 3072],
	[60, 4096],
	[70, 8192],
	[80, 12288],
	[90, 16384],
	[100, 20480],
	[120, 24576],
	[140, 28672],
	[160, 32768],
	[170, 36864],
	[200, 1024],
	[220, 8192],
	[230, 16384],
	[233, 24576],
	[236, 32768],
	[239, 40960],
	[243, 49152],
	[247, 57344],
	[251, 65536],
	[300, 131072],
	[330, 196608],
	[360, 262144],
	[400, 327680],
	[420, 262144],
	[450, 196608],
	[500, 1310720],
];
const GRADE_NAMES = [
	"9",
	"8",
	"7",
	"6",
	"5",
	"4",
	"3",
	"2",
	"1",
	"S1",
	"S2",
	"S3",
	"S4",
	"S5",
	"S6",
	"S7",
	"S8",
	"S9",
	"m1",
	"m2",
	"m3",
	"m4",
	"m5",
	"m6",
	"m7",
	"m8",
	"m9",
	"MASTER",
	"MASTER K",
	"MASTER V",
	"MASTER O",
	"MASTER M",
	"GRAND MASTER",
];
const GRADE_BASE_POINTS = [
	[10, 20, 40, 50],
	[10, 20, 30, 40],
	[10, 20, 30, 40],
	[10, 15, 30, 40],
	[10, 15, 20, 40],
	[5, 15, 20, 30],
	[5, 10, 20, 30],
	[5, 10, 15, 30],
	[5, 10, 15, 30],
	[5, 10, 15, 30],
	[2, 12, 13, 30],
	[2, 12, 13, 30],
	[2, 12, 13, 30],
	[2, 12, 13, 30],
	[2, 12, 13, 30],
	[2, 12, 13, 30],
	[2, 12, 13, 30],
	[2, 12, 13, 30],
	[2, 12, 13, 30],
	[2, 12, 13, 30],
	[2, 12, 13, 30],
	[2, 12, 13, 30],
	[2, 12, 13, 30],
	[2, 12, 13, 30],
	[2, 12, 13, 30],
	[2, 12, 13, 30],
	[2, 12, 13, 30],
	[2, 12, 13, 30],
	[2, 12, 13, 30],
	[2, 12, 13, 30],
	[2, 12, 13, 30],
	[2, 12, 13, 30],
];
const COMBO_MULTIPLIERS = [
	[1, 1, 1, 1],
	[1, 1.2, 1.4, 1.5],
	[1, 1.2, 1.5, 1.8],
	[1, 1.4, 1.6, 2],
	[1, 1.4, 1.7, 2.2],
	[1, 1.4, 1.8, 2.3],
	[1, 1.4, 1.9, 2.4],
	[1, 1.5, 2, 2.5],
	[1, 1.5, 2.1, 2.6],
	[1, 2, 2.5, 3],
];
const GRADE_DECAY_FRAMES = [
	125, 80, 80, 50, 45, 45, 45, 40, 40, 40, 40, 40, 30, 30, 30, 20, 20, 20, 20,
	15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 10, 10, 10,
];
const MASTER_COOL_TIMES = [52, 52, 49, 45, 45, 42, 42, 38, 38];
const MASTER_REGRET_TIMES = [90, 75, 75, 68, 60, 60, 50, 50, 50, 50];

const main = document.querySelector<HTMLElement>('[data-component="tetris"]');
if (main) {
	const get = <T extends HTMLElement>(selector: string): T => {
		const element = main.querySelector<T>(selector);
		if (!element) throw new Error(`Missing Tetris element: ${selector}`);
		return element;
	};
	const boardCanvas = get<HTMLCanvasElement>("#game-board");
	const holdCanvas = get<HTMLCanvasElement>("#hold-preview");
	const levelElement = get<HTMLElement>("#level-value");
	const linesElement = get<HTMLElement>("#lines-value");
	const timeElement = get<HTMLElement>("#time-value");
	const scoreElement = get<HTMLElement>("#score-value");
	const comboElement = get<HTMLElement>("#combo-value");
	const gradeElement = get<HTMLElement>("#grade-value");
	const gradeCaption = get<HTMLElement>(".grade-caption");
	const gradeMeter = get<HTMLElement>("#grade-meter-fill");
	const sectionElement = get<HTMLElement>("#section-value");
	const coolElement = get<HTMLElement>("#cool-value");
	const overlay = get<HTMLElement>("#game-overlay");
	const startButton = get<HTMLButtonElement>("#start-button");
	const messageElement = get<HTMLElement>("#game-message");
	const nextCanvases = [0, 1, 2].map((index) =>
		get<HTMLCanvasElement>(`#next-preview-${index}`),
	);
	const modeButtons = Array.from(
		main.querySelectorAll<HTMLButtonElement>("[data-mode]"),
	);
	const touchButtons = Array.from(
		main.querySelectorAll<HTMLButtonElement>("[data-action]"),
	);
	const boardContext = boardCanvas?.getContext("2d");
	const holdContext = holdCanvas?.getContext("2d");
	const nextContexts = nextCanvases.map(
		(canvas) => canvas?.getContext("2d") ?? null,
	);

	if (
		boardCanvas &&
		boardContext &&
		holdCanvas &&
		holdContext &&
		levelElement &&
		linesElement &&
		timeElement &&
		scoreElement &&
		comboElement &&
		gradeElement &&
		gradeCaption &&
		gradeMeter &&
		sectionElement &&
		coolElement &&
		overlay &&
		startButton &&
		messageElement &&
		nextCanvases.every(Boolean)
	) {
		let mode: Mode = "master";
		let status: GameStatus = "ready";
		let board = createBoard();
		let queue: PieceType[] = [];
		let bag: PieceType[] = [];
		let current: Piece | null = null;
		let heldPiece: PieceType | null = null;
		let canHold = true;
		let level = 0;
		let lines = 0;
		let score = 0;
		let combo = 0;
		let totalTimeMs = 0;
		let sectionStartMs = 0;
		let gravityProgress = 0;
		let gradeRank = 0;
		let gradePoints = 0;
		let gradeDecayProgress = 0;
		let coolCount = 0;
		let sectionCoolReady = false;
		let regretCount = 0;
		let hanabi = 0;
		let risingCounter = 0;
		let creditRoll = false;
		let creditRollMs = 0;
		let spawnDelayMs = 0;
		let clearFlashMs = 0;
		let lastFrame = 0;
		let messageUntil = 0;
		let currentMessage = "Good luck :)";
		let visibleTime = -1;
		const repeatInputs = new Map<string, RepeatInput>();
		const tileMap = new Image();
		tileMap.src = "/tilemaps/colormaps.png";
		tileMap.addEventListener("load", render);

		function createBoard(): Cell[][] {
			return Array.from({ length: HEIGHT + 1 }, () =>
				Array<Cell>(WIDTH).fill(null),
			);
		}

		function cloneMatrix(matrix: Matrix): Matrix {
			return matrix.map((row) => [...row]);
		}

		function rotateMatrix(matrix: Matrix, clockwise: boolean): Matrix {
			const size = matrix.length;
			const rotated = Array.from({ length: size }, () =>
				Array<number>(size).fill(0),
			);
			for (let row = 0; row < size; row += 1) {
				for (let column = 0; column < size; column += 1) {
					rotated[clockwise ? column : size - 1 - column][
						clockwise ? size - 1 - row : row
					] = matrix[row][column];
				}
			}
			return rotated;
		}

		function createBag(): PieceType[] {
			const pieces = [...PIECE_TYPES];
			for (let index = pieces.length - 1; index > 0; index -= 1) {
				const other = Math.floor(Math.random() * (index + 1));
				[pieces[index], pieces[other]] = [pieces[other], pieces[index]];
			}
			return pieces;
		}

		function fillQueue(): void {
			while (queue.length < 4) {
				if (!bag.length) bag = createBag();
				const next = bag.pop();
				if (next) queue.push(next);
			}
		}

		function gravityAtLevel(): number {
			if (mode === "shirase" || creditRoll) return 20;
			const table = mode === "easy" ? EASY_GRAVITY : MASTER_GRAVITY;
			let gravity = table[0][1];
			for (const [threshold, value] of table) {
				if (level < threshold) break;
				gravity = value;
			}
			return mode === "easy" ? gravity / 256 : gravity / 65536;
		}

		function lockDelayFrames(): number {
			if (mode === "easy") return 30;
			if (mode === "master") return level >= 900 ? 17 : 30;
			if (level >= 1200) return 8;
			if (level >= 1100) return 10;
			if (level >= 600) return 12;
			if (level >= 500) return 13;
			if (level >= 300) return 15;
			if (level >= 200) return 17;
			return 18;
		}

		function entryDelayFrames(lineClear: boolean): number {
			if (mode === "easy") return lineClear ? 25 : 48;
			if (mode === "master") {
				if (lineClear) {
					if (level >= 800) return 8;
					if (level >= 700) return 14;
					if (level >= 600) return 18;
					return 27;
				}
				if (level >= 900) return 14;
				if (level >= 800) return 14;
				if (level >= 700) return 18;
				return 27;
			}
			if (lineClear) {
				if (level >= 1300) return 6;
				if (level >= 500) return 5;
				if (level >= 300) return 6;
				if (level >= 200) return 6;
				return level >= 100 ? 7 : 8;
			}
			return level >= 300 ? 6 : 12;
		}

		function modeGoal(): number {
			return mode === "easy" ? 200 : mode === "master" ? 999 : 1300;
		}

		function modeName(value = mode): string {
			return value.toUpperCase();
		}

		function collides(x: number, y: number, matrix: Matrix): boolean {
			for (let row = 0; row < matrix.length; row += 1) {
				for (let column = 0; column < matrix[row].length; column += 1) {
					if (!matrix[row][column]) continue;
					const boardX = x + column;
					const boardY = y + row;
					if (boardX < 0 || boardX >= WIDTH || boardY >= HEIGHT) return true;
					if (boardY >= -1 && board[boardY + 1][boardX] !== null) return true;
				}
			}
			return false;
		}

		function isGrounded(piece = current): boolean {
			return piece !== null && collides(piece.x, piece.y + 1, piece.matrix);
		}

		function spawnPiece(): void {
			if (status !== "playing") return;
			if (mode === "shirase" && level >= 500 && level < 1000) {
				risingCounter += 1;
				const quota =
					level >= 900
						? 8
						: level >= 800
							? 9
							: level >= 700
								? 10
								: level >= 600
									? 18
									: 20;
				if (risingCounter >= quota) {
					risingCounter = 0;
					if (!insertGarbage()) return;
				}
			}
			fillQueue();
			const type = queue.shift();
			if (!type) return;
			fillQueue();
			const matrix = cloneMatrix(SHAPES[type]);
			current = {
				type,
				matrix,
				rotation: 0,
				x: Math.floor((WIDTH - matrix.length) / 2),
				y: type === "I" ? -1 : 0,
				lockMs: 0,
				lockResets: 0,
				activeFrames: 0,
				softFrames: 0,
				sonicDistance: 0,
			};
			gravityProgress = 0;
			if (collides(current.x, current.y, current.matrix))
				endRun(false, "STACK TOPPED OUT");
		}

		function insertGarbage(): boolean {
			if (board[0].some((cell) => cell !== null)) {
				endRun(false, "RISING GARBAGE TOP-OUT");
				return false;
			}
			const row = [...board[HEIGHT]];
			if (row.every((cell) => Boolean(cell)))
				row[Math.floor(Math.random() * WIDTH)] = null;
			board.shift();
			board.push(row);
			return true;
		}

		function resetRun(): void {
			board = createBoard();
			lastFrame = 0;
			queue = [];
			bag = [];
			current = null;
			heldPiece = null;
			canHold = true;
			level = 0;
			lines = 0;
			score = 0;
			combo = 0;
			totalTimeMs = 0;
			sectionStartMs = 0;
			gravityProgress = 0;
			gradeRank = 0;
			gradePoints = 0;
			gradeDecayProgress = 0;
			coolCount = 0;
			sectionCoolReady = false;
			regretCount = 0;
			hanabi = 0;
			risingCounter = 0;
			creditRoll = false;
			creditRollMs = 0;
			spawnDelayMs = 0;
			clearFlashMs = 0;
			messageUntil = 0;
			visibleTime = -1;
			currentMessage = "Good luck :)";
			repeatInputs.clear();
			updateUI();
			render();
		}

		function setOverlay(visible: boolean, buttonText = ""): void {
			overlay.dataset.visible = String(visible);
			if (buttonText) startButton.textContent = buttonText;
		}

		function setMessage(message: string, durationMs = 1400): void {
			currentMessage = message;
			messageUntil = totalTimeMs + durationMs;
			messageElement.textContent = message;
			messageElement.dataset.emphasis = String(
				/TETRIS|COOL|REGRET|CLEAR/.test(message),
			);
		}

		function formatTime(milliseconds: number): string {
			const totalSeconds = Math.floor(milliseconds / 1000);
			return `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`;
		}

		function endRun(cleared: boolean, reason: string): void {
			if (status !== "playing") return;
			status = cleared ? "clear" : "over";
			repeatInputs.clear();
			const title = cleared
				? "Run cleared"
				: creditRoll
					? "Credit roll over"
					: "Game over";
			setOverlay(true, title);
			setMessage(reason, 5000);
			updateUI();
			render();
		}

		function startGame(): void {
			resetRun();
			status = "playing";
			setOverlay(false);
			setMessage("");
			spawnPiece();
			updateUI();
			render();
		}

		function updateGrade(lineCount: number, comboValue: number): void {
			if (mode !== "master" || lineCount === 0) return;
			const base =
				GRADE_BASE_POINTS[Math.min(gradeRank, GRADE_BASE_POINTS.length - 1)][
					lineCount - 1
				] ?? 0;
			const levelMultiplier =
				level < 250 ? 1 : level < 500 ? 2 : level < 750 ? 3 : 4;
			const comboRow =
				COMBO_MULTIPLIERS[
					Math.min(COMBO_MULTIPLIERS.length - 1, Math.max(0, comboValue - 1))
				];
			gradePoints += Math.ceil(
				base * (comboRow[lineCount - 1] ?? 1) * levelMultiplier,
			);
			if (gradePoints >= 100) {
				gradePoints = 0;
				gradeRank = Math.min(GRADE_NAMES.length - 1, gradeRank + 1);
			}
		}

		function updateSection(previousLevel: number): void {
			const sectionIndex = Math.floor(previousLevel / 100);
			const durationSeconds = (totalTimeMs - sectionStartMs) / 1000;
			if (mode === "master") {
				const coolThreshold = sectionIndex * 100 + 70;
				const coolTime = MASTER_COOL_TIMES[sectionIndex];
				if (
					!sectionCoolReady &&
					previousLevel < coolThreshold &&
					level >= coolThreshold &&
					coolTime !== undefined &&
					durationSeconds <= coolTime
				) {
					sectionCoolReady = true;
				}
				if (Math.floor(level / 100) <= sectionIndex) return;
				if (sectionCoolReady) {
					coolCount += 1;
					gradeRank = Math.min(GRADE_NAMES.length - 1, gradeRank + 1);
					setMessage("COOL!!", 2400);
				} else {
					const regretTime = MASTER_REGRET_TIMES[sectionIndex];
					if (regretTime !== undefined && durationSeconds > regretTime) {
						regretCount += 1;
						if (gradeRank > 0) gradeRank -= 1;
						gradePoints = 0;
						setMessage("REGRET!", 2400);
					}
				}
				sectionStartMs = totalTimeMs;
				sectionCoolReady = false;
			} else if (mode === "shirase" && Math.floor(level / 100) > sectionIndex) {
				if (durationSeconds > (sectionIndex < 2 ? 60 : 50)) {
					regretCount += 1;
					setMessage("SECTION REGRET!", 2400);
				}
				sectionStartMs = totalTimeMs;
			}
		}

		function lockCurrentPiece(): void {
			if (!current || status !== "playing") return;
			const locked = current;
			for (let row = 0; row < locked.matrix.length; row += 1) {
				for (let column = 0; column < locked.matrix[row].length; column += 1) {
					if (!locked.matrix[row][column]) continue;
					const boardY = locked.y + row;
					if (boardY >= -1 && boardY < HEIGHT) {
						board[boardY + 1][locked.x + column] =
							mode === "shirase" && level >= 1000 ? "mono" : locked.type;
					}
				}
			}

			const fullRows = board.flatMap((row, index) =>
				row.every((cell) => cell !== null) ? [index] : [],
			);
			const cleared = fullRows.length;
			if (cleared) {
				const fullRowSet = new Set(fullRows);
				board = board.filter((_, index) => !fullRowSet.has(index));
				while (board.length < HEIGHT + 1)
					board.unshift(Array<Cell>(WIDTH).fill(null));
			}
			const previousLevel = level;
			const pieceAdvance = level % 100 === 99 ? 0 : 1;
			const lineAdvance =
				cleared === 0
					? 0
					: mode === "easy"
						? cleared
						: cleared === 3
							? 4
							: cleared === 4
								? 6
								: cleared;
			level = Math.min(modeGoal(), level + pieceAdvance + lineAdvance);
			lines += cleared;
			if (mode === "shirase")
				risingCounter = Math.max(0, risingCounter - cleared);
			combo = cleared === 0 ? 0 : (combo || 1) + 2 * cleared - 2;

			const activeFrames = Math.max(1, locked.activeFrames);
			const scoreBase =
				Math.ceil((previousLevel + cleared) / 4) +
				locked.softFrames +
				locked.sonicDistance;
			score += Math.floor(
				scoreBase * cleared * (cleared ? combo : 1) +
					Math.ceil(level / 2) +
					Math.max(0, lockDelayFrames() - activeFrames),
			);
			updateGrade(cleared, combo);
			if (mode === "easy" && cleared)
				hanabi += cleared * (cleared + 1) + Math.max(0, combo - 1);
			updateSection(previousLevel);

			if (cleared > 0 && mode !== "master") {
				const labels = ["", "SINGLE", "DOUBLE", "TRIPLE", "TETRIS"];
				setMessage(
					`${labels[cleared] ?? "LINES"}${combo > 1 ? ` · ${combo} COMBO` : ""}`,
				);
			} else if (cleared === 4) setMessage("TETRIS!");

			current = null;
			canHold = true;
			if (
				mode === "master" &&
				previousLevel < 500 &&
				level >= 500 &&
				totalTimeMs > 420_000
			) {
				endRun(false, "LEVEL 500 TORIKAN · 7:00 LIMIT");
				return;
			}
			if (
				mode === "shirase" &&
				previousLevel < 500 &&
				level >= 500 &&
				totalTimeMs > 183_000
			) {
				endRun(false, "LEVEL 500 TORIKAN · 3:03 LIMIT");
				return;
			}
			if (
				mode === "shirase" &&
				previousLevel < 1000 &&
				level >= 1000 &&
				totalTimeMs > 366_000
			) {
				endRun(false, "LEVEL 1000 TORIKAN · 6:06 LIMIT");
				return;
			}
			if (mode === "easy" && previousLevel < 200 && level >= 200) {
				creditRoll = true;
				setMessage("LEVEL 200 · CREDIT ROLL · 20G", 5000);
			}
			if (mode !== "easy" && level >= modeGoal()) {
				endRun(true, `${modeName()} LEVEL ${modeGoal()} COMPLETE`);
				return;
			}
			spawnDelayMs = entryDelayFrames(cleared > 0) * FRAME_MS;
			clearFlashMs = cleared > 0 ? entryDelayFrames(true) * FRAME_MS : 0;
			updateUI();
		}

		function moveHorizontal(direction: -1 | 1): void {
			if (
				!current ||
				status !== "playing" ||
				collides(current.x + direction, current.y, current.matrix)
			)
				return;
			const grounded = isGrounded();
			current.x += direction;
			if (grounded && current.lockResets < 15) {
				current.lockMs = 0;
				current.lockResets += 1;
			}
		}

		function moveDown(): boolean {
			if (
				!current ||
				status !== "playing" ||
				collides(current.x, current.y + 1, current.matrix)
			)
				return false;
			current.y += 1;
			return true;
		}

		function rotatePiece(clockwise: boolean): void {
			if (!current || status !== "playing" || current.type === "O") return;
			const from = current.rotation;
			const to = (from + (clockwise ? 1 : 3)) % 4;
			const rotated = rotateMatrix(current.matrix, clockwise);
			const kicks = (current.type === "I" ? I_KICKS : JLSTZ_KICKS)[
				`${from}>${to}`
			] ?? [[0, 0]];
			const grounded = isGrounded();
			for (const [offsetX, offsetY] of kicks) {
				if (collides(current.x + offsetX, current.y + offsetY, rotated))
					continue;
				current.x += offsetX;
				current.y += offsetY;
				current.matrix = rotated;
				current.rotation = to;
				if (grounded && current.lockResets < 15) {
					current.lockMs = 0;
					current.lockResets += 1;
				}
				return;
			}
		}

		function hardDrop(): void {
			if (!current || status !== "playing") return;
			let distance = 0;
			while (!collides(current.x, current.y + 1, current.matrix)) {
				current.y += 1;
				distance += 1;
			}
			current.sonicDistance = Math.max(current.sonicDistance, distance);
			lockCurrentPiece();
		}

		function holdCurrentPiece(): void {
			if (!current || status !== "playing" || !canHold) return;
			const outgoing = current.type;
			if (heldPiece === null) {
				heldPiece = outgoing;
				current = null;
				spawnPiece();
			} else {
				const incoming = heldPiece;
				heldPiece = outgoing;
				const matrix = cloneMatrix(SHAPES[incoming]);
				current = {
					type: incoming,
					matrix,
					rotation: 0,
					x: Math.floor((WIDTH - matrix.length) / 2),
					y: incoming === "I" ? -1 : 0,
					lockMs: 0,
					lockResets: 0,
					activeFrames: 0,
					softFrames: 0,
					sonicDistance: 0,
				};
				gravityProgress = 0;
				if (collides(current.x, current.y, current.matrix))
					endRun(false, "GAME OVER");
			}
			canHold = false;
			updateUI();
		}

		function applyAction(action: Action): void {
			if (status !== "playing") return;
			switch (action) {
				case "left":
					moveHorizontal(-1);
					break;
				case "right":
					moveHorizontal(1);
					break;
				case "down":
					moveDown();
					break;
				case "rotate-cw":
					rotatePiece(true);
					break;
				case "rotate-ccw":
					rotatePiece(false);
					break;
				case "hard-drop":
					hardDrop();
					break;
				case "hold":
					holdCurrentPiece();
					break;
			}
		}

		function togglePause(): void {
			if (status === "playing") {
				status = "paused";
				repeatInputs.clear();
				setOverlay(true, "Resume");
			} else if (status === "paused") {
				status = "playing";
				setOverlay(false);
			}
			updateUI();
			render();
		}

		function selectMode(nextMode: Mode): void {
			if (status === "playing") {
				setMessage("Pause the run before switching modes.", 2200);
				return;
			}
			mode = nextMode;
			status = "ready";
			resetRun();
			modeButtons.forEach((button) => {
				button.setAttribute(
					"aria-pressed",
					String(button.dataset.mode === mode),
				);
			});
			setOverlay(true, "Play");
			updateUI();
			render();
		}

		function processRepeats(timestamp: number): void {
			for (const repeat of repeatInputs.values()) {
				if (repeat.action !== "down" && timestamp >= repeat.nextAt) {
					applyAction(repeat.action);
					repeat.nextAt = timestamp + repeat.interval;
				}
			}
		}

		function softDropHeld(): boolean {
			return Array.from(repeatInputs.values()).some(
				(input) => input.action === "down",
			);
		}

		function update(deltaMs: number, timestamp: number): void {
			if (status !== "playing") return;
			totalTimeMs += deltaMs;
			clearFlashMs = Math.max(0, clearFlashMs - deltaMs);
			processRepeats(timestamp);
			if (status !== "playing") return;
			if (!current) {
				spawnDelayMs = Math.max(0, spawnDelayMs - deltaMs);
				if (spawnDelayMs === 0) spawnPiece();
				if (!current || status !== "playing") return;
			}
			const frameDelta = deltaMs / FRAME_MS;
			current.activeFrames += frameDelta;
			if (softDropHeld()) {
				current.softFrames += frameDelta;
				const gravity = gravityAtLevel();
				gravityProgress += frameDelta * Math.min(20, gravity * 20);
			} else gravityProgress += frameDelta * gravityAtLevel();
			let dropSteps = 0;
			while (gravityProgress >= 1 && dropSteps < 40) {
				if (!moveDown()) break;
				gravityProgress -= 1;
				dropSteps += 1;
			}
			if (isGrounded()) {
				current.lockMs += deltaMs;
				if (current.lockMs >= lockDelayFrames() * FRAME_MS) lockCurrentPiece();
			} else current.lockMs = 0;
			if (totalTimeMs >= messageUntil) {
				messageElement.textContent = currentMessage;
				messageElement.dataset.emphasis = "false";
			}
			if (mode === "master" && current) {
				gradeDecayProgress += frameDelta;
				const decayFrames =
					GRADE_DECAY_FRAMES[
						Math.min(gradeRank, GRADE_DECAY_FRAMES.length - 1)
					];
				if (gradeDecayProgress >= decayFrames) {
					gradeDecayProgress %= decayFrames;
					gradePoints = Math.max(0, gradePoints - 1);
				}
			}
			if (creditRoll) {
				creditRollMs += deltaMs;
				if (creditRollMs >= 60_000) endRun(true, "EASY CREDIT ROLL SURVIVED");
			}
		}

		function drawTile(
			context: CanvasRenderingContext2D,
			type: Cell,
			x: number,
			y: number,
			size: number,
			alpha = 1,
		): void {
			if (!type) return;
			const palette: Record<
				PieceType | "mono",
				{ tile: number; filter: string; color: string }
			> = {
				I: { tile: 2, filter: "none", color: "#42c6e7" },
				O: { tile: 0, filter: "none", color: "#f2d54b" },
				T: { tile: 3, filter: "none", color: "#bd7de7" },
				S: { tile: 1, filter: "none", color: "#77cf49" },
				Z: { tile: 4, filter: "none", color: "#ef4963" },
				J: {
					tile: 2,
					filter: "hue-rotate(32deg) saturate(1.1)",
					color: "#5478e8",
				},
				L: {
					tile: 0,
					filter: "hue-rotate(-24deg) saturate(1.2)",
					color: "#f2973e",
				},
				mono: {
					tile: 1,
					filter: "saturate(0.65) brightness(1.12)",
					color: "#8cda55",
				},
			};
			const color = palette[type];
			context.save();
			context.globalAlpha = alpha;
			if (tileMap.complete && tileMap.naturalWidth >= 160) {
				context.filter = color.filter;
				context.drawImage(
					tileMap,
					color.tile * 32,
					0,
					32,
					32,
					x + 1,
					y + 1,
					size - 2,
					size - 2,
				);
			} else {
				context.fillStyle = color.color;
				context.fillRect(x + 1, y + 1, size - 2, size - 2);
				context.fillStyle = "rgba(255,255,255,.27)";
				context.fillRect(x + 3, y + 3, size - 6, Math.max(2, size * 0.12));
				context.strokeStyle = "rgba(255,255,255,.34)";
				context.strokeRect(x + 1.5, y + 1.5, size - 3, size - 3);
			}
			context.restore();
		}

		function drawMatrix(
			context: CanvasRenderingContext2D,
			matrix: Matrix,
			type: Cell,
			x: number,
			y: number,
			cellSize: number,
			alpha = 1,
		): void {
			for (let row = 0; row < matrix.length; row += 1) {
				for (let column = 0; column < matrix[row].length; column += 1) {
					if (matrix[row][column])
						drawTile(
							context,
							type,
							x + column * cellSize,
							y + row * cellSize,
							cellSize,
							alpha,
						);
				}
			}
		}

		function drawClearFlash(context: CanvasRenderingContext2D): void {
			if (clearFlashMs <= 0 || !boardCanvas) return;
			context.fillStyle = `rgba(226, 255, 250, ${Math.min(0.48, clearFlashMs / 180)})`;
			context.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
		}

		function drawPreview(
			context: CanvasRenderingContext2D,
			canvas: HTMLCanvasElement,
			type: PieceType | null,
		): void {
			context.clearRect(0, 0, canvas.width, canvas.height);
			context.fillStyle = "rgba(4,8,17,.42)";
			context.fillRect(0, 0, canvas.width, canvas.height);
			if (!type) return;
			const matrix = SHAPES[type];
			let minX = matrix[0].length;
			let maxX = -1;
			let minY = matrix.length;
			let maxY = -1;
			for (let row = 0; row < matrix.length; row += 1) {
				for (let column = 0; column < matrix[row].length; column += 1) {
					if (!matrix[row][column]) continue;
					minX = Math.min(minX, column);
					maxX = Math.max(maxX, column);
					minY = Math.min(minY, row);
					maxY = Math.max(maxY, row);
				}
			}
			const cellSize = 16;
			const width = (maxX - minX + 1) * cellSize;
			const height = (maxY - minY + 1) * cellSize;
			drawMatrix(
				context,
				matrix,
				type,
				(canvas.width - width) / 2 - minX * cellSize,
				(canvas.height - height) / 2 - minY * cellSize,
				cellSize,
			);
		}

		function ghostY(): number {
			if (!current) return 0;
			let y = current.y;
			while (!collides(current.x, y + 1, current.matrix)) y += 1;
			return y;
		}

		function render(): void {
			const context = boardContext;
			if (!context || !boardCanvas || !holdContext || !holdCanvas) return;
			context.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
			context.fillStyle = "#090e19";
			context.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
			for (let row = 0; row < HEIGHT; row += 1) {
				for (let column = 0; column < WIDTH; column += 1) {
					const x = column * CELL_SIZE;
					const y = row * CELL_SIZE;
					context.fillStyle = "#0d1320";
					context.fillRect(x, y, CELL_SIZE, CELL_SIZE);
					context.strokeStyle = "rgba(164,185,219,.09)";
					context.strokeRect(x + 0.5, y + 0.5, CELL_SIZE, CELL_SIZE);
					if (board[row + 1][column])
						drawTile(context, board[row + 1][column], x, y, CELL_SIZE);
				}
			}
			drawClearFlash(context);
			if (current && status === "playing") {
				const landing = ghostY();
				if (landing !== current.y)
					drawMatrix(
						context,
						current.matrix,
						current.type,
						current.x * CELL_SIZE,
						landing * CELL_SIZE,
						CELL_SIZE,
						0.24,
					);
				drawMatrix(
					context,
					current.matrix,
					mode === "shirase" && level >= 1000 ? "mono" : current.type,
					current.x * CELL_SIZE,
					current.y * CELL_SIZE,
					CELL_SIZE,
				);
			}
			drawPreview(holdContext, holdCanvas, heldPiece);
			for (let index = 0; index < nextContexts.length; index += 1) {
				const context = nextContexts[index];
				const canvas = nextCanvases[index];
				if (context && canvas)
					drawPreview(context, canvas, queue[index] ?? null);
			}
		}

		function updateUI(): void {
			levelElement.textContent = String(level).padStart(3, "0");
			linesElement.textContent = String(lines).padStart(3, "0");
			scoreElement.textContent = String(score).padStart(6, "0");
			comboElement.textContent = combo > 1 ? `×${combo}` : "—";
			const seconds = Math.floor(totalTimeMs / 1000);
			if (visibleTime !== seconds) {
				visibleTime = seconds;
				timeElement.textContent = formatTime(totalTimeMs);
			}
			if (mode === "easy") {
				gradeCaption.textContent = "HANABI";
				gradeElement.textContent = String(hanabi).padStart(3, "0");
				gradeMeter.style.width = `${Math.min(100, level / 2)}%`;
				sectionElement.textContent =
					level >= 200
						? "CREDIT ROLL"
						: `${String(Math.floor(level / 100) * 100).padStart(3, "0")}–${String(Math.floor(level / 100) * 100 + 99).padStart(3, "0")}`;
				coolElement.textContent = creditRoll ? "20G" : "READY";
			} else if (mode === "master") {
				gradeCaption.textContent = "EST.";
				gradeElement.textContent = GRADE_NAMES[gradeRank] ?? "9";
				gradeMeter.style.width = `${gradePoints}%`;
				sectionElement.textContent =
					level >= 999
						? "999 GOAL"
						: `${String(Math.floor(level / 100) * 100).padStart(3, "0")}–${String(Math.floor(level / 100) * 100 + 99).padStart(3, "0")}`;
				coolElement.textContent = String(coolCount).padStart(2, "0");
			} else {
				gradeCaption.textContent = "SECTIONS";
				gradeElement.textContent = `S${Math.max(0, Math.floor(level / 100) - regretCount)}`;
				gradeMeter.style.width = `${level % 100 || (level ? 100 : 0)}%`;
				sectionElement.textContent =
					level >= 1300
						? "1300 GOAL"
						: `${String(Math.floor(level / 100) * 100).padStart(3, "0")}–${String(Math.floor(level / 100) * 100 + 99).padStart(3, "0")}`;
				coolElement.textContent = String(regretCount).padStart(2, "0");
			}
		}

		function gameLoop(timestamp: number): void {
			if (lastFrame === 0) lastFrame = timestamp;
			const deltaMs = Math.min(50, Math.max(0, timestamp - lastFrame));
			lastFrame = timestamp;
			update(deltaMs, timestamp);
			updateUI();
			render();
			requestAnimationFrame(gameLoop);
		}

		function startRepeat(
			key: string,
			action: Action,
			timestamp: number,
			delay: number,
			interval: number,
		): void {
			applyAction(action);
			if (status === "playing")
				repeatInputs.set(key, { action, nextAt: timestamp + delay, interval });
		}

		function isEditableTarget(target: EventTarget | null): boolean {
			return (
				target instanceof HTMLElement &&
				(target.isContentEditable ||
					["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
			);
		}

		modeButtons.forEach((button) => {
			button.addEventListener("click", () => {
				const value = button.dataset.mode;
				if (value === "easy" || value === "master" || value === "shirase")
					selectMode(value);
			});
		});
		startButton.addEventListener("click", () => {
			if (status === "paused") {
				status = "playing";
				setOverlay(false);
				updateUI();
			} else startGame();
		});

		const keyActions: Record<string, Action> = {
			ArrowLeft: "left",
			ArrowRight: "right",
			ArrowDown: "down",
			ArrowUp: "rotate-cw",
			x: "rotate-cw",
			z: "rotate-ccw",
			" ": "hard-drop",
			c: "hold",
		};
		window.addEventListener("keydown", (event) => {
			if (isEditableTarget(event.target)) return;
			if (event.key === "Enter" && status !== "playing") {
				event.preventDefault();
				if (status === "paused") {
					status = "playing";
					setOverlay(false);
					updateUI();
				} else startGame();
				return;
			}
			if (event.key.toLowerCase() === "p") {
				event.preventDefault();
				togglePause();
				return;
			}
			const action =
				keyActions[event.key] ?? keyActions[event.key.toLowerCase()];
			if (!action) return;
			event.preventDefault();
			if (event.repeat || repeatInputs.has(event.key)) return;
			if (action === "left" || action === "right" || action === "down") {
				const horizontal = action !== "down";
				startRepeat(
					event.key,
					action,
					performance.now(),
					horizontal ? 155 : 45,
					horizontal ? 42 : 38,
				);
			} else applyAction(action);
		});
		window.addEventListener("keyup", (event) => {
			repeatInputs.delete(event.key);
			if (event.key === " ") event.preventDefault();
		});
		window.addEventListener("blur", () => repeatInputs.clear());

		touchButtons.forEach((button) => {
			button.addEventListener("pointerdown", (event) => {
				const action = button.dataset.action as Action | undefined;
				if (!action) return;
				event.preventDefault();
				button.setPointerCapture(event.pointerId);
				const key = `touch-${event.pointerId}`;
				if (action === "left" || action === "right" || action === "down")
					startRepeat(
						key,
						action,
						performance.now(),
						action === "down" ? 45 : 155,
						action === "down" ? 38 : 42,
					);
				else applyAction(action);
			});
			const release = (event: PointerEvent) =>
				repeatInputs.delete(`touch-${event.pointerId}`);
			button.addEventListener("pointerup", release);
			button.addEventListener("pointercancel", release);
			button.addEventListener("lostpointercapture", release);
		});
		main.addEventListener("contextmenu", (event) => {
			if ((event.target as HTMLElement).closest("canvas"))
				event.preventDefault();
		});

		setOverlay(true, "Play");
		updateUI();
		render();
		requestAnimationFrame(gameLoop);
	}
}
