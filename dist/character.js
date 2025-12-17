import { CELL_PX, CHARA_PX, CANVAS, WALK_PATTERN, Direction } from './constants.js';
export class Item {
    constructor(quantity, name) {
        this.quantity = quantity;
        this.name = name;
    }
}
class Walker {
    constructor(image, chipSize) {
        this.image = image;
        this.chipSize = chipSize;
        this._x = 0;
        this._y = 0;
        this.moveX = 0;
        this.moveY = 0;
        this.direction = Direction.DOWN;
        this.i = 0;
    }
    get x() { return this._x; }
    get y() { return this._y; }
    getXyOnBg(offset = 0) {
        return {
            x: (this._x * CELL_PX) - (this.moveX * offset),
            y: (this._y * CELL_PX) - (this.moveY * offset),
        };
    }
    setXy(x, y, direction) {
        this.moveX = x - this._x;
        this.moveY = y - this._y;
        this._x = x;
        this._y = y;
        this.direction =
            (direction !== null && direction !== void 0 ? direction : (this.moveY < 0)) ? Direction.UP :
                (this.moveY > 0) ? Direction.DOWN :
                    (this.moveX < 0) ? Direction.LEFT :
                        (this.moveX > 0) ? Direction.RIGHT :
                            this.direction;
    }
    nextPattern() {
        if (this.i == 3)
            this.i = 0;
        else
            this.i++;
    }
    draw(context, left, top) {
        const { chipSize, i, direction, image } = this;
        const chipX = WALK_PATTERN[i] * chipSize;
        const chipY = direction * chipSize;
        context.drawImage(image, chipX, chipY, chipSize, chipSize, left, top, chipSize, chipSize);
    }
}
export class MainChara extends Walker {
    constructor(image) {
        super(image, CHARA_PX);
        this.diff = CHARA_PX - CELL_PX;
        this.screenX = CANVAS.CHARA_X - (this.diff / 2);
        this.screenY = CANVAS.CHARA_Y - this.diff;
    }
    draw(context) {
        super.draw(context, this.screenX, this.screenY);
    }
}
export var EnemyResult;
(function (EnemyResult) {
    EnemyResult[EnemyResult["UNENCOUNTERED"] = 0] = "UNENCOUNTERED";
    EnemyResult[EnemyResult["DODGED"] = 1] = "DODGED";
    EnemyResult[EnemyResult["CRASHED"] = 2] = "CRASHED";
    EnemyResult[EnemyResult["GAMEOVER"] = 3] = "GAMEOVER";
})(EnemyResult || (EnemyResult = {}));
;
export class Enemy extends Walker {
    constructor(design, x, y) {
        super(design.image, CELL_PX);
        this.setXy(x, y, Direction.DOWN);
        this.design = design;
        this.result = EnemyResult.UNENCOUNTERED;
    }
}
export class EnemyDesign {
    constructor(isChaser, dodgingItem, image, encountText, dodgedText, damageText) {
        this.isChaser = isChaser;
        this.dodgingItem = dodgingItem;
        this.image = image;
        this.encountText = encountText;
        this.dodgedText = dodgedText;
        this.damageText = damageText;
    }
    generate(x, y) {
        return new Enemy(this, x, y);
    }
}
//# sourceMappingURL=character.js.map