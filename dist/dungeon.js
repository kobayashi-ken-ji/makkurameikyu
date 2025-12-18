var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { CELL_PX, CANVAS, BG_CANVAS, Direction } from './constants.js';
import { Rect, Bgm, Point, Triangle, Input, OnInputQueue } from './utility.js';
import { Item, MainChara, EnemyDesign, Enemy, EnemyResult } from './character.js';
var Event;
(function (Event) {
    Event[Event["NONE"] = 1] = "NONE";
    Event[Event["WALL"] = 2] = "WALL";
    Event[Event["STAIRS"] = 3] = "STAIRS";
    Event[Event["TREASURE"] = 4] = "TREASURE";
    Event[Event["ENEMY"] = 9] = "ENEMY";
})(Event || (Event = {}));
var Wall;
(function (Wall) {
    Wall[Wall["NORMAL"] = 0] = "NORMAL";
    Wall[Wall["MAPPING_TOP"] = 1] = "MAPPING_TOP";
})(Wall || (Wall = {}));
;
class IndexError extends Error {
    constructor(index) {
        super(`配列の要素を取得できませんでした。 index:${index}`);
    }
}
class IndexError2D extends Error {
    constructor(x, y) {
        super(`二次元配列の要素を取得できませんでした。 x:${x}, y:${y}`);
    }
}
export class Cell {
    constructor(excelData) {
        const arr = excelData.toString().split("");
        if (arr.length != 4)
            throw new Error(`引数${excelData}は4桁ではありません。`);
        this.event = Number(arr[0]);
        this.param = Number(arr[1]);
        this.chipX = Number(arr[2]) * CELL_PX;
        this.chipY = Number(arr[3]) * CELL_PX;
        this.mapped = false;
    }
}
Cell.ROAD_CHIP = { X: 0, Y: 5 * CELL_PX };
export class Floor {
    get mappingRate() { return this._mappingRate; }
    get mappingPoints() { return this._mappingPoints; }
    get enemies() { return this._enemies; }
    get cells() { return this._cells; }
    constructor(mapExcelData, enemyDesigns) {
        var _a;
        this._enemies = [];
        this.mappingMax = 0;
        this.mappingCount = 0;
        this._mappingRate = 0;
        this._mappingPoints = [];
        const cells = this._cells =
            mapExcelData.map(line => line.map(num => new Cell(num)));
        for (let y = 0; y < cells.length; ++y) {
            for (let x = 0; x < cells[y].length; ++x) {
                const cell = (_a = cells[y]) === null || _a === void 0 ? void 0 : _a[x];
                if (!cell)
                    throw new IndexError2D(x, y);
                if (cell.event == Event.ENEMY) {
                    const design = enemyDesigns[cell.param];
                    if (!design)
                        throw new IndexError(cell.param);
                    const enemy = design.generate(x, y);
                    this._enemies.push(enemy);
                }
                if (cell.event != Event.WALL) {
                    this.mappingMax++;
                    if (cell.mapped)
                        this.mappingCount++;
                }
            }
        }
    }
    getCell(x, y, event) {
        return this._getCell(x, y, event);
    }
    _getCell(x, y, event) {
        var _a;
        const cell = (_a = this._cells[y]) === null || _a === void 0 ? void 0 : _a[x];
        if (!cell)
            throw new IndexError2D(x, y);
        if (event != undefined && event != cell.event)
            throw new Error(`想定されているeventと異なります。 event:${cell.event}`);
        return cell;
    }
    openTreasure(x, y) {
        const cell = this._getCell(x, y, Event.TREASURE);
        cell.event = Event.NONE;
        cell.chipX = Cell.ROAD_CHIP.X;
        cell.chipY = Cell.ROAD_CHIP.Y;
        return cell.param;
    }
    getStairsParam(x, y) {
        const cell = this._getCell(x, y, Event.STAIRS);
        return cell.param;
    }
    moveEnemy(floorEnemyIndex, x, y) {
        const enemy = this._enemies[floorEnemyIndex];
        if (!enemy)
            throw new IndexError(floorEnemyIndex);
        const isMoving = !(enemy.x == x && enemy.y == y);
        if (isMoving) {
            const from = this._getCell(enemy.x, enemy.y, Event.ENEMY);
            const to = this._getCell(x, y, Event.NONE);
            from.event = Event.NONE;
            to.event = Event.ENEMY;
            to.param = from.param;
        }
        enemy.setXy(x, y);
    }
    deleteEnemy(x, y) {
        const enemies = this._enemies;
        const cell = this._getCell(x, y, Event.ENEMY);
        cell.event = Event.NONE;
        for (let i = 0; i < enemies.length; ++i) {
            const enemy = enemies[i];
            if (!enemy)
                throw new IndexError(i);
            if (enemy.x == x && enemy.y == y) {
                enemies.splice(i, 1);
                return enemy;
            }
        }
        throw new Error(`指定座標に敵は存在しません  x:${x}, y:${y}`);
    }
    updateMappingRate() {
        if (this._mappingRate === 100)
            return false;
        this._mappingRate = Math.floor(this.mappingCount / this.mappingMax * 100);
        const isCompleted = (this._mappingRate === 100);
        if (isCompleted)
            this.mappingAll();
        return isCompleted;
    }
    mappingAll() {
        const cells = this._cells;
        for (let y = 0; y < cells.length; ++y) {
            for (let x = 0; x < cells[y].length; ++x) {
                this.mappingCell(x, y, true);
            }
        }
    }
    mappingCell(x, y, stop = false) {
        var _a;
        const cell = (_a = this._cells[y]) === null || _a === void 0 ? void 0 : _a[x];
        if (!cell)
            return;
        if (!cell.mapped) {
            cell.mapped = true;
            this._mappingPoints.push(new Point(x, y));
            if (cell.event != Event.WALL) {
                this.mappingCount++;
                return;
            }
        }
        if (stop)
            return;
        if (cell.event == Event.WALL &&
            cell.param == Wall.MAPPING_TOP)
            this.mappingCell(x, y - 1, true);
    }
    mappingAround(x, y) {
        const up = y - 1;
        const down = y + 1;
        const left = x - 1;
        const right = x + 1;
        this._mappingPoints = [];
        this.mappingCell(x, up);
        this.mappingCell(x, down);
        this.mappingCell(left, y);
        this.mappingCell(right, y);
        this.mappingCell(left, up);
        this.mappingCell(right, up);
        this.mappingCell(left, down);
        this.mappingCell(right, down);
    }
    debugMappingAll(x, y) {
        if (this._mappingRate == 100)
            return;
        this.mappingAll();
        const cell = this._getCell(x, y);
        cell.mapped = false;
        this.mappingCount--;
        this.updateMappingRate();
    }
}
export class CharaStatus {
    constructor() {
        this.hpMax = 3;
        this.hp = this.hpMax;
        this.walkCount = 0;
        this.safeCount = 0;
    }
}
export class DungeonModel {
    constructor(_chara, _items, floors, stairsDestinations, initialCoordinate) {
        this._chara = _chara;
        this._items = _items;
        this.floors = floors;
        this.stairsDestinations = stairsDestinations;
        this.completeCount = 0;
        this._charaStatus = new CharaStatus();
        this.changeFloor(...initialCoordinate);
    }
    get floor() { return this._floor; }
    get chara() { return this._chara; }
    get items() { return this._items; }
    get charaStatus() { return this._charaStatus; }
    get floorIndex() { return this._floorIndex; }
    changeFloor(floorIndex, x, y) {
        const floor = this.floors[floorIndex];
        if (!floor)
            throw new IndexError(floorIndex);
        this._floorIndex = floorIndex;
        this._floor = floor;
        const cell = floor.getCell(x, y);
        if (cell.event == Event.WALL)
            throw new Error("指定座標が壁のため、キャラを配置できません。");
        const chara = this._chara;
        chara.setXy(x, y);
        chara.direction = Direction.DOWN;
        floor.mappingAround(x, y);
        floor.mappingCell(x, y);
        floor.updateMappingRate();
    }
    walkAll(direction) {
        const _floor = this._floor;
        const result = {
            isWall: false,
            event: Event.NONE,
            isFloorCompleted: false,
            isGameCompleted: false,
        };
        const cell = this.walkChara(direction);
        result.isWall = (cell.event == Event.WALL);
        if (result.isWall)
            return result;
        _floor.enemies.forEach((enemy, index) => {
            const { x, y } = this.getEnemyDestination(enemy);
            _floor.moveEnemy(index, x, y);
        });
        result.isFloorCompleted = _floor.updateMappingRate();
        if (result.isFloorCompleted) {
            this.completeCount++;
            result.isGameCompleted = (this.completeCount == this.floors.length);
        }
        result.event = cell.event;
        return result;
    }
    walkChara(direction) {
        const { _chara, _floor, _charaStatus } = this;
        _chara.direction = direction;
        let x = _chara.x;
        let y = _chara.y;
        if (direction == Direction.UP)
            y += -1;
        else if (direction == Direction.DOWN)
            y += 1;
        else if (direction == Direction.LEFT)
            x += -1;
        else if (direction == Direction.RIGHT)
            x += 1;
        const cell = _floor.getCell(x, y);
        const isWall = (cell.event == Event.WALL);
        if (!isWall) {
            _chara.setXy(x, y);
            _charaStatus.walkCount++;
            _floor.mappingAround(x, y);
        }
        return cell;
    }
    getEnemyDestination(enemy) {
        const { _chara, _floor } = this;
        const { x, y } = enemy;
        if (x == _chara.x && y == _chara.y)
            return new Point(x, y);
        const points = [
            new Point(x, y - 1),
            new Point(x, y + 1),
            new Point(x - 1, y),
            new Point(x + 1, y),
        ].filter(({ x, y }) => { var _a, _b; return (((_b = (_a = _floor.cells[y]) === null || _a === void 0 ? void 0 : _a[x]) === null || _b === void 0 ? void 0 : _b.event) == Event.NONE); });
        if (points.length == 0)
            return new Point(x, y);
        if (enemy.design.isChaser) {
            let minDistance = 1000;
            let minPoint = points[0];
            for (const point of points) {
                const distance = Math.abs(point.y - _chara.y) +
                    Math.abs(point.x - _chara.x);
                if (minDistance > distance) {
                    minDistance = distance;
                    minPoint = point;
                }
            }
            return minPoint;
        }
        else {
            const i = Math.floor(Math.random() * points.length);
            const point = points[i];
            if (!point)
                throw new IndexError(i);
            return points[i];
        }
    }
    treasureEvent() {
        const { chara, _floor, _items } = this;
        const index = _floor.openTreasure(chara.x, chara.y);
        const item = _items[index];
        if (!item)
            throw new IndexError(index);
        item.quantity++;
        return item;
    }
    stairsEvent() {
        const { chara, _floor, stairsDestinations } = this;
        const index = _floor.getStairsParam(chara.x, chara.y);
        const stairs = stairsDestinations[index];
        if (!stairs)
            throw new IndexError(index);
        const [floorIndex, x, y] = stairs;
        this.changeFloor(floorIndex, x, y);
        return floorIndex;
    }
    enemyEvent() {
        const { chara, _charaStatus, _floor, _items } = this;
        const enemy = _floor.deleteEnemy(chara.x, chara.y);
        const index = enemy.design.dodgingItem;
        const item = _items[index];
        if (!item)
            throw new IndexError(index);
        if (item.quantity > 0) {
            item.quantity--;
            _charaStatus.safeCount++;
            enemy.result = EnemyResult.DODGED;
        }
        else {
            _charaStatus.hp--;
            enemy.result = (_charaStatus.hp == 0)
                ? EnemyResult.GAMEOVER
                : EnemyResult.CRASHED;
        }
        return enemy;
    }
}
export class FloorMedia {
    constructor(name, image, bgm) {
        this.name = name;
        this.image = image;
        this.bgm = bgm;
    }
}
export class DungeonView {
    constructor(model, floorMedias, input, contexts, se) {
        this.model = model;
        this.floorMedias = floorMedias;
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
        this.changeFloor(model.floorIndex);
    }
    changeFloor(floorIndex) {
        const media = this.floorMedias[floorIndex];
        if (!media)
            throw new IndexError(floorIndex);
        this.floorMedia = media;
    }
    drawAll() {
        this.contexts.ui.clearRect(0, 0, CANVAS.W + 1, CANVAS.H + 1);
        this.drawDark();
        this.drawStatus();
        this.drawButton();
        this.drawFloor();
        this.drawMap();
    }
    drawFloor(offset = 0) {
        const { chara, floor } = this.model;
        const { bg: contextBg, preRender: contextPre } = this.contexts;
        const bg = chara.getXyOnBg(offset);
        const bgImage = contextPre.getImageData(bg.x, bg.y, CANVAS.W, CANVAS.H);
        contextBg.putImageData(bgImage, 0, 0);
        for (const enemy of floor.enemies) {
            const enemyOnBg = enemy.getXyOnBg(offset);
            const onScreenX = BG_CANVAS.LEFT_MARGIN + enemyOnBg.x - bg.x;
            const onScreenY = BG_CANVAS.TOP_MARGIN + enemyOnBg.y - bg.y;
            enemy.draw(contextBg, onScreenX, onScreenY);
        }
        chara.draw(contextBg);
    }
    drawMap() {
        var _a;
        const CELL_PX = 3;
        const LENGTH = 35;
        const WIDTH = LENGTH * CELL_PX;
        const LEFT = 10;
        const TOP = 50;
        const { chara, floor } = this.model;
        const cells = floor.cells;
        const context = this.contexts.ui;
        context.clearRect(LEFT, TOP, WIDTH, WIDTH);
        for (let y = 0; y < cells.length; ++y) {
            for (let x = 0; x < cells[y].length; ++x) {
                const cell = (_a = cells[y]) === null || _a === void 0 ? void 0 : _a[x];
                if (!cell)
                    throw new IndexError2D(x, y);
                const { event, mapped } = cell;
                const color = (event === Event.ENEMY) ? "red" :
                    (mapped === false) ? null :
                        (event === Event.WALL) ? "dimgray" :
                            (event === Event.NONE) ? "white" :
                                (event === Event.STAIRS) ? "lightgreen" :
                                    (event === Event.TREASURE) ? "yellow" :
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
        const { items, charaStatus, floor } = this.model;
        const { hpMax, hp, walkCount } = charaStatus;
        const { mappingRate } = floor;
        const floorName = this.floorMedia.name;
        const hpText = "●".repeat(hp) + "○".repeat(hpMax - hp);
        const status = `${floorName}  ${mappingRate}％  ${walkCount}歩  HP${hpText}`;
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
    floorChangeScreen() {
        this.se.stairs.play();
        const context = this.contexts.ui;
        context.fillStyle = "black";
        context.fillRect(0, 0, CANVAS.W, CANVAS.H);
        const text = this.floorMedia.name;
        context.fillStyle = "white";
        context.font = "30px 'ＭＳ ゴシック'";
        context.textAlign = "left";
        context.textBaseline = "top";
        context.fillText(text, CANVAS.W / 3, CANVAS.H / 2);
    }
    drawDungeonScreen() {
        this.floorMedia.bgm.play();
        this.preRenderAll();
    }
    walkingAnimation(nextFunction) {
        const self = this;
        const { chara, floor } = this.model;
        const { mappingPoints, enemies } = floor;
        const ctxPre = this.contexts.preRender;
        chara.nextPattern();
        for (const enemy of enemies)
            enemy.nextPattern();
        const FRAME_LENGTH = 7;
        const INTERVAL = 28;
        const FRAME_PX = CELL_PX / FRAME_LENGTH;
        let i = FRAME_LENGTH;
        const charaOnBg = chara.getXyOnBg();
        const x = BG_CANVAS.LEFT_MARGIN + charaOnBg.x - CELL_PX;
        const y = BG_CANVAS.TOP_MARGIN + charaOnBg.y - CELL_PX;
        const w = CELL_PX * 3;
        const h = CELL_PX * 3;
        const direction = chara.direction;
        const isHorizontalMove = (direction == Direction.LEFT || direction == Direction.RIGHT);
        drawFrame();
        const bgAnimID = setInterval(drawFrame, INTERVAL);
        function drawFrame() {
            i--;
            if (i == -1) {
                clearInterval(bgAnimID);
                nextFunction();
                return;
            }
            const offset = FRAME_PX * i;
            if (i != 0) {
                ctxPre.save();
                const path = new Path2D();
                path.rect((isHorizontalMove) ? x + offset : x, (!isHorizontalMove) ? y + offset : y, (isHorizontalMove) ? w - offset * 2 : w, (!isHorizontalMove) ? h - offset * 2 : h);
                ctxPre.clip(path);
            }
            for (const { x, y } of mappingPoints)
                self.preRenderCell(x, y);
            ctxPre.restore();
            self.drawFloor(offset);
        }
    }
    preRenderAll() {
        const context = this.contexts.preRender;
        const cells = this.model.floor.cells;
        context.fillStyle = "black";
        context.fillRect(0, 0, BG_CANVAS.W + 1, BG_CANVAS.H + 1);
        for (let y = 0; y < cells.length; ++y) {
            for (let x = 0; x < cells[y].length; ++x) {
                this.preRenderCell(x, y);
            }
        }
    }
    preRenderCell(x, y) {
        const { floorMedia, contexts, model } = this;
        const cell = model.floor.getCell(x, y);
        const { mapped, chipX, chipY } = cell;
        if (!mapped)
            return;
        const left = BG_CANVAS.LEFT_MARGIN + (x * CELL_PX);
        const top = BG_CANVAS.TOP_MARGIN + (y * CELL_PX);
        contexts.preRender.drawImage(floorMedia.image, chipX, chipY, CELL_PX, CELL_PX, left, top, CELL_PX, CELL_PX);
    }
    pushMessage(onInputQueue, text, audio = null, delay = 400, bgmStop = false) {
        onInputQueue.push(() => {
            this.rects.message.draw(text, true);
            if (bgmStop)
                Bgm.stop();
            if (audio)
                audio.play();
        }, delay);
    }
    wallEvent() {
        this.se.wall.play();
        this.drawFloor();
    }
    floorCompleteEvent() {
        return new Promise(resolve => {
            const { input, se, floorMedia } = this;
            const queue = new OnInputQueue(input);
            this.drawDark();
            const message = `${floorMedia.name}の地図が完成した！`;
            this.pushMessage(queue, message, se.complete1, 1500);
            queue.push(resolve);
            queue.run();
        });
    }
    gameCompleteEvent() {
        return new Promise(resolve => {
            const { input, se } = this;
            const queue = new OnInputQueue(input);
            const message = "すべての階の地図が完成した！";
            this.pushMessage(queue, message, se.complete2, 3000, true);
            queue.push(resolve);
            queue.run();
        });
    }
    treasureEvent(item) {
        return new Promise(resolve => {
            const { se, input, model } = this;
            const queue = new OnInputQueue(input);
            this.pushMessage(queue, "宝箱を開けた！", se.openBox);
            this.pushMessage(queue, item.name + "を手に入れた！");
            this.pushMessage(queue, "ちゃんと装備した！");
            queue.push(() => {
                const { x, y } = model.chara;
                this.preRenderCell(x, y);
                resolve();
            });
            queue.run();
        });
    }
    enemyEvent(enemy) {
        return new Promise(resolve => {
            const result = enemy.result;
            const { encountText, dodgedText, damageText } = enemy.design;
            const { input, se } = this;
            const queue = new OnInputQueue(input);
            this.pushMessage(queue, encountText, se.encount);
            if (result == EnemyResult.DODGED)
                this.pushMessage(queue, dodgedText, se.useItem);
            else {
                queue.push(() => {
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
            if (result == EnemyResult.GAMEOVER) {
                this.pushMessage(queue, "体力が尽きてしまった！", se.gameover, 3000, true);
                this.pushMessage(queue, "-  ゲームオーバー  -", null, 1000);
            }
            queue.push(resolve);
            queue.run();
        });
    }
}
export class DungeonController {
    constructor(model, view, input) {
        this.model = model;
        this.view = view;
        this.input = input;
        this.triangles = {
            up: new Triangle(new Point(100, 380), new Point(10, 290), new Point(190, 290)),
            down: new Triangle(new Point(100, 380), new Point(10, 470), new Point(190, 470)),
            left: new Triangle(new Point(100, 380), new Point(10, 290), new Point(10, 470)),
            right: new Triangle(new Point(100, 380), new Point(190, 290), new Point(190, 470)),
        };
        view.changeFloor(model.floorIndex);
    }
    show() {
        const view = this.view;
        view.floorChangeScreen();
        setTimeout(() => {
            view.drawDungeonScreen();
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
            const direction = this.getInputDirection();
            if (direction == null) {
                this.inputStandby();
                return;
            }
            const result = model.walkAll(direction);
            const { isWall, event, isFloorCompleted, isGameCompleted } = result;
            if (isWall) {
                view.wallEvent();
                this.inputStandby();
                return;
            }
            yield new Promise(resolve => view.walkingAnimation(resolve));
            view.drawStatus();
            view.drawMap();
            if (isFloorCompleted) {
                view.preRenderAll();
                view.drawFloor();
                view.drawMap();
                yield view.floorCompleteEvent();
                view.drawAll();
                if (isGameCompleted) {
                    yield view.gameCompleteEvent();
                    if (!this.nextFunction)
                        throw new Error("遷移先の画面が未設定です。");
                    this.nextFunction(model.charaStatus);
                    return;
                }
            }
            switch (event) {
                case Event.NONE:
                    this.onInput();
                    return;
                case Event.TREASURE:
                    const item = model.treasureEvent();
                    yield view.treasureEvent(item);
                    this.drawAndInputStandby();
                    return;
                case Event.STAIRS:
                    const floorIndex = model.stairsEvent();
                    view.changeFloor(floorIndex);
                    setTimeout(() => this.show(), 200);
                    return;
                case Event.ENEMY:
                    const enemy = model.enemyEvent();
                    yield view.enemyEvent(enemy);
                    if (enemy.result == EnemyResult.GAMEOVER)
                        location.reload();
                    else
                        this.drawAndInputStandby();
                    return;
            }
        });
    }
    getInputDirection() {
        const { x, y, key } = this.input.getInputValue();
        if (!key)
            return null;
        const trais = this.triangles;
        return ((key == "ArrowUp") ? Direction.UP :
            (key == "ArrowDown") ? Direction.DOWN :
                (key == "ArrowLeft") ? Direction.LEFT :
                    (key == "ArrowRight") ? Direction.RIGHT :
                        (trais.up.contains(x, y)) ? Direction.UP :
                            (trais.down.contains(x, y)) ? Direction.DOWN :
                                (trais.left.contains(x, y)) ? Direction.LEFT :
                                    (trais.right.contains(x, y)) ? Direction.RIGHT :
                                        null);
    }
}
//# sourceMappingURL=dungeon.js.map