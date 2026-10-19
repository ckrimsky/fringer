const canvas = document.getElementById('fringerCanvas');
const ctx = canvas.getContext('2d');

//rendering sizes
const colWidth = 30;
const rowHeight = 35;
const ropeWidth = 6;
const numRows = 15;

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
const maxBoosts = 10;
let level = 0;
let score = 0;

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
//TODO: levels difficulty is scaled to expect increasing push frequency
const levels = [
    //level 1 = 1-1
    {difficulty: 6, colors: [11, 1]},
    //level 2 = 1-2
    {difficulty: 6, colors: [10, 1, 1]},
    //level 3 = 1-3
    {difficulty: 6, colors: [9, 2, 2]},
    //level 4 = 2-1
    {difficulty: 8, colors: [7, 4, 1]},
    //level 5 = 2-2
    {difficulty: 7, colors: [8, 2, 1, 1]},
    //level 6 = 2-3
    {difficulty: 6, colors: [7, 3, 1, 1]},
    //level 7 = 3-1
    {difficulty: 8, colors: [6, 5, 1]},
    //level 8 = 3-2
    {difficulty: 7, colors: [7, 2, 2, 1]},
    //level 9 = 3-3
    {difficulty: 6, colors: [6, 4, 1, 1]},
    //level 10 = 4-1
    {difficulty: 8, colors: [6, 3, 2, 1]},
    //level 11 = 4-2
    {difficulty: 7, colors: [8, 2, 2]},
    //level 12 = 4-3
    {difficulty: 6, colors: [7, 3, 2]},
    //level 13 = 5-1
    {difficulty: 8, colors: [6, 4, 2]},
    //level 14 = 5-2
    {difficulty: 7, colors: [5, 5, 1, 1]},
    //level 15 = 5-3
    {difficulty: 6, colors: [6, 2, 2, 2]},
    //level 16 = 6-1
    {difficulty: 8, colors: [5, 4, 3]},
    //level 17 = 6-2
    {difficulty: 7, colors: [5, 4, 3]},
    //level 18 = 6-3
    {difficulty: 6, colors: [5, 3, 2, 2]},
    //level 19 = 7-1
    {difficulty: 8, colors: [4, 4, 2, 2]},
    //level 20 = 7-2
    {difficulty: 7, colors: [4, 3, 3, 2]},
    //level 21 = 7-3
    {difficulty: 6, colors: [3, 3, 3, 3]},
    //level 22 = 8-1
    {difficulty: 8, colors: [5, 2, 2, 2, 1]},
    //level 23 = 8-2
    {difficulty: 7, colors: [5, 2, 2, 2, 1]},
    //level 24 = 8-3
    {difficulty: 6, colors: [4, 3, 2, 2, 1]},
    //level 25 = 9-1
    {difficulty: 8, colors: [4, 3, 2, 2, 1]},
    //level 26 = 9-2
    {difficulty: 7, colors: [4, 3, 2, 2, 1]},
    //level 27 = 9-3
    {difficulty: 6, colors: [3, 3, 2, 2, 2]}
];

//bonus levels from the original game have same base with increasing push freq
const defaultLevel = {difficulty: 9, colors: [4, 3, 2, 2, 1]};

//initializes a level with ropes of the input colors
function initLevel() {
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
function newGame() {
    level = 0;
    numBoosts = 3;
    score = 0;

    initLevel();

    gameRunning = true;
    gameOver = false;
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
            //increase score
            //TODO: different scores for different ropes?
            score += 20;

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
        level++;
        score += 100;
        initLevel();
    } else {
        //adjust cursor col if ropes have been removed but still exist
        cursorCol = Math.min(cursorCol, ropes.length - 2);
        cursorRow = findCursorRow(cursorCol);
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
    return canvas.height - (row * rowHeight);
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


//pushes down all the knots & forms new ones at the top
//game over if a knot reaches the bottom
function pushDown () {
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
            gameRunning = false;
            gameOver = true;
            drawGameOver();
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

            let newKnot = {col: i, row: numRows - 1, direction: knotDir, topColor: knotColor, sparkles: 0};
            knots.push(newKnot);

            //advance over both ropes
            i += 2;
        }
    }

    //adjust cursor row
    cursorRow = findCursorRow(cursorCol);
}

//draws the "Game Over" text
function drawGameOver() {
    //black bar for text to go over
    ctx.fillStyle = 'black';
    ctx.fillRect(0, canvas.height/2 - 60, canvas.width, 120);

    //red text
    ctx.font = "bold 60px Courier New";
    ctx.fillStyle = colorCodes['red'];
    ctx.textAlign = 'center';

    ctx.fillText("GAME OVER", canvas.width/2, canvas.height/2);

    //white instruction text
    ctx.font = '25px Courier New';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';

    ctx.fillText('Press space to begin a new game', canvas.width/2, canvas.height/2 + 40);
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
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'white';
    if (cursorLeft) {
        ctx.moveTo(coltoX(cursorCol), rowtoY(cursorRow+1));
        ctx.lineTo(coltoX(cursorCol + 1), rowtoY(cursorRow));
    } else {
        ctx.moveTo(coltoX(cursorCol + 1), rowtoY(cursorRow+1));
        ctx.lineTo(coltoX(cursorCol), rowtoY(cursorRow));
    }
    ctx.stroke();

    //display text
    drawLoomAndText();
}

function clearCanvas() {
    //fill full canvas with black
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

//draws the loom, level, score, boosts
function drawLoomAndText() {
    //draw loom (line at top of ropes)
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'white';
    ctx.moveTo(100, 75);
    ctx.lineTo(canvas.width-100, 75);
    ctx.stroke();    

    //all text in this style
    ctx.font = '20px Courier New';
    ctx.fillStyle = 'white';

    //level top right
    ctx.textAlign = 'left';
    ctx.fillText('Level:', canvas.width - 175, 50);
    //ctx.stroke();
    ctx.textAlign = 'right';
    ctx.fillText(level+1, canvas.width - 40, 50); //visible level indexes from 1
    //ctx.stroke();

    //score top left
    ctx.textAlign = 'left';
    ctx.fillText('Score:', 40, 50);
    ctx.textAlign = 'right';
    ctx.fillText(score, 200, 50);

    //draw boosts as circles along the sides of the ropes
    for (let i = 0; i < numBoosts; i++) {
        let xval = 0;

        //even numbered boosts drawn on left, odd on right
        if (i%2 == 0) {
            xval = coltoX(0) - 2 * colWidth;
        } else {
            xval = coltoX(ropes.length - 1) + 2 * colWidth;
        }

        let yval = 100 + rowHeight * Math.floor(i/2);

        ctx.beginPath();
        ctx.fillStyle = 'white';
        ctx.arc(xval, yval, 5, 0, 2 * Math.PI);
        ctx.fill();
    }
}

//draw pause menu: current level info and input message
function drawPause(message) {
    clearCanvas();
    drawLoomAndText();

    //larger font than level 
    ctx.font = '30px Courier New';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';

    ctx.fillText(message, canvas.width/2, canvas.height/2);
}

//update sparkles for each knot: if none, add randomly
//sparkles last for 3 pushes down
function updateSparkles() {
    knots.forEach(knot => {
        if (knot.sparkles == 0) {
            //no sparkles: add with 5% prob
            if (Math.random() < 0.05) {
                knot.sparkles = 3;
            }
        } else {
            //otherwise count down
            knot.sparkles--;
        }
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
    if (event.key === 'n') {
        //new game!
        newGame();
    }
    if (event.key === 'Tab' || event.key === ' ' || event.key === 'ArrowDown' || event.key === 'ArrowUp' ) {
        event.preventDefault(); //prevent default behavior
    }

    if (gameRunning) { //game input while running
        if (event.key === 'ArrowLeft') {
            moveLeft();
        } else if (event.key === 'ArrowRight') {
            moveRight();
        } else if (event.key === ' ' || event.key === 'x') {
            twist();
        } else if (event.key === 'Tab' || event.key === 'ArrowDown') {
            useBoost();
            //switching direction may cause cursor to go up
            cursorRow = findCursorRow(cursorCol);
        } else if (event.key === 'p') {
            gameRunning = false;
            drawPause('Press space to resume game');
        }
        drawGame();
    } else if (!gameOver) {
        //game is paused-- press space to start
        if (event.key === ' ') {
            gameRunning = true;
            drawGame();
        }
    } else {
        //game is over-- press space to start new game
        if (event.key === ' ') {
            newGame();
        }
    }
});


//game loop to move down knots 
function gameLoop() {
    if (gameRunning) {
        //remove straight ropes and advance level
        comb();

        //push down knots and check if game over
        pushDown();

        updateSparkles();

        drawGame();
    }
}

//initialize game-- default for now
initLevel();
//set correct row at start
cursorRow = findCursorRow(cursorCol);

//game starts in paused state 
drawPause('Press space to begin game');

//push down every 6s
setInterval(gameLoop, 6000);

//TODO: original game starts with bar every 6s but lowers interval as level increases

