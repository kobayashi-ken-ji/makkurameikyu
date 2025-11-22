var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { CELL_PX, CANVAS, BG_CANVAS, DIRECTION } from './constants.js';
import { Rect, Bgm, Point, Triangle, Input } from './utility.js';
import { Item, MainChara, EnemyDesign, Enemy, ENEMY_RESULT } from './character.js';
const INVISIBLE_CELL_COLOR = "black";
var EVENT;
(function (EVENT) {
    EVENT[EVENT["NONE"] = 1] = "NONE";
    EVENT[EVENT["WALL"] = 2] = "WALL";
    EVENT[EVENT["STAIRS"] = 3] = "STAIRS";
    EVENT[EVENT["BOX"] = 4] = "BOX";
    EVENT[EVENT["ENEMY"] = 9] = "ENEMY";
})(EVENT || (EVENT = {}));
var WALL;
(function (WALL) {
    WALL[WALL["NORMAL"] = 0] = "NORMAL";
    WALL[WALL["MAPPING_TOP"] = 1] = "MAPPING_TOP";
})(WALL || (WALL = {}));
;
class CoordinateError extends Error {
    constructor(x, y) {
        const message = `cellsの範囲外です  x:${x}, y:${y}`;
        super(message);
    }
}
export class Cell {
    constructor(excelData) {
        const arr = excelData.toString().split("");
        this.event = Number(arr[0]);
        this.param = Number(arr[1]);
        this.chipX = Number(arr[2]) * CELL_PX;
        this.chipY = Number(arr[3]) * CELL_PX;
        this.visible = false;
    }
    getEnemyNum() {
        const existsEnemy = (this.event == EVENT.ENEMY);
        return existsEnemy ? this.param : -1;
    }
    openBox() {
        this.event = EVENT.NONE;
        this.chipX = 0;
        this.chipY = 5 * CELL_PX;
        return this.param;
    }
}
export class Floor {
    constructor(mapExcelData, image, bgm, enemyDesigns) {
        this.mappingMax = 0;
        this.mappingCount = 0;
        this.mappingRate = 0;
        const cells = mapExcelData.map(line => line.map(num => new Cell(num)));
        this.cells = cells;
        this.image = image;
        this.bgm = bgm;
        this.enemies = [];
        for (let y = 0; y < cells.length; ++y) {
            for (let x = 0; x < cells[y].length; ++x) {
                const cell = cells[y][x];
                const enemyNum = cell.getEnemyNum();
                if (enemyNum != -1) {
                    const design = enemyDesigns[enemyNum];
                    if (!design)
                        throw Error("enemyNum が不適切です : " + enemyNum);
                    const enemy = design.generate(x, y);
                    this.enemies.push(enemy);
                }
                if (cell.event != EVENT.WALL)
                    this.mappingMax++;
            }
        }
    }
    moveEnemy(enemy, x, y) {
        var _a, _b;
        const from = (_a = this.cells[enemy.y]) === null || _a === void 0 ? void 0 : _a[enemy.x];
        const to = (_b = this.cells[y]) === null || _b === void 0 ? void 0 : _b[x];
        if (!from)
            throw new CoordinateError(enemy.x, enemy.y);
        if (!to)
            throw new CoordinateError(x, y);
        enemy.setXY(x, y);
        from.event = EVENT.NONE;
        to.event = EVENT.ENEMY;
        to.param = from.param;
    }
    deleteEnemy(x, y) {
        var _a;
        const enemies = this.enemies;
        const cell = (_a = this.cells[y]) === null || _a === void 0 ? void 0 : _a[x];
        if (!cell)
            throw new CoordinateError(x, y);
        cell.event = EVENT.NONE;
        for (let i = 0; i < enemies.length; ++i) {
            const enemy = enemies[i];
            if (enemy.x == x && enemy.y == y) {
                enemies.splice(i, 1);
                return enemy;
            }
        }
        throw new Error("指定座標に敵は存在しません");
    }
    updateMappingRate() {
        if (this.mappingRate === 100)
            return false;
        this.mappingRate = Math.floor(this.mappingCount / this.mappingMax * 100);
        const isCompleted = (this.mappingRate === 100);
        return isCompleted;
    }
}
export class DungeonModel {
    constructor(chara, items, enemyDesigns, floors, stairsList) {
        this.completeCount = 0;
        this.floorNum = 0;
        this.mappingPoints = [];
        this.chara = chara;
        this.items = items;
        this.enemyDesigns = enemyDesigns;
        this.floors = floors;
        this.stairsList = stairsList;
        const floor = this.floors[0];
        if (!floor)
            throw new Error("floorsの要素数が0です");
        this.floor = floor;
        this.cell = this.floor.cells[0][0];
    }
    setCharaCoordinate(floorNum, x, y) {
        const chara = this.chara;
        chara.setXY(x, y);
        chara.direction = DIRECTION.DOWN;
        const floor = this.floors[floorNum];
        if (!floor)
            throw new Error("floorNum が不適切です : " + floorNum);
        this.floorNum = floorNum;
        this.floor = floor;
        this.mappingCell(x, y);
        this.mappingAround(x, y);
        floor.updateMappingRate();
    }
    isGameCompleted() {
        return (this.completeCount == this.floors.length);
    }
    mappingAll(cellEvent) {
        const cells = this.floor.cells;
        for (let y = 0; y < cells.length; ++y) {
            for (let x = 0; x < cells[y].length; ++x) {
                if (cellEvent == undefined ||
                    cellEvent == cells[y][x].event)
                    this.mappingCell(x, y, true);
            }
        }
    }
    mappingCell(x, y, stop = false) {
        var _a;
        const floor = this.floor;
        const cell = (_a = floor.cells[y]) === null || _a === void 0 ? void 0 : _a[x];
        if (!cell)
            throw new CoordinateError(x, y);
        if (!cell.visible) {
            cell.visible = true;
            this.mappingPoints.push(new Point(x, y));
            if (cell.event != EVENT.WALL) {
                floor.mappingCount++;
                return;
            }
        }
        if (stop)
            return;
        if (cell.event == EVENT.WALL &&
            cell.param == WALL.MAPPING_TOP)
            this.mappingCell(x, y - 1, true);
    }
    mappingAround(x, y) {
        const top = y - 1;
        const bottom = y + 1;
        const left = x - 1;
        const right = x + 1;
        this.mappingCell(x, top);
        this.mappingCell(x, bottom);
        this.mappingCell(left, y);
        this.mappingCell(right, y);
        this.mappingCell(left, top);
        this.mappingCell(right, top);
        this.mappingCell(left, bottom);
        this.mappingCell(right, bottom);
    }
    walkChara(direction) {
        var _a;
        const chara = this.chara;
        let x = chara.x;
        let y = chara.y;
        chara.direction = direction;
        if (direction == DIRECTION.UP)
            y += -1;
        else if (direction == DIRECTION.DOWN)
            y += 1;
        else if (direction == DIRECTION.LEFT)
            x += -1;
        else if (direction == DIRECTION.RIGHT)
            x += 1;
        const cell = (_a = this.floor.cells[y]) === null || _a === void 0 ? void 0 : _a[x];
        if (!cell)
            throw new CoordinateError(x, y);
        const isWall = (cell.event == EVENT.WALL);
        this.mappingPoints = [];
        if (!isWall) {
            this.mappingAround(x, y);
            chara.setXY(x, y);
            chara.walkCount++;
            this.cell = cell;
        }
        return isWall;
    }
    walkEnemy(enemy) {
        const { chara, floor } = this;
        const { x, y } = enemy;
        if (x == chara.x && y == chara.y) {
            floor.moveEnemy(enemy, x, y);
            return;
        }
        const coords = [
            new Point(x, y - 1),
            new Point(x, y + 1),
            new Point(x - 1, y),
            new Point(x + 1, y),
        ].filter(({ x, y }) => { var _a, _b; return (((_b = (_a = floor.cells[y]) === null || _a === void 0 ? void 0 : _a[x]) === null || _b === void 0 ? void 0 : _b.event) == EVENT.NONE); });
        if (coords.length == 0) {
            floor.moveEnemy(enemy, x, y);
            return;
        }
        if (enemy.design.chase) {
            let minDistance = 1000;
            let minCoord = coords[0];
            for (const coord of coords) {
                const distance = Math.abs(coord.y - chara.y) +
                    Math.abs(coord.x - chara.x);
                if (minDistance > distance) {
                    minDistance = distance;
                    minCoord = coord;
                }
            }
            floor.moveEnemy(enemy, minCoord.x, minCoord.y);
        }
        else {
            const i = Math.floor(Math.random() * coords.length);
            const { x, y } = coords[i];
            floor.moveEnemy(enemy, x, y);
        }
    }
    boxEvent() {
        const itemNum = this.cell.openBox();
        const item = this.items[itemNum];
        if (!item)
            throw new Error("セルのアイテム番号が不適切です : " + itemNum);
        item.quantity++;
        return item;
    }
    stairsEvent() {
        const index = this.cell.param;
        const stairs = this.stairsList[index];
        if (!stairs)
            throw new Error("セルの階段番号が不適切です : " + index);
        const [floorNum, x, y] = stairs;
        this.setCharaCoordinate(floorNum, x, y);
    }
    enemyEvent() {
        const chara = this.chara;
        const enemy = this.floor.deleteEnemy(chara.x, chara.y);
        const safeItem = enemy.design.safeItem;
        if (safeItem.quantity > 0) {
            safeItem.quantity--;
            chara.safeCount++;
            enemy.result = ENEMY_RESULT.DODGED;
        }
        else {
            chara.hp--;
            enemy.result = (chara.hp == 0)
                ? ENEMY_RESULT.GAMEOVER
                : ENEMY_RESULT.CRASHED;
        }
        return enemy;
    }
}
export class DungeonView {
    constructor(model, input, contexts, se) {
        this.model = model;
        this.input = input;
        this.contexts = contexts;
        this.se = se;
        this.rects = {
            status: new Rect(10, 5, 300, 35),
            items: new Rect(200, 350, 108, 120),
            message: new Rect(10, 295, 300, 50),
            up: new Rect(70, 290, 60, 60, 20, 20, "▲"),
            down: new Rect(70, 410, 60, 60, 20, 20, "▼"),
            left: new Rect(10, 350, 60, 60, 20, 20, "◀"),
            right: new Rect(130, 350, 60, 60, 20, 20, "▶"),
        };
    }
    drawAll() {
        this.contexts.ui.clearRect(0, 0, CANVAS.W + 1, CANVAS.H + 1);
        this.drawDark();
        this.drawStatus();
        this.drawButton();
        this.drawFloor();
        this.drawMap();
    }
    drawFloor(shiftPx = 0) {
        const { chara, floor } = this.model;
        const { bg: contextBg, preRender: contextPre } = this.contexts;
        const bgX = chara.pxX - (chara.moveX * shiftPx);
        const bgY = chara.pxY - (chara.moveY * shiftPx);
        const bgImage = contextPre.getImageData(bgX, bgY, CANVAS.W, CANVAS.H);
        contextBg.putImageData(bgImage, 0, 0);
        for (const enemy of floor.enemies) {
            const enemyX = enemy.pxX - (enemy.moveX * shiftPx);
            const enemyY = enemy.pxY - (enemy.moveY * shiftPx);
            enemy.draw(contextBg, CANVAS.CHARA_X + enemyX - bgX, CANVAS.CHARA_Y + enemyY - bgY);
        }
        chara.draw(contextBg);
    }
    drawMap() {
        const CELL_PX = 3;
        const LENGTH = 35;
        const WIDTH = LENGTH * CELL_PX;
        const LEFT = 10;
        const TOP = 50;
        const chara = this.model.chara;
        const cells = this.model.floor.cells;
        const context = this.contexts.ui;
        context.clearRect(LEFT, TOP, WIDTH, WIDTH);
        for (let y = 0; y < cells.length; ++y) {
            for (let x = 0; x < cells[y].length; ++x) {
                const { event, visible } = cells[y][x];
                const color = (event === EVENT.ENEMY) ? "red" :
                    (visible === false) ? null :
                        (event === EVENT.WALL) ? "dimgray" :
                            (event === EVENT.NONE) ? "white" :
                                (event === EVENT.STAIRS) ? "lightgreen" :
                                    (event === EVENT.BOX) ? "yellow" :
                                        null;
                if (color === null)
                    continue;
                context.fillStyle = color;
                context.fillRect(LEFT + (CELL_PX * x), TOP + (CELL_PX * y), CELL_PX, CELL_PX);
            }
        }
        context.fillStyle = "deepskyblue";
        context.fillRect(LEFT + (CELL_PX * chara.x), TOP + (CELL_PX * chara.y), CELL_PX, CELL_PX);
    }
    drawButton() {
        const rects = this.rects;
        rects.up.draw();
        rects.down.draw();
        rects.left.draw();
        rects.right.draw();
    }
    drawStatus() {
        const rects = this.rects;
        const { floorNum, floor, chara, items } = this.model;
        const { hpMax, hp, walkCount } = chara;
        const hpText = "●".repeat(hp) + "○".repeat(hpMax - hp);
        const status = `地下${floorNum}階  ${floor.mappingRate}％  ${walkCount}歩  HP${hpText}`;
        let equipment = "そうび\n";
        for (const { quantity, name } of items) {
            if (quantity > 0)
                equipment += `${quantity} ${name}\n`;
        }
        rects.status.draw(status);
        rects.items.draw(equipment);
    }
    drawDark() {
        const ALPHA = 0.7;
        const BLUR = 8;
        const context = this.contexts.dark;
        context.clearRect(0, 0, CANVAS.W + 1, CANVAS.H + 1);
        const isCompleted = (this.model.floor.mappingRate == 100);
        if (isCompleted)
            return;
        context.save();
        context.globalAlpha = ALPHA;
        context.fillStyle = "black";
        context.fillRect(0, 0, CANVAS.W, CANVAS.H);
        context.globalAlpha = 1;
        context.globalCompositeOperation = "destination-out";
        context.filter = `blur(${BLUR}px)`;
        const centerX = CANVAS.CHARA_X + (CELL_PX / 2);
        const centerY = CANVAS.CHARA_Y + (CELL_PX / 2);
        const radius = CELL_PX * 1.5;
        context.beginPath();
        context.arc(centerX, centerY, radius, 0, Math.PI * 2);
        context.fill();
        context.restore();
    }
    drawStairsScreen() {
        this.se.stairs.play();
        const context = this.contexts.ui;
        context.fillStyle = "black";
        context.fillRect(0, 0, CANVAS.W, CANVAS.H);
        const text = "地下" + this.model.floorNum + "階";
        context.fillStyle = "white";
        context.font = "30px 'ＭＳ ゴシック'";
        context.textAlign = "left";
        context.textBaseline = "top";
        context.fillText(text, CANVAS.W / 3, CANVAS.H / 2);
    }
    animateWalking(direction, nextFunction) {
        const self = this;
        const { chara, floor, mappingPoints } = this.model;
        const ctxPre = this.contexts.preRender;
        chara.nextPattern();
        for (const enemy of floor.enemies)
            enemy.nextPattern();
        const FRAME_LENGTH = 6;
        const INTERVAL = 28;
        const FRAME_PX = CELL_PX / FRAME_LENGTH;
        let i = FRAME_LENGTH;
        const x = CANVAS.CHARA_X + chara.pxX - CELL_PX;
        const y = CANVAS.CHARA_Y + chara.pxY - CELL_PX;
        const w = CELL_PX * 3;
        const h = CELL_PX * 3;
        const isHorizontalMove = (chara.moveX != 0);
        drawFrame();
        const bgAnimID = setInterval(drawFrame, INTERVAL);
        function drawFrame() {
            i--;
            if (i == -1) {
                clearInterval(bgAnimID);
                nextFunction();
                return;
            }
            const shiftPx = FRAME_PX * i;
            if (i != 0) {
                ctxPre.save();
                const path = new Path2D();
                path.rect((isHorizontalMove) ? x + shiftPx : x, (!isHorizontalMove) ? y + shiftPx : y, (isHorizontalMove) ? w - shiftPx * 2 : w, (!isHorizontalMove) ? h - shiftPx * 2 : h);
                ctxPre.clip(path);
            }
            for (const { x, y } of mappingPoints)
                self.preRenderCell(x, y);
            ctxPre.restore();
            self.drawFloor(shiftPx);
        }
    }
    preRenderAll() {
        const context = this.contexts.preRender;
        const cells = this.model.floor.cells;
        context.fillStyle = INVISIBLE_CELL_COLOR;
        context.fillRect(0, 0, BG_CANVAS.W + 1, BG_CANVAS.H + 1);
        for (let y = 0; y < cells.length; ++y) {
            for (let x = 0; x < cells[y].length; ++x) {
                this.preRenderCell(x, y);
            }
        }
    }
    preRenderCell(x, y) {
        var _a;
        const context = this.contexts.preRender;
        const { cells, image } = this.model.floor;
        const left = CANVAS.CHARA_X + (x * CELL_PX);
        const top = CANVAS.CHARA_Y + (y * CELL_PX);
        const cell = (_a = cells[y]) === null || _a === void 0 ? void 0 : _a[x];
        if (!cell)
            throw new CoordinateError(x, y);
        const { visible, chipX, chipY } = cell;
        if (visible) {
            context.drawImage(image, chipX, chipY, CELL_PX, CELL_PX, left, top, CELL_PX, CELL_PX);
        }
    }
    enqueueMessage(text, audio = null, delay = 400, bgmStop = false) {
        this.input.enqueue(() => {
            this.rects.message.draw(text, true);
            if (bgmStop)
                Bgm.stop();
            if (audio)
                audio.play();
        }, delay);
    }
    floorCompleteEvent() {
        return new Promise(resolve => {
            const { input, se, model } = this;
            this.drawDark();
            this.enqueueMessage("地下" + model.floorNum + "階の地図が完成した！", se.complete1, 1500);
            input.enqueue(resolve);
            input.runQueue();
        });
    }
    gameCompleteEvent() {
        return new Promise(resolve => {
            const { input, se, rects } = this;
            input.enqueue(() => {
                Bgm.stop();
                se.complete2.play();
                rects.message.draw("すべての階の地図が完成した！", true);
            }, 3000);
            input.enqueue(resolve);
            input.runQueue();
        });
    }
    boxEvent(item) {
        return new Promise(resolve => {
            const { se, input, model } = this;
            this.enqueueMessage("宝箱を開けた！", se.openBox);
            this.enqueueMessage(item.name + "を手に入れた！");
            this.enqueueMessage("ちゃんと装備した！");
            input.enqueue(() => {
                const { x, y } = model.chara;
                this.preRenderCell(x, y);
                resolve();
            });
            input.runQueue();
        });
    }
    enemyEvent(enemy) {
        return new Promise(resolve => {
            const result = enemy.result;
            const { encountText, safeText, damageText } = enemy.design;
            const { input, se } = this;
            this.enqueueMessage(encountText, se.encount);
            if (result == ENEMY_RESULT.DODGED)
                this.enqueueMessage(safeText, se.useItem);
            else {
                input.enqueue(() => {
                    se.crash.play();
                    const context = this.contexts.dark;
                    context.fillStyle = "white";
                    context.fillRect(0, 0, CANVAS.W, CANVAS.H);
                    setTimeout(() => {
                        this.drawDark();
                        this.drawStatus();
                        this.rects.message.draw(damageText, true);
                    }, 120);
                }, 850);
            }
            if (result == ENEMY_RESULT.GAMEOVER) {
                this.enqueueMessage("体力が尽きてしまった！", se.gameover, 3000, true);
                this.enqueueMessage("-  ゲームオーバー  -", null, 1000);
            }
            input.enqueue(resolve);
            input.runQueue();
        });
    }
}
export class DungeonScreen {
    constructor(model, view, input) {
        this.model = model;
        this.view = view;
        this.input = input;
        this.nextFunction = () => { };
        this.triangles = {
            up: new Triangle(new Point(100, 380), new Point(10, 290), new Point(190, 290)),
            down: new Triangle(new Point(100, 380), new Point(10, 470), new Point(190, 470)),
            left: new Triangle(new Point(100, 380), new Point(10, 290), new Point(10, 470)),
            right: new Triangle(new Point(100, 380), new Point(190, 290), new Point(190, 470)),
        };
    }
    show() {
        const { model, view } = this;
        view.drawStairsScreen();
        setTimeout(() => {
            model.floor.bgm.play();
            view.preRenderAll();
            this.drawAndInputStandby();
        }, 1500);
    }
    inputStandby() {
        this.input.standby(() => this.onInput());
    }
    drawAndInputStandby() {
        this.view.drawAll();
        this.inputStandby();
    }
    onInput() {
        return __awaiter(this, void 0, void 0, function* () {
            const { model, view } = this;
            const floor = model.floor;
            const direction = this.getInputDirection();
            if (direction == null) {
                this.inputStandby();
                return;
            }
            const isWall = model.walkChara(direction);
            if (isWall) {
                view.se.wall.play();
                view.drawFloor();
                this.inputStandby();
                return;
            }
            for (let enemy of floor.enemies)
                model.walkEnemy(enemy);
            yield new Promise(resolve => view.animateWalking(direction, resolve));
            const isFloorCompleted = floor.updateMappingRate();
            view.drawStatus();
            view.drawMap();
            if (isFloorCompleted) {
                model.completeCount++;
                model.mappingAll();
                view.preRenderAll();
                view.drawFloor();
                yield view.floorCompleteEvent();
                view.drawAll();
                if (model.isGameCompleted()) {
                    yield view.gameCompleteEvent();
                    this.nextFunction();
                    return;
                }
            }
            switch (model.cell.event) {
                case EVENT.NONE:
                    this.onInput();
                    return;
                case EVENT.BOX:
                    const item = model.boxEvent();
                    yield view.boxEvent(item);
                    this.drawAndInputStandby();
                    return;
                case EVENT.STAIRS:
                    model.stairsEvent();
                    setTimeout(() => this.show(), 200);
                    return;
                case EVENT.ENEMY:
                    const enemy = model.enemyEvent();
                    yield view.enemyEvent(enemy);
                    if (enemy.result == ENEMY_RESULT.GAMEOVER)
                        location.reload();
                    else
                        this.drawAndInputStandby();
                    return;
            }
        });
    }
    getInputDirection() {
        const { x, y, key } = this.input;
        if (!key)
            return null;
        const trais = this.triangles;
        return ((key == "ArrowUp") ? DIRECTION.UP :
            (key == "ArrowDown") ? DIRECTION.DOWN :
                (key == "ArrowLeft") ? DIRECTION.LEFT :
                    (key == "ArrowRight") ? DIRECTION.RIGHT :
                        (trais.up.contains(x, y)) ? DIRECTION.UP :
                            (trais.down.contains(x, y)) ? DIRECTION.DOWN :
                                (trais.left.contains(x, y)) ? DIRECTION.LEFT :
                                    (trais.right.contains(x, y)) ? DIRECTION.RIGHT :
                                        null);
    }
}
//# sourceMappingURL=dungeon.js.map