const canvas = document.getElementById('fringerCanvas');
const ctx = canvas.getContext('2d');

//rendering sizes
const colWidth = 30;
const rowHeight = 35;
const ropeWidth = 6;
const leftBuffer = 100;

const numRows = 15;

//define each color's hex code
const colorCodes = {'blue': '#4e9ea3', 'red':'#a42309'};

//cursor
let cursorCol = 0;
let cursorRow = 0;
let cursorLeft = true; //true is left, false is right

//game state
let gameRunning = true;
let numBoosts = 3;
let level = 0;

let ropes = [];
let knots = [];

//indexing from bottom. 0 is straight, -1 is left, 1 is right
//index in ropes array is the rope number from left

//example small game with one knot for debugging
function initSmall() {
    ropes = [
        {color: 'blue', path: [0, 0, 0, 1, 0], endCol: 1},
        {color: 'red', path: [0, 0, 0, -1, 0], endCol: 0},
        {color: 'blue', path: [0, 0, 0, 0, 0], endCol: 2}
    ];
    knots = [
        {col: 0, row: 3, direction: 'left', topColor: 'red'}
    ];
}

//built-in game levels
const levels = [
    {difficulty: 3, colors: [{color: 'blue', ropes: 11}, {color: 'red', ropes: 1}]},
    {difficulty: 3, colors: [{color: 'blue', ropes: 10}, {color: 'red', ropes: 2}]}
];
const defaultLevel = {difficulty: 4, colors: [{color: 'blue', ropes: 10}, {color: 'red', ropes: 3}]};

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
    colors.forEach(c => {
        for (let n = 0; n < c.ropes; n++) {
            unscrambled.push(colorCodes[c.color]);
        }
    });

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
    level = 1;
    numBoosts = 3;

    initLevel();

    gameRunning = true;
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
    let knoti = knots.findIndex(knot => knot.col === cursorCol && knot.row === cursorRow);
    if (knoti === -1) {
        //if ropes are the same color, knot has no direction and can be untwisted from either position
        let knotDir = ropes[cursorCol].color == ropes[cursorCol+1].color ? 'both' : cursorLeft ? 'right' : 'left';
        
        //add knot. if cursor is left the right rope is on top
        knots.push({col: cursorCol, row: cursorRow, direction: knotDir, topColor: (cursorLeft ? ropes[cursorCol].color : ropes[cursorCol + 1].color)});

    } else {
        //remove knot. assume will only be on knot if cursor fits the knot's direction
        knots.splice(knoti, 1);
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
        } else {
            //only increase i when we haven't deleted a rope
            i++;
        }
    }

    //level complete!
    if (knots.length == 0 && ropes.length == 0) {
        level++;
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
    //TODO: center game
    return leftBuffer + col * colWidth;
}

//calculate Y position on canvas
function rowtoY(row) {
    //we index from bottom but canvas indexes from top: subtract from height
    return canvas.height - (row * rowHeight);
}

//returns true if curser matches input knot direction
function directionMatches(dir) {
    if (dir == 'both') {
        return true;
    } else if (dir == 'left' && cursorLeft) {
        return true;
    } else if (dir == 'right' && !cursorLeft) {
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
        if (ropes[col].path[row] !== 0 || ropes[col + 1].path[row] !== 0) {
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
    //console.log('pushDown');
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
            console.log('set game over');

            gameRunning = false;
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
            if (leftRope.color == rightRope.color) {
                var knotDir = 'both';
                var knotColor = rightRope.color; //will never be accessed but doesn't hurt
            } else if (r < 0.75) {
                var knotDir = 'left';
                var knotColor = rightRope.color;
            } else {
                var knotDir = 'right';
                var knotColor = leftRope.color;
            }

            let newKnot = {col: i, row: numRows - 1, direction: knotDir, topColor: knotColor};
            knots.push(newKnot);

            //advance over both ropes
            i += 2;
        }
    }

    //adjust cursor row
    cursorRow = findCursorRow(cursorCol);
    drawGame();
}

//draws the "Game Over" text
function drawGameOver() {
    ctx.font = "50px Courier New";
    ctx.strokeStyle = 'red';

    //center text
    var textWidth = ctx.measureText("GAME OVER").width
    ctx.strokeText("GAME OVER", canvas.width/2 - textWidth/2, canvas.height/2);
}

//draw full canvas
function drawGame() {
    //ropes drawn during game over are undefined
    if (!gameRunning) {
        return;
    }

    //clear canvas
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    //draw each rope
    for (let rope = 0; rope < ropes.length; rope++) {
        ctx.beginPath();
        ctx.strokeStyle = ropes[rope].color;
        ctx.lineWidth = ropeWidth;

        //starting col is the rope number
        let col = rope; 
        for (let row = 0; row < numRows; row++) {
            ctx.moveTo(coltoX(col), rowtoY(row));

            //ending col modified by direction of rope at this row
            col += ropes[rope].path[row];
            ctx.lineTo(coltoX(col), rowtoY(row + 1));
            ctx.stroke();
        }
    }

    //draw knots
    knots.forEach(knot => {
        ctx.beginPath();
        ctx.lineWidth = ropeWidth;
        ctx.strokeStyle = knot.topColor;

        if (knot.direction == 'left') {
            //top rope is the right one
            ctx.moveTo(coltoX(knot.col + 1), rowtoY(knot.row));
            ctx.lineTo(coltoX(knot.col), rowtoY(knot.row + 1));
        }
        else if (knot.direction == 'right') {
            //top rope is the left one
            ctx.moveTo(coltoX(knot.col), rowtoY(knot.row));
            ctx.lineTo(coltoX(knot.col + 1), rowtoY(knot.row + 1));
        }
        ctx.stroke();
    });

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

    //draw current level
    ctx.font = "20px Courier New";
    ctx.strokeStyle = 'white';

    //top right
    ctx.strokeText(level+1, canvas.width - 60, 50); //visible level indexes from 1
}

// Handle keyboard input for cursor movement and twisting
document.addEventListener('keydown', (event) => {
    if (event.key === 'n') {
        //new game!
        newGame();
    }
    if (gameRunning) { //don't accept input after gameover
        if (event.key === 'ArrowLeft') {
            let newCol = Math.max(0, cursorCol - 1);
            let newRow = findCursorRow(newCol);
            
            //don't let cursor have negative row
            if (newRow >= 0) {
                cursorCol = newCol;
                cursorRow = newRow;
            }

        } else if (event.key === 'ArrowRight') {
            let newCol = Math.min(ropes.length - 2, cursorCol + 1);
            let newRow = findCursorRow(newCol);
            
            //don't let cursor have negative row
            if (newRow >= 0) {
                cursorCol = newCol;
                cursorRow = newRow;
            }
        } else if (event.key === ' ') {
            event.preventDefault(); // Prevent default spacebar behavior
            twist();
        } else if (event.key === 'Tab') {   
            event.preventDefault(); // Prevent default tab behavior
            useBoost();
            //switching direction may cause cursor to go up
            cursorRow = findCursorRow(cursorCol);
        }
        drawGame();
    }
});


//game loop to move down knots 
function gameLoop() {
    if (gameRunning) {
        //remove straight ropes and advance level
        comb();

        //push down knots and check if game over
        pushDown();
    }
}

//initialize game-- default for now
initLevel();
//set correct row at start
cursorRow = findCursorRow(cursorCol);
drawGame();

//push down every 7s
setInterval(gameLoop, 7000);



