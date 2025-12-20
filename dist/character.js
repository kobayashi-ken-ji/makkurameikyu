import { CELL_PX, CHARA_PX, CANVAS } from './constants.js';
export const WALK_PATTERN = [1, 0, 1, 2];
export var Direction;
(function (Direction) {
    Direction[Direction["UP"] = 0] = "UP";
    Direction[Direction["RIGHT"] = 1] = "RIGHT";
    Direction[Direction["DOWN"] = 2] = "DOWN";
    Direction[Direction["LEFT"] = 3] = "LEFT";
})(Direction || (Direction = {}));
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
    nextWalkingPattern() {
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
        const diff = CHARA_PX - CELL_PX;
        this.screenX = CANVAS.CHARA_X - (diff / 2);
        this.screenY = CANVAS.CHARA_Y - diff;
    }
    draw(context) {
        super.draw(context, this.screenX, this.screenY);
    }
}
export class Enemy extends Walker {
    constructor(design, x, y) {
        super(design.image, CELL_PX);
        this.setXy(x, y, Direction.DOWN);
        this.design = design;
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