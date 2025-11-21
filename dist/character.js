import { CELL_PX, CHARA_PX, SCREEN_CENTER_X, SCREEN_CENTER_Y, WALK_PATTERN, DIRECTION, } from './constants.js';
export class Item {
    constructor(quantity, name) {
        this.quantity = quantity;
        this.name = name;
    }
}
class Walker {
    constructor(image, chipSize, x, y) {
        this.x = 0;
        this.y = 0;
        this.moveX = 0;
        this.moveY = 0;
        this.pxX = 0;
        this.pxY = 0;
        this.image = image;
        this.chipSize = chipSize;
        this.setXY(x, y);
        this.direction = DIRECTION.DOWN;
        this.i = 0;
    }
    setXY(x, y) {
        const lastX = this.x;
        const lastY = this.y;
        this.x = x;
        this.y = y;
        this.moveX = x - lastX;
        this.moveY = y - lastY;
        this.pxX = x * CELL_PX;
        this.pxY = y * CELL_PX;
        this.direction =
            (this.moveY < 0) ? DIRECTION.UP :
                (this.moveY > 0) ? DIRECTION.DOWN :
                    (this.moveX < 0) ? DIRECTION.LEFT :
                        (this.moveX > 0) ? DIRECTION.RIGHT :
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
    constructor(image, hpMax) {
        super(image, CHARA_PX, 0, 0);
        this.walkCount = 0;
        this.safeCount = 0;
        this.diff = CHARA_PX - CELL_PX;
        this.screenX = SCREEN_CENTER_X * CELL_PX - (this.diff / 2);
        this.screenY = SCREEN_CENTER_Y * CELL_PX - this.diff;
        this.hpMax = hpMax;
        this.hp = hpMax;
    }
    draw(context) {
        super.draw(context, this.screenX, this.screenY);
    }
}
export var ENEMY_RESULT;
(function (ENEMY_RESULT) {
    ENEMY_RESULT[ENEMY_RESULT["UNENCOUNTERED"] = 10] = "UNENCOUNTERED";
    ENEMY_RESULT[ENEMY_RESULT["DODGED"] = 11] = "DODGED";
    ENEMY_RESULT[ENEMY_RESULT["CRASHED"] = 12] = "CRASHED";
    ENEMY_RESULT[ENEMY_RESULT["GAMEOVER"] = 13] = "GAMEOVER";
})(ENEMY_RESULT || (ENEMY_RESULT = {}));
;
export class Enemy extends Walker {
    constructor(design, x, y) {
        super(design.image, CELL_PX, x, y);
        this.design = design;
        this.result = ENEMY_RESULT.UNENCOUNTERED;
    }
}
export class EnemyDesign {
    constructor(chase, safeItem, image, encountText, safeText, damageText) {
        this.chase = chase;
        this.safeItem = safeItem;
        this.image = image;
        this.encountText = encountText;
        this.safeText = safeText;
        this.damageText = damageText;
    }
    generate(x, y) {
        return new Enemy(this, x, y);
    }
}
//# sourceMappingURL=character.js.map