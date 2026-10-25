// Find the game area and the score, timer, and multiplier elements in the HTML.
// Keeping these references lets the game update the page without searching for
// the same elements every time something changes.
const gameArea = document.querySelector('#game-area');
const scoreDisplay = document.querySelector('#score');
const timeDisplay = document.querySelector('#time');
const multiplierDisplay = document.querySelector('#multiplier');

// Find the end-of-game message and its heading and paragraph.
const messageBox = document.querySelector('#game-message');
const messageTitle = document.querySelector('#message-title');
const messageText = document.querySelector('#message-text');

// Find the buttons used to start or restart the game and the tank used for
// detecting when falling droplets have reached the water.
const startButton = document.querySelector('#start-button');
const restartButton = document.querySelector('#restart-button');
const waterTank = document.querySelector('#water-tank');

// These variables keep track of the game's current state and displayed values.
let score = 0;
let timeRemaining = 30;
let contaminationMultiplier = 1;
let dirtyDropHitTank = false;
let lateGameStarted = false;

// Store each active droplet here so the game can move it, check it, and remove it.
let droplets = [];
let gameIsRunning = false;

// These variables hold the IDs returned by the timers and animation loop.
// The IDs are used later to stop those repeating tasks.
let timerInterval;
let spawnInterval;
let animationFrame;

// Remember the previous animation time to calculate how far droplets should move.
let previousFrameTime = 0;

// Start a new game, clear anything left from a previous round, and reset the page.
function startGame() {
	// Stop old timers and animation frames so restarting cannot create duplicate loops.
	clearInterval(timerInterval);
	clearInterval(spawnInterval);
	cancelAnimationFrame(animationFrame);

	// Restore all gameplay values to their starting amounts and empty the droplet list.
	score = 0;
	timeRemaining = 30;
	contaminationMultiplier = 1;
	dirtyDropHitTank = false;
	lateGameStarted = false;
	droplets = [];

	// Remove any droplet buttons still visible from the previous round.
	gameArea.querySelectorAll('.drop').forEach((drop) => drop.remove());
	gameIsRunning = true;
	previousFrameTime = 0;

	// Refresh the score, timer, and multiplier, then show the correct buttons/message.
	updateScore();
	renderTimer();
	updateContaminationMultiplier();
	messageBox.hidden = true;
	startButton.hidden = true;
	restartButton.hidden = false;

	// Add a new droplet every 850 milliseconds and count down once each second.
	// The animation frame loop moves droplets smoothly between those timer ticks.
	spawnInterval = setInterval(spawnDroplet, 850);
	timerInterval = setInterval(updateTimer, 1000);
	animationFrame = requestAnimationFrame(moveDroplets);
}

// Create a randomly selected droplet near the top of the game area.
function spawnDroplet() {
	// Do not add more droplets after a round has ended.
	if (!gameIsRunning) {
		return;
	}

	// Make a new button so the droplet can be clicked or activated with a keyboard.
	const drop = document.createElement('button');

	// Use one random number to choose the water type: 25% clean, 55% dirty,
	// and 20% red. Red water is also dirty, but causes a larger time penalty.
	const dropRoll = Math.random();
	const isClean = dropRoll < 0.25;
	const isRed = dropRoll >= 0.8;
	const isDirty = !isClean;

	// Keep the droplet's random horizontal position inside the game area's width.
	const horizontalSpace = gameArea.clientWidth - 34;

	// Set the button type, shared styling, and type-specific color and accessible label.
	drop.type = 'button';
	drop.classList.add('drop');
	if (isRed) {
		drop.classList.add('drop-red');
		drop.setAttribute('aria-label', 'Red water droplet');
	} else if (isDirty) {
		drop.classList.add('drop-dirty');
		drop.setAttribute('aria-label', 'Dirty water droplet');
	} else {
		drop.classList.add('drop-clean');
		drop.setAttribute('aria-label', 'Clean water droplet');
	}

	// Pick a horizontal position, then add the button to the visible game area.
	drop.style.left = `${Math.random() * horizontalSpace}px`;
	gameArea.append(drop);

	// Save the information the game needs to move this droplet and apply its effect.
	// Droplets start just above the visible area and have slightly varied speeds.
	droplets.push({
		element: drop,
		top: -36,
		speed: (90 + Math.random() * 65) * (lateGameStarted ? 1.5 : 1),
		isDirty: isDirty,
		timeMultiplier: isRed ? 3 : 1
	});
}

// Move all active droplets and check whether any have reached the tank.
function moveDroplets(frameTime) {
	// Stop the animation loop when the game is no longer active.
	if (!gameIsRunning) {
		return;
	}

	// On the first frame, save the current time so the movement calculation
	// has a starting point rather than comparing against an old frame.
	if (previousFrameTime === 0) {
		previousFrameTime = frameTime;
	}

	// Work out the time since the last frame in seconds. Moving by elapsed time
	// keeps droplets moving at a steady speed even if the frame rate changes.
	const secondsSinceLastFrame = (frameTime - previousFrameTime) / 1000;
	previousFrameTime = frameTime;

	// Advance each droplet according to its speed and update its on-screen position.
	droplets.forEach((droplet) => {
		droplet.top += droplet.speed * secondsSinceLastFrame;
		droplet.element.style.top = `${droplet.top}px`;
	});

	// Apply tank effects for any droplets that have reached the tank, then
	// request another frame to keep the animation going.
	checkTankCollisions();
	animationFrame = requestAnimationFrame(moveDroplets);
}

// Handle a hit on a droplet, updating the score and removing the caught droplet.
function handleDropHit(event) {
	// The event may come from a child inside the button, so find the nearest
	// droplet button containing the exact spot the player activated.
	const clickedDrop = event.target.closest('.drop');

	// Ignore the event if the game is stopped or the player did not hit a droplet.
	if (!gameIsRunning || !clickedDrop) {
		return;
	}

	// Find this button's matching item in the droplet list so its game data can
	// be updated and it can be removed from both the list and the page.
	const dropletIndex = droplets.findIndex((droplet) => droplet.element === clickedDrop);

	// The droplet may already have been removed, so ignore it if no match exists.
	if (dropletIndex === -1) {
		return;
	}

	// Dirty and red droplets are worth points; catching a clean drop subtracts
	// points, but the score is not allowed to fall below zero.
	if (droplets[dropletIndex].isDirty) {
		score += 10;
	} else {
		score = Math.max(0, score - 5);
	}

	// Show the updated score and remove the caught droplet.
	updateScore();
	removeDroplet(dropletIndex);
}

// Pointer down responds as soon as the player presses a droplet, rather than
// waiting for the browser to finish its click gesture.
gameArea.addEventListener('pointerdown', (event) => {
	// Only respond to the primary (usually left) mouse button; touch and pen
	// pointer events also use button 0.
	if (event.button === 0) {
		handleDropHit(event);
	}
});

// A keyboard-generated click has detail 0. Keep that behavior so users can
// focus a droplet button and activate it with the keyboard.
gameArea.addEventListener('click', (event) => {
	if (event.detail === 0) {
		handleDropHit(event);
	}
});

// Check whether droplets have reached the tank and apply their effects.
function checkTankCollisions() {
	// The tank's top edge is the point where a falling droplet reaches the water.
	const tankTop = waterTank.offsetTop;

	// Check from the end of the list toward the beginning. This makes it safe to
	// remove a droplet while looping, because removing later items won't shift
	// the positions of items that still need to be checked.
	for (let index = droplets.length - 1; index >= 0; index -= 1) {
		const droplet = droplets[index];

		// A collision happens when the bottom edge of the droplet reaches the tank.
		if (droplet.top + droplet.element.offsetHeight >= tankTop) {
			if (droplet.isDirty) {
				// Dirty water adds time to the countdown. Red water uses a larger
				// multiplier, and every dirty drop increases future contamination.
				dirtyDropHitTank = true;
				timeRemaining += contaminationMultiplier * droplet.timeMultiplier;
				contaminationMultiplier += 1;
				renderTimer();
				updateContaminationMultiplier();
			} else {
				// A clean drop lowers the multiplier, but it cannot go below 1.
				contaminationMultiplier = Math.max(1, contaminationMultiplier - 1);
				updateContaminationMultiplier();
			}

			// A droplet only affects the tank once, so remove it after its effect.
			removeDroplet(index);

			// Reaching 60 seconds of contamination ends the round as a loss.
			if (timeRemaining >= 60) {
				endGame(false);
				return;
			}
		}
	}
}

// Remove a droplet from the page and from the array of active droplets.
function removeDroplet(index) {
	droplets[index].element.remove();
	droplets.splice(index, 1);
}

// Copy the current score into its display element in the HTML.
function updateScore() {
	scoreDisplay.textContent = score;
}

// Subtract one second, update the timer display, and check if the round is over.
function updateTimer() {
	// A timer tick can happen just as the game ends, so ignore it when stopped.
	if (!gameIsRunning) {
		return;
	}

	// Count down without allowing the value to go below zero.
	if (timeRemaining > 0) {
		timeRemaining -= 1;
	}

	// Update what the player sees before checking the win/loss conditions.
	renderTimer();

	// Increase the challenge once the countdown reaches 7 seconds.
	if (!lateGameStarted && timeRemaining <= 7 && timeRemaining > 0) {
		lateGameStarted = true;
		clearInterval(spawnInterval);
		spawnInterval = setInterval(spawnDroplet, 450);
		droplets.forEach((droplet) => {
			droplet.speed *= 1.5;
		});
	}

	// Reaching zero means the player survived the countdown. Reaching the
	// contamination limit means the player lost.
	if (timeRemaining <= 0) {
		endGame(true);
	} else if (timeRemaining >= 60) {
		endGame(false);
	}
}

// Display the current time without changing the timer value itself.
function renderTimer() {
	timeDisplay.textContent = timeRemaining;
}

// Display the current contamination multiplier in the game HUD.
function updateContaminationMultiplier() {
	multiplierDisplay.textContent = contaminationMultiplier;
}

// Stop the round, remove remaining droplets, and show the result to the player.
function endGame(playerWon) {
	// Mark the game as stopped and cancel every repeating timer or animation.
	gameIsRunning = false;
	clearInterval(timerInterval);
	clearInterval(spawnInterval);
	cancelAnimationFrame(animationFrame);

	// Clear visible droplets and their saved game data.
	gameArea.querySelectorAll('.drop').forEach((drop) => drop.remove());
	droplets = [];

	// Choose a result heading and message based on whether the player won.
	messageTitle.textContent = playerWon ? 'Water purified!' : 'The tank is contaminated.';
	if (playerWon) {
		if (!dirtyDropHitTank) {
			score += 50;
			updateScore();
			messageText.textContent = `You kept the water clean and earned ${score} points, including a 50-point clean tank bonus.`;
		} else {
			messageText.textContent = `You kept the water clean and earned ${score} points.`;
		}
	} else {
		messageText.textContent = 'Too much contamination added time. Give it another try!';
	}

	// Show the result and leave the player with an option to play again.
	messageBox.hidden = false;
	startButton.hidden = true;
	restartButton.hidden = false;
}

// Start a new round when the start or replay button is activated.
startButton.addEventListener('click', startGame);
restartButton.addEventListener('click', startGame);
