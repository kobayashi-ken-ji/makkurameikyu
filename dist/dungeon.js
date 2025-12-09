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
export class Cell {
    constructor(excelData) {
        const arr = excelData.toString().split("");
        this.event = Number(arr[0]);
        this.param = Number(arr[1]);
        this.chipX = Number(arr[2]) * CELL_PX;
        this.chipY = Number(arr[3]) * CELL_PX;
        this.mapped = false;
    }
    deleteEvent() {
        this.event = Event.NONE;
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
        this.mappingPoints = [];
        const cells = mapExcelData.map(line => line.map(num => new Cell(num)));
        this.image = image;
        this.bgm = bgm;
        this.cells = cells;
        this.enemies = [];
        for (let y = 0; y < cells.length; ++y) {
            for (let x = 0; x < cells[y].length; ++x) {
                const cell = cells[y][x];
                if (cell.event == Event.ENEMY) {
                    const design = enemyDesigns[cell.param];
                    if (!design)
                        throw Error("敵インデックスが不適切です : " + cell.param);
                    const enemy = design.generate(x, y);
                    this.enemies.push(enemy);
                }
                if (cell.event != Event.WALL)
                    this.mappingMax++;
            }
        }
    }
    getCell(x, y) {
        var _a;
        const cell = (_a = this.cells[y]) === null || _a === void 0 ? void 0 : _a[x];
        if (!cell)
            throw new Error(`cellsの範囲外です  x:${x}, y:${y}`);
        return cell;
    }
    moveEnemy(enemy, x, y) {
        const from = this.getCell(enemy.x, enemy.y);
        const to = this.getCell(x, y);
        enemy.setXY(x, y);
        from.event = Event.NONE;
        to.event = Event.ENEMY;
        to.param = from.param;
    }
    deleteEnemy(x, y) {
        const enemies = this.enemies;
        const cell = this.getCell(x, y);
        cell.event = Event.NONE;
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
    mappingAll(cellEvent) {
        const cells = this.cells;
        for (let y = 0; y < cells.length; ++y) {
            for (let x = 0; x < cells[y].length; ++x) {
                if (cellEvent == undefined ||
                    cellEvent == cells[y][x].event)
                    this.mappingCell(x, y, true);
            }
        }
    }
    mappingCell(x, y, stop = false) {
        const cell = this.getCell(x, y);
        if (!cell.mapped) {
            cell.mapped = true;
            this.mappingPoints.push(new Point(x, y));
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
    debugMappingAll(x, y) {
        if (this.mappingRate == 100)
            return;
        this.mappingAll();
        const cell = this.getCell(x, y);
        cell.mapped = false;
        this.mappingCount--;
        this.updateMappingRate();
    }
}
export class DungeonModel {
    constructor(chara, items, enemyDesigns, floors, stairsList) {
        this.chara = chara;
        this.items = items;
        this.enemyDesigns = enemyDesigns;
        this.floors = floors;
        this.stairsList = stairsList;
        this.floorNum = 0;
        this.floor = new Floor([[2000]], new Image(), new Bgm(""), []);
        this.cell = new Cell(2000);
        this.completeCount = 0;
    }
    setCharaCoordinate(floorNum, x, y) {
        const chara = this.chara;
        chara.setXY(x, y);
        chara.direction = Direction.DOWN;
        const floor = this.floors[floorNum];
        if (!floor)
            throw new Error("floorNum が不適切です : " + floorNum);
        this.floorNum = floorNum;
        this.floor = floor;
        this.mappingAround(x, y);
        floor.mappingCell(x, y);
        floor.updateMappingRate();
    }
    incrementCompleteCount() {
        this.completeCount++;
        return (this.completeCount == this.floors.length);
    }
    mappingAround(x, y) {
        const floor = this.floor;
        const top = y - 1;
        const bottom = y + 1;
        const left = x - 1;
        const right = x + 1;
        this.floor.mappingPoints = [];
        floor.mappingCell(x, top);
        floor.mappingCell(x, bottom);
        floor.mappingCell(left, y);
        floor.mappingCell(right, y);
        floor.mappingCell(left, top);
        floor.mappingCell(right, top);
        floor.mappingCell(left, bottom);
        floor.mappingCell(right, bottom);
    }
    walkChara(direction) {
        const chara = this.chara;
        chara.direction = direction;
        let x = chara.x;
        let y = chara.y;
        if (direction == Direction.UP)
            y += -1;
        else if (direction == Direction.DOWN)
            y += 1;
        else if (direction == Direction.LEFT)
            x += -1;
        else if (direction == Direction.RIGHT)
            x += 1;
        const cell = this.floor.getCell(x, y);
        const isWall = (cell.event == Event.WALL);
        if (!isWall) {
            chara.setXY(x, y);
            chara.walkCount++;
            this.mappingAround(x, y);
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
        ].filter(({ x, y }) => { var _a, _b; return (((_b = (_a = floor.cells[y]) === null || _a === void 0 ? void 0 : _a[x]) === null || _b === void 0 ? void 0 : _b.event) == Event.NONE); });
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
    treasureEvent() {
        const itemNum = this.cell.deleteEvent();
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
            enemy.result = EnemyResult.DODGED;
        }
        else {
            chara.hp--;
            enemy.result = (chara.hp == 0)
                ? EnemyResult.GAMEOVER
                : EnemyResult.CRASHED;
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
            enemy.draw(contextBg, BG_CANVAS.LEFT_MARGIN + enemyX - bgX, BG_CANVAS.TOP_MARGIN + enemyY - bgY);
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
                const { event, mapped } = cells[y][x];
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
    animateWalking(nextFunction) {
        const self = this;
        const { chara, floor } = this.model;
        const ctxPre = this.contexts.preRender;
        chara.nextPattern();
        for (const enemy of floor.enemies)
            enemy.nextPattern();
        const FRAME_LENGTH = 7;
        const INTERVAL = 28;
        const FRAME_PX = CELL_PX / FRAME_LENGTH;
        let i = FRAME_LENGTH;
        const x = BG_CANVAS.LEFT_MARGIN + chara.pxX - CELL_PX;
        const y = BG_CANVAS.TOP_MARGIN + chara.pxY - CELL_PX;
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
            for (const { x, y } of floor.mappingPoints)
                self.preRenderCell(x, y);
            ctxPre.restore();
            self.drawFloor(shiftPx);
        }
    }
    preRenderAll() {
        const INVISIBLE_CELL_COLOR = "black";
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
        const context = this.contexts.preRender;
        const floor = this.model.floor;
        const left = BG_CANVAS.LEFT_MARGIN + (x * CELL_PX);
        const top = BG_CANVAS.TOP_MARGIN + (y * CELL_PX);
        const cell = floor.getCell(x, y);
        const { mapped, chipX, chipY } = cell;
        if (mapped) {
            context.drawImage(floor.image, chipX, chipY, CELL_PX, CELL_PX, left, top, CELL_PX, CELL_PX);
        }
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
            const { input, se, model } = this;
            const queue = new OnInputQueue(input);
            this.drawDark();
            this.pushMessage(queue, "地下" + model.floorNum + "階の地図が完成した！", se.complete1, 1500);
            queue.push(resolve);
            queue.run();
        });
    }
    gameCompleteEvent() {
        return new Promise(resolve => {
            const { input, se, rects } = this;
            const queue = new OnInputQueue(input);
            queue.push(() => {
                Bgm.stop();
                se.complete2.play();
                rects.message.draw("すべての階の地図が完成した！", true);
            }, 3000);
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
            const { encountText, safeText, damageText } = enemy.design;
            const { input, se } = this;
            const queue = new OnInputQueue(input);
            this.pushMessage(queue, encountText, se.encount);
            if (result == EnemyResult.DODGED)
                this.pushMessage(queue, safeText, se.useItem);
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
                view.wallEvent();
                this.inputStandby();
                return;
            }
            for (let enemy of floor.enemies)
                model.walkEnemy(enemy);
            yield new Promise(resolve => view.animateWalking(resolve));
            const isFloorCompleted = floor.updateMappingRate();
            view.drawStatus();
            view.drawMap();
            if (isFloorCompleted) {
                const isGameCompleted = model.incrementCompleteCount();
                model.floor.mappingAll();
                view.preRenderAll();
                view.drawFloor();
                view.drawMap();
                yield view.floorCompleteEvent();
                view.drawAll();
                if (isGameCompleted) {
                    yield view.gameCompleteEvent();
                    this.nextFunction();
                    return;
                }
            }
            switch (model.cell.event) {
                case Event.NONE:
                    this.onInput();
                    return;
                case Event.TREASURE:
                    const item = model.treasureEvent();
                    yield view.treasureEvent(item);
                    this.drawAndInputStandby();
                    return;
                case Event.STAIRS:
                    model.stairsEvent();
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
        const { x, y, key } = this.input.getState();
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