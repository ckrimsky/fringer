const canvas = document.getElementById('fringerCanvas');
const ctx = canvas.getContext('2d');

//rendering sizes
const colWidth = 30;
const rowHeight = 35;
const ropeWidth = 6;
const numRows = 15;
const lowBuffer = 60;
let loomHeight = canvas.height - (rowHeight * numRows + lowBuffer);

//define rope colors (most --> least common)
const colorCodes = ['#4e9ea3', '#8b1a03', '#547e11', '#d5b344', '#642e84'];

//cursor
let cursorCol = 0;
let cursorRow = 0;
let cursorLeft = true; //true is left, false is right

//game state
let gameRunning = false; //if game is not paused
let gameOver = false; //if game is lost
let numBoosts = 0;
const maxBoosts = 20;
let level = 0;
let score = 0;
let pushes = 0; //the number of times pushDown has been called this level

//bonuses
let candleOn = false;
let candleTopCol = 0;
let candleBottomCol = 0;
let candleStart = 0; //the number of pushes when the candle was lit
const candlesPerStage = 3; //number of candles that can appear on each stage
let candlesThisStage = 0;

//buttons
const pauseSymbol = '⏸';
const playSymbol = '▸';
const bonusOnSymbol = '★';
const bonusOffSymbol = '☆';

//retreive high score from local storage
let highScore = parseInt(localStorage.getItem('highScore'));
if (isNaN(highScore)) {
    highScore = 0;
}

//retreive button values from local storage and modify buttons accordingly
let startLevel = parseInt(localStorage.getItem('startLevel'));
if (isNaN(startLevel) || startLevel < 0 || startLevel > 9) {
    startLevel = 0;
    document.getElementById('startLevel').value = 0;
} else {
    document.getElementById('startLevel').value = startLevel;
    level = startLevel;
}

let bonusesOn = localStorage.getItem('bonusesOn') === 'true';
updateBonusButton();

let ropes = [];
let knots = [];

//rope.path indexes from bottom of screen. 
//0 is straight, -1 is left, 1 is right

//example small game with one knot for debugging
function initSmall() {
    ropes = [
        {color: 'blue', path: [0, 0, 0, 1, 0], endCol: 1},
        {color: 'red', path: [0, 0, 0, -1, 0], endCol: 0},
        {color: 'blue', path: [0, 0, 0, 0, 0], endCol: 2}
    ];
    knots = [
        {col: 0, row: 3, direction: 'left', topColor: 'red', sparkles: 0}
    ];
}

//levels from the original fringer game (which groups them in 3s)
//colors: index indicates color, value indicates number of ropes with that color
const levels = [
    //1-1
    {difficulty: 6, colors: [11, 1]},
    //1-2
    {difficulty: 6, colors: [10, 1, 1]},
    //1-3
    {difficulty: 6, colors: [9, 2, 2]},
    //2-1
    {difficulty: 8, colors: [7, 4, 1]},
    //2-2
    {difficulty: 7, colors: [8, 2, 1, 1]},
    //2-3
    {difficulty: 6, colors: [7, 3, 1, 1]},
    //3-1
    {difficulty: 8, colors: [6, 5, 1]},
    //3-2
    {difficulty: 7, colors: [7, 2, 2, 1]},
    //3-3
    {difficulty: 6, colors: [6, 4, 1, 1]},
    //4-1
    {difficulty: 8, colors: [6, 3, 2, 1]},
    //4-2
    {difficulty: 7, colors: [8, 2, 2]},
    //4-3
    {difficulty: 6, colors: [7, 3, 2]},
    //5-1
    {difficulty: 8, colors: [6, 4, 2]},
    //5-2
    {difficulty: 7, colors: [5, 5, 1, 1]},
    //5-3
    {difficulty: 6, colors: [6, 2, 2, 2]},
    //6-1
    {difficulty: 8, colors: [5, 4, 3]},
    //6-2
    {difficulty: 7, colors: [5, 4, 3]},
    //6-3
    {difficulty: 6, colors: [5, 3, 2, 2]},
    //7-1
    {difficulty: 8, colors: [4, 4, 2, 2]},
    //7-2
    {difficulty: 7, colors: [4, 3, 3, 2]},
    //7-3
    {difficulty: 6, colors: [3, 3, 3, 3]},
    //8-1
    {difficulty: 8, colors: [5, 2, 2, 2, 1]},
    //8-2
    {difficulty: 7, colors: [5, 2, 2, 2, 1]},
    //8-3
    {difficulty: 6, colors: [4, 3, 2, 2, 1]},
    //9-1
    {difficulty: 8, colors: [4, 3, 2, 2, 1]},
    //9-2
    {difficulty: 7, colors: [4, 3, 2, 2, 1]},
    //9-3
    {difficulty: 6, colors: [3, 3, 2, 2, 2]}
];

//bonus levels from the original game have same base with increasing push freq
const defaultLevel = {difficulty: 9, colors: [4, 3, 2, 2, 1]};

//initializes a level with ropes of the input colors
function initLevel() {
    //candle
    pushes = 0;
    candleOn = false;
    candlesThisStage = 0;

    ropes = [];
    knots = [];

    //default settings
    let difficulty = defaultLevel.difficulty;
    let colors = defaultLevel.colors;

    //if in defined level, do that
    if (level < levels.length) {
        difficulty = levels[level].difficulty;
        colors = levels[level].colors;
    }

    //make list containing correct amount of each hex code
    let unscrambled = [];
    for (let i = 0; i < colors.length; i++) {
        //colorCodes[i] is the rope's hex color, colors[i] is number of ropes of that color
        for (let n = 0; n < colors[i]; n++) {
            unscrambled.push(colorCodes[i]);
        }
    }

    //randomize order of colored ropes
    let col = 0;
    while(unscrambled.length > 0) {
        let i = Math.floor(Math.random() * unscrambled.length);
        ropes.push({color: unscrambled[i], path: Array(numRows).fill(0), endCol: col});
        unscrambled.splice(i, 1);
        col++;
    }

    //add knots
    for (let i = 0; i < difficulty; i++) {
        pushDown();
    }

    //adjust cursor
    cursorCol = 0;
    cursorRow = findCursorRow(0);
}

//initialize new game
function newGame(inputLevel = startLevel) {
    //update high score from prev game
    updateHighScore();

    level = inputLevel;
    numBoosts = 0;
    score = 0;

    initLevel();

    gameOver = false;
    resumeGame();

    drawGame();
}

//twists the two ropes under the cursor and adds/removes a knot if necessary
function twist() {
    //ropes switch starting columns
    var temp = ropes[cursorCol];
    ropes[cursorCol] = ropes[cursorCol + 1];
    ropes[cursorCol + 1] = temp;

    //rope now on left goes right, rope now on right goes left
    ropes[cursorCol].path[cursorRow]++;
    ropes[cursorCol + 1].path[cursorRow]--;

    //check if cursor on a knot
    let i = knots.findIndex(knot => knot.col == cursorCol && knot.row == cursorRow);
    if ( i === -1) {
        //if ropes are the same color, knot has no direction and can be untwisted from either position
        let knotDir = ropes[cursorCol].color === ropes[cursorCol+1].color ? 'both' : cursorLeft ? 'right' : 'left';
        
        //add knot. if cursor is left the right rope is on top
        knots.push({col: cursorCol, row: cursorRow, direction: knotDir, topColor: (cursorLeft ? ropes[cursorCol].color : ropes[cursorCol + 1].color), sparkles: 0});

    } else {
        //add boost if relevant
        if (knots[i].sparkles > 0) {
            numBoosts = Math.min(numBoosts + 1, maxBoosts);
        }
        //remove knot. assume will only be on knot if cursor fits the knot's direction
        knots.splice(i, 1);
        //remove ropes if untied
        comb();
    }

    //update cursor
    cursorLeft = !cursorLeft;
    cursorRow = findCursorRow(cursorCol);
}

//remove straight ropes. advance level if no more ropes
function comb() {
    let i = 0;
    while (i < ropes.length) {
        //ropes are straight when every element is 0
        if (ropes[i].path.every(e => e == 0)) {
            //update candle values
            updateCandle(i);

            //increase score
            calculateRopeScore();

            //remove rope
            ropes.splice(i, 1);

            //every rope after the deleted rope must recalculate end col
            for (let j = i; j < ropes.length; j++) {
                let total = ropes[j].path.reduce((sum, number) => sum + number, 0);
                ropes[j].endCol = j + total;
            }
            
            //knots with columns after deleted rope decrease col
            knots.forEach(knot => {
                if (knot.col >= i) {
                    knot.col--;
                }
            });

            //adjust cursor if necessary
            if (cursorCol > i) {
                cursorCol--;
            }
        } else {
            //only increase i when we haven't deleted a rope
            i++;
        }
    }

    //level complete!
    if (knots.length == 0 && ropes.length == 0) {
        //increase score based on level
        calculateLevelScore();
        level++;
        initLevel();
    } else {
        //adjust cursor col if ropes have been removed but still exist
        cursorCol = Math.min(cursorCol, ropes.length - 2);
        cursorRow = findCursorRow(cursorCol);

        //don't let cursor be pushed off board
        if (cursorRow < 0) {
            moveLeft();
        }
    }

    drawGame();
}

//use a boost to change cursor direction without twisting
function useBoost () {
    if (numBoosts > 0) {
        cursorLeft = !cursorLeft;
        numBoosts--;
    }
}

//Caclulate X position on canvas
function coltoX(col) {
    //ropes are centered--find left edge based on number of ropes
    let leftEdge = (canvas.width - ((ropes.length - 1) * colWidth))/2;

    return leftEdge + col * colWidth;
}

//calculate Y position on canvas
function rowtoY(row) {
    //we index from bottom but canvas indexes from top: subtract from height
    return canvas.height - (row * rowHeight) - lowBuffer;
}

//returns true if curser matches input knot direction
function directionMatches(dir) {
    if (dir === 'both') {
        return true;
    } else if (dir === 'left' && cursorLeft) {
        return true;
    } else if (dir === 'right' && !cursorLeft) {
        return true;
    } else {
        return false;
    }
}

//find which row the cursor is in--highest row without knots
//find highest row in input col without knots
function findCursorRow(col) {
    let row = 0;
    for (; row < numRows; row++) {
        //unstraight ropes above cursor
        if (ropes[col].path[row] != 0 || ropes[col + 1].path[row] != 0) {
            //if cursor matches knot, it goes over it
            if (knots.find(knot => knot.col == col && knot.row == row && directionMatches(knot.direction))) {
                return row;
            } else { //otherwise cursor is beneath knot
                return row - 1;
            }
        }
    }
    return row - 1;
}

//adds the score for completing the current level
function calculateLevelScore() {
    //score based on level and stage
    if (level < levels.length) {
        score += originalLevel(level) * (100 + 50 * (level%3));
    } else {
        //bonus levels give 1k * bonus level number
        score += 1000 * (level - levels.length + 1); 
    }
}

//adds the score for clearing a rope depending on level and number of colors
function calculateRopeScore() {
    if (level < levels.length) { 
        score += 5 * (originalLevel(level)-1) + 10 * (levels[level].colors.length);
    } else {
        score += 110; //bonus levels
    }
}

//how the level displays on the original game
function originalLevel(level) {
    return Math.floor(level/3) + 1;
}

//how the stage displays on the original game
function originalStage(level) {
    return level%3 + 1;
}

//pushes down all the knots & forms new ones at the top
//game over if a knot reaches the bottom
//onscreen is true if push happening during level (instead of during setup)
function pushDown (onscreen = false) {
    //track visible pushDowns
    if (onscreen) {
        pushes++;
    }
    //remove candle rope if relevant
    burnCandle();

    //remove first segment from each rope's path
    ropes.forEach(rope => {
        rope.path.shift();
        rope.path.push(0);
    });

    //decrease row for each knot
    knots.forEach(knot => {
        knot.row--;
        if (knot.row < 0) {
            //GAME OVER!
            handleGameOver();
            return;
        }
    });

    //twist the tops of the ropes at random
    let i = 0;
    while (i < ropes.length - 1) {
        let r = Math.random();
        if (r < 0.5) {
            //don't twist w 50% prob
            i++;
        } else {
            let leftRope = ropes.find(rope => rope.endCol == i);
            let rightRope = ropes.find(rope => rope.endCol == i + 1);

            //moves rightwards
            leftRope.path[numRows - 1]++;
            leftRope.endCol++;

            //moves leftwards
            rightRope.path[numRows - 1]--;
            rightRope.endCol--;

            //if same color, direction is 'both'. otherwise, choose direction at random 
            if (leftRope.color === rightRope.color) {
                var knotDir = 'both';
                var knotColor = rightRope.color; //will never be accessed but doesn't hurt
            } else if (r < 0.75) {
                var knotDir = 'left';
                var knotColor = rightRope.color;
            } else {
                var knotDir = 'right';
                var knotColor = leftRope.color;
            }

            //sparkles appear on new knots 
            let sparkle = 0;
            if (onscreen && pushes > 2 && pushes < 10) { //TODO: check against original game
                if (Math.random() < 1/3) {
                    sparkle = 3;
                }
            }

            let newKnot = {col: i, row: numRows - 1, direction: knotDir, topColor: knotColor, sparkles: sparkle};
            knots.push(newKnot);

            //if rope with candle has been moved, adjust candleTopCol accordingly
            if (candleOn) {
                if (candleTopCol == i) {
                    candleTopCol++;
                } else if (candleTopCol == i + 1) {
                    candleTopCol--;
                }
            }

            //advance over both ropes
            i += 2;
        }
    }

    //adjust cursor row
    cursorRow = findCursorRow(cursorCol);
    
    //don't let cursor be pushed off board-- move whichever direction has space
    if (cursorRow < 0 && ropes.length > 0) {
        moveLeft();
        if (cursorRow < 0) {
            moveRight();
        }
    }

    //cursor cannot move anywhere: game over
    if (cursorRow < 0) {
        handleGameOver();
    }
}

//ends the game
function handleGameOver() {
    pauseGame();
    gameOver = true;

    //gain 30 points per unused boost
    score += 30 * numBoosts;

    //clear text area
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, 75);

    //update high score & redraw text accordingly
    let scoreUpdated = updateHighScore();
    drawLoomAndText(scoreUpdated);

    drawGameOver();
}

//saves score to local storage if higher than saved one, returns true if so
function updateHighScore() {
    //compare current score to saved high score
    if (score > highScore) {
        localStorage.setItem('highScore', score);
        highScore = score;
        return true;
    }
    return false;
}

//draws the "Game Over" text
function drawGameOver() {
    //black bar for text to go over
    ctx.fillStyle = 'black';
    ctx.fillRect(0, canvas.height/2 - 60, canvas.width, 150);

    //red text
    ctx.font = "bold 60px Courier New";
    ctx.fillStyle = 'red'; //brighter red than the ropes
    ctx.textAlign = 'center';

    ctx.fillText("GAME OVER", canvas.width/2, canvas.height/2);

    //white instruction text
    drawMessage('Press space to begin a new game', 25, canvas.height/2 + 40)

    drawLevelSelect();
}

//draw full canvas
function drawGame() {
    //ropes drawn during game over are undefined
    if (!gameRunning) {
        return;
    }

    //clear canvas
    clearCanvas();

    //draw each rope
    for (let rope = 0; rope < ropes.length; rope++) {
        ctx.beginPath();
        ctx.strokeStyle = ropes[rope].color;
        ctx.lineWidth = ropeWidth;

        //start drawing at bottom of rope
        ctx.moveTo(coltoX(rope), rowtoY(0));

        //starting col is the rope number
        let col = rope; 
        for (let row = 0; row < numRows; row++) {
            //ending col modified by direction of rope at this row
            col += ropes[rope].path[row];
            ctx.lineTo(coltoX(col), rowtoY(row + 1));
            ctx.stroke();
        }
    }

    //draw top rope of each knot
    knots.forEach(knot => {
        //start & end points depend on knot dir
        let startPt = [];
        let endPt = [];

        //black line must be shorter to avoid overlap with other segments
        let blackStartPt = [];
        let blackEndPt = [];

        if (knot.direction === 'left') {
            //top rope is the right one
            startPt = [coltoX(knot.col + 1), rowtoY(knot.row)];
            endPt = [coltoX(knot.col), rowtoY(knot.row + 1)];

            blackStartPt = [coltoX(knot.col + 0.75), rowtoY(knot.row + 0.25)];
            blackEndPt = [coltoX(knot.col + 0.25), rowtoY(knot.row + 0.75)];
        }
        else if (knot.direction === 'right') {
            //top rope is the left one
            startPt = [coltoX(knot.col), rowtoY(knot.row)];
            endPt = [coltoX(knot.col + 1), rowtoY(knot.row + 1)];
            
            blackStartPt = [coltoX(knot.col + 0.25), rowtoY(knot.row + 0.25)];
            blackEndPt = [coltoX(knot.col + 0.75), rowtoY(knot.row + 0.75)];
        } else {
            return;
        }

        //draw larger black line underneath to leave shadow
        ctx.beginPath();
        ctx.lineWidth = ropeWidth*2;
        ctx.strokeStyle = 'black';
        ctx.moveTo(blackStartPt[0], blackStartPt[1]);
        ctx.lineTo(blackEndPt[0], blackEndPt[1]);
        ctx.stroke();

        //now the upper rope
        ctx.beginPath();
        ctx.lineWidth = ropeWidth;
        ctx.strokeStyle = knot.topColor;
        ctx.moveTo(startPt[0], startPt[1]);
        ctx.lineTo(endPt[0], endPt[1]);
        ctx.stroke();
    });

    //draw sparkles on each knot if relevant
    drawSparkles();

    //draw cursor
    ctx.beginPath();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'white';
    if (cursorLeft) {
        ctx.moveTo(coltoX(cursorCol), rowtoY(cursorRow+1));
        ctx.lineTo(coltoX(cursorCol + 1), rowtoY(cursorRow));
    } else {
        ctx.moveTo(coltoX(cursorCol + 1), rowtoY(cursorRow+1));
        ctx.lineTo(coltoX(cursorCol), rowtoY(cursorRow));
    }
    ctx.stroke();

    //draw column indicator beneath loom
    //faces in direction of cursor
    ctx.beginPath();
    let counterClockwise = true;
    if (cursorLeft) {
        counterClockwise = false;
    }
    ctx.arc(coltoX(cursorCol) + colWidth/2, canvas.height - lowBuffer/2, 7, 0.5 * Math.PI, 1.5 * Math.PI, counterClockwise);
    ctx.stroke();

    //draw boosts as circles along the sides of the ropes
    for (let i = 0; i < numBoosts; i++) {
        let xval = 0;

        //even numbered boosts drawn on left, odd on right
        if (i%2 == 0) {
            xval = coltoX(0) - 1.5 * colWidth;
        } else {
            xval = coltoX(ropes.length - 1) + 1.5 * colWidth;
        }

        let yval = loomHeight + rowHeight/2 + rowHeight * Math.floor(i/2);

        ctx.beginPath();
        ctx.fillStyle = 'white';
        ctx.arc(xval, yval, 5, 0, 2 * Math.PI);
        ctx.fill();
    }

    //display text
    drawLoomAndText();

    //draw candle
    if (candleOn) {
        drawCandle();
    }
}

function clearCanvas() {
    //fill full canvas with black
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

//draws the loom, level, score, high score
//if there's a new high score, draw it in red
function drawLoomAndText(newHighScore = false) {
    //draw loom (lines at top & bottom of ropes)
    let loomBuffer = 60;
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'white';
    ctx.moveTo(loomBuffer, loomHeight);
    ctx.lineTo(canvas.width-loomBuffer, loomHeight);
    ctx.stroke();    
    ctx.moveTo(loomBuffer, rowtoY(0));
    ctx.lineTo(canvas.width-loomBuffer, rowtoY(0));
    ctx.stroke();
    
    //all lable text in this style
    ctx.font = '20px Courier New';
    ctx.fillStyle = 'white';

    let margin = 40;
    let topRow = 35;
    let bottomRow = 65;

    //level: top left
    ctx.textAlign = 'left';
    ctx.fillText('Level:', margin, topRow);

    //score: top right
    ctx.textAlign = 'right';
    ctx.fillText('Score:', canvas.width - margin, topRow);

    //high score: middle
    ctx.textAlign = 'center';
    ctx.fillText('High score:', canvas.width/2, topRow);

    //values have larger text
    ctx.font = '23px Courier New';

    //level: top left
    ctx.textAlign = 'left';
    let displayLevel = '';
    if (level < levels.length) {
        displayLevel = originalLevel(level).toString() + '-' + originalStage(level).toString();
    } else {
        //bonus levels
        displayLevel = 'B-' + (level - levels.length + 1).toString();
    }
    ctx.fillText(displayLevel, margin+15, bottomRow);

    //score: right
    ctx.textAlign = 'right';
    ctx.fillText(score, canvas.width - margin, bottomRow);
    
    //high score: center
    ctx.textAlign = 'center';
    if (newHighScore) { //new high scores displayed in red
        ctx.font = 'bold 23px Courier New';
        ctx.fillStyle = 'red';
    }
    ctx.fillText(highScore, canvas.width/2, bottomRow);
}

//draw pause menu: current level info and input message
function drawPause(message) {
    clearCanvas();
    drawLoomAndText();

    //larger font than level 
    drawMessage(message, 27, canvas.height/2)
}

//pauses/resumes the game depending on current state and updates button text
function pauseButton() {
    if (gameOver) {
        newGame();
    } else if (gameRunning) {
        pauseGame();
        drawPause('Paused');
    } else {
        resumeGame();
        drawGame();
    }
}

//changes the gameRunning flag and updates the play/pause button
function pauseGame() {
    document.getElementById('pause').innerText = playSymbol;
    gameRunning = false;
}

//changes the gameRunning flag and updates the play/pause button
function resumeGame() {
    document.getElementById('pause').innerText = pauseSymbol;
    gameRunning = true;
}


//helper
function drawLevelSelect() {
    drawMessage('Or enter number to select level', 20, canvas.height/2+70);
}

//helper. writes the input message centered
function drawMessage(message, size, height) {
    ctx.font = size.toString() + 'px Courier New';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';

    ctx.fillText(message, canvas.width/2, height);
}

//update sparkles for each knot
//sparkles last for 3 pushes down
function updateSparkles() {
    knots.forEach(knot => {
        knot.sparkles--;
    });
}

//draws sparkles on knots that have them
//sparkles are two circles 
function drawSparkles() {
    knots.forEach(knot => {
        if (knot.sparkles > 0) {
            ctx.beginPath();
            ctx.fillStyle = 'white';
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;

            //the center of the knot
            let centerX = coltoX(knot.col) + colWidth/2;
            let centerY = rowtoY(knot.row) - rowHeight/2;

            //sparkle has large circle on bottom & small circle on top
            //bottom circle is to the left if knot goes to the right
            let bottomShift = 7;
            if (knot.direction === 'right' ) {
                bottomShift = -7;
            } else if (knot.direction === 'both') {
                //direction should not shift while knot is in same place
                //but different knots should have different directions
                //TODO: change to something nicer
                bottomShift = (knot.col)%2 == 0 ? -7 : 7;
            }

            //they decrease in size as they get closer to disappearing
            ctx.arc(centerX + bottomShift, centerY + 4, (knot.sparkles+1)*1.5, 0, 2 * Math.PI);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(centerX - bottomShift, centerY - 3, knot.sparkles+1, 0, 2 * Math.PI);
            ctx.stroke();
        }
    });
}

//randomly lights candle if appropriate. randomly assigns columns
function lightCandle() {
    //candle only lights when already unlit, after first push, starting at level 2-3
    //only lights candlesPerStage times per level
    if (bonusesOn && !candleOn && pushes > 0 && level >= 5 && candlesThisStage < candlesPerStage) {
        //don't light candle if it was just turned off        
        if (candlesThisStage > 0 && pushes - candleStart < 4) {
            return;
        }

        //light with 1/3 chance
        if (Math.random() < 1/3) {
            candleOn = true;
            candleStart = pushes;
            candleTopCol = Math.floor(Math.random() * ropes.length);
            candleBottomCol = Math.floor(Math.random() * ropes.length);
            candlesThisStage++;
        }
    }
}

//draws red dots at the top and bottom in appropriate columns
function drawCandle() {
    ctx.beginPath();
    ctx.fillStyle = 'red';

    let margin = 12;

    //top circle
    ctx.arc(coltoX(candleTopCol), loomHeight - margin, 5, 0, 2*Math.PI);
    ctx.fill();

    //bottom circle
    ctx.beginPath();
    ctx.arc(coltoX(candleBottomCol), canvas.height - lowBuffer + margin, 5, 0, 2*Math.PI);
    ctx.fill();
}

//updates candle values when a rope of index i is removed
function updateCandle(i) {
    if (candleOn) {
        //turn off candle if it was on this rope
        if (ropes[i].endCol == candleTopCol) {
            candleOn = false;
        } else { //otherwise adjust indicators
            if (ropes[i].endCol < candleTopCol) {
                candleTopCol--;
            }

            //TODO: check against original
            if (candleBottomCol > ropes.length - 2) {
                candleOn = false;
            }
        }
    }
}

//debug helper
function ropeString() {
    let ropeString = '';
    let i = 0;
    ropes.forEach(rope => {
        ropeString += i.toString() + ' ['
        ropeString += rope.path.toString();
        ropeString += '] ' + rope.endCol.toString() + '\n';
        i++;
    })
    return ropeString;
}

//debug helper
function knotString() {
    let knotString = '';
    knots.forEach(knot => {
        knotString += '\tcol: ' + knot.col.toString() + ', row: ' + knot.row.toString() + '\n';
    })
    return knotString;
}

//checks if the user has aligned the candle indicators and deletes the rope if so
function burnCandle(){
    if (candleOn) {
        //check if candle rope is aligned
        for (let i = 0; i < ropes.length; i++) {
            if (candleBottomCol == i && candleTopCol == ropes[i].endCol) {
                candleOn = false;

                //find knots along rope we remove
                let col = i;
                let deletedKnots = [];
                for (let row = 0; row < numRows; row++) {
                    let dir = ropes[i].path[row];

                    if (dir != 0) {
                        //reached knot
                        let knotCol = dir == 1 ? col : col - 1;
                        
                        //delete from list of knots
                        let j = knots.findIndex(knot => knot.row == row && knot.col == knotCol);
                        if (j != -1) {
                            knots.splice(j, 1);
                            deletedKnots.push({row: row, col: knotCol});
                        }
                    }

                    //decrease knots cols to the right of our rope
                    knots.forEach(knot => {
                        if (knot.row == row && knot.col > col) {
                            knot.col--;
                        }
                    })

                    col += dir;
                }

                //go thru other ropes to straighten parts that interracted with deleted knots
                for (let j = 0; j < ropes.length; j++) {
                    if (j != i) {
                        col = j;
                        for (let row = 0; row < numRows; row++) {
                            let dir = ropes[j].path[row];
                            
                            if (dir != 0) {
                                //reached knot
                                let knotCol = dir == 1 ? col : col - 1;

                                //check if deleted knot and straighten if so
                                if (deletedKnots.findIndex(knot => knot.row == row && knot.col == knotCol) != -1) {
                                    ropes[j].path[row] = 0;
                                }

                                col += dir;
                            }
                        }
                    }
                }

                //remove rope
                ropes.splice(i, 1);

                //adjust cursor
                if (cursorCol >= i || cursorCol > ropes.length - 2) {
                    moveLeft();
                }

                //every rope must recalculate end col
                for (let j = 0; j < ropes.length; j++) {
                    let total = ropes[j].path.reduce((sum, number) => sum + number, 0);
                    ropes[j].endCol = j + total;
                }

                //remove any remaining straightened ropes
                comb();

                break; //only need to delete one rope
            }
        }

        //remove candle if it has been onscreen for too long
        if (candleOn && pushes - candleStart >= 3) {
            candleOn = false;
        }
    }
}

//toggles bonuses on or off
function toggleBonuses() {
    bonusesOn = !bonusesOn;
    localStorage.setItem('bonusesOn', bonusesOn);
    updateBonusButton();
}

//updates the bonus button to display on or off symbol
function updateBonusButton() {
    if (bonusesOn) {
        document.getElementById('bonus').innerText = bonusOnSymbol;
        
    } else {
        document.getElementById('bonus').innerText = bonusOffSymbol;
    }
}

//changes the default starting level to the selected value and begins new game
function changeStartLevel() {
    startLevel = document.getElementById('startLevel').value;
    localStorage.setItem('startLevel', startLevel);
    newGame();
}

//moves the cursor to the next leftwards open column or stays in place
function moveLeft() {
    let newCol = cursorCol;
    let newRow = -1;

    //don't let cursor have negative row-- skip to column where it doesn't or don't move
    while (newRow < 0) {
        newCol--;
        if (newCol < 0) { //reached left side: we don't move
            break;
        }
        newRow = findCursorRow(newCol);
    }

    //move cursor if valid column
    if (newCol >= 0) {
        cursorCol = newCol;
        cursorRow = newRow;
    }
}

//moves the cursor to the next rightwards open column or stays in place
function moveRight() {
    let newCol = cursorCol;
    let newRow = -1;
    
    //don't let cursor have negative row-- skip to column where it doesn't or don't move
    while (newRow < 0) {
        newCol++;
        if (newCol > ropes.length - 2) { //reached right side: we don't move
            break;
        }
        newRow = findCursorRow(newCol);
    }

    //move cursor if valid column
    if (newCol <= ropes.length - 2) {
        cursorCol = newCol;
        cursorRow = newRow;
    }
}

//handle keyboard input
document.addEventListener('keydown', (event) => {
    //begin new games
    if (event.key === 'n' || event.key === '0' || event.key === '1') {
        newGame();
        return;
    }
    let parsed = parseInt(event.key); 
    if (parsed > 1 && parsed < 10) {
        let startLevel = (parseInt(event.key) - 1) * 3;
        newGame(startLevel);
        return;
    }

    if (event.key === 'Tab' || event.key === ' ' || event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'ArrowLeft' || event.key === 'ArrowRight' ) {
        event.preventDefault(); //prevent default behavior
    }

    if (gameRunning) { //game input while running
        if (event.key === 'ArrowLeft' || event.key === 'a') {
            moveLeft();
        } else if (event.key === 'ArrowRight' || event.key === 'd') {
            moveRight();
        } else if (event.key === ' ' || event.key === 'ArrowUp' || event.key === 'w') {
            twist();
        } else if (event.key === 'Tab' || event.key === 'ArrowDown' || event.key === 's') {
            useBoost();
            //switching direction may cause cursor to go up
            cursorRow = findCursorRow(cursorCol);
        } else if (event.key === 'p') {
            pauseGame();
            drawPause('Press space to resume game');
        }
        drawGame();
    } else if (!gameOver) {
        //game is paused-- press space to start
        if (event.key === ' ') {
            resumeGame();
            drawGame();
        }
    } else {
        //game is over-- press space to start new game
        if (event.key === ' ') {
            newGame();
        }
    }
});

//handle touchscreen input in canvas area
//tap = space
//swipe left = left arrow
//swipe right = right arrow
//2 finger tap = tab
//3+ finger tap = pause
let startX, doTwist;
canvas.addEventListener('touchstart', (event) => {
    event.preventDefault();
    doTwist = false;

    //handle normal movements
    if (gameRunning) {
        //1 finger: move or twist
        if (event.touches.length == 1) {
            //do a twist by default, but save x pos to see if user is moving
            startX = event.touches[0].clientX;
            doTwist = true;
        } 
        //2 fingers: boost
        else if (event.touches.length == 2) {
            useBoost();
            //switching direction may cause cursor to go up
            cursorRow = findCursorRow(cursorCol);
            drawGame();
        }
        // more fingers: pause
        else {
            pauseGame();
            drawPause('Tap to resume game');
        }
    } else if (!gameOver) {
        //unpause
        resumeGame();
        drawGame();
    } else {
        //game is over, start new game
        newGame();
    }
});

//handle finger moving. updates so user can move finger back and forth without releasing
canvas.addEventListener('touchmove', (event) => {
    event.preventDefault();
    let endX = event.touches[0].clientX;

    //check current X pos against previous
    if (endX - startX > 13) {
        moveRight();
        drawGame();
        startX = endX;
        doTwist = false;
    } else if (endX - startX < -13) {
        moveLeft();
        drawGame();
        startX = endX;
        doTwist = false;
    }
});

//handle finger release
canvas.addEventListener('touchend', () => {
    //single touch, finger has not moved
    if (doTwist) {
        twist();
        drawGame();
    }
});

//update high score on window close
document.addEventListener('visibilitychange', () => {
    updateHighScore();
});

//pause when window unfocused
document.addEventListener('blur', () => {
    if (gameRunning) {
        pauseGame();
        drawPause('Press space to resume game');
    }
})

//the wait time between loops is dependent on level
function sleep(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
}
const maxFreq = 6000;
const minFreq = 1000;
const freqChangeRate = (maxFreq-minFreq)/40; //reach minimum frequency after 40 levels

//game loop to move down knots 
function gameLoop() {
    if (gameRunning) {
        //remove straight ropes and advance level
        comb();

        //decrease all the sparkles before pushdown adds new ones
        updateSparkles();

        //push down knots and check if game over
        //adding sparkles
        pushDown(true);

        //light candle if applicable
        lightCandle();
        
        //TODO: paintbrush appears starging on 3-1

        drawGame();
    }
}

//initialize game
initLevel();

//game starts in paused state 
drawPause('Press space to begin game');
drawLevelSelect();

//infinite loop to execute game loop at increasing frequency
async function runGameLoop() {
    while (true) {
        gameLoop();

        // Recalculate the delay each iteration; keep it between 1 and 6 seconds.
        const loopFreq = Math.max(minFreq, maxFreq - level * freqChangeRate);
        await sleep(loopFreq);
    }
}

runGameLoop();
