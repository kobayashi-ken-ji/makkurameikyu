import { DIRECTION } from './constants.js';
export declare class Item {
    quantity: number;
    name: string;
    constructor(quantity: number, name: string);
}
declare class Walker {
    x: number;
    y: number;
    moveX: number;
    moveY: number;
    pxX: number;
    pxY: number;
    direction: DIRECTION;
    private readonly image;
    private readonly chipSize;
    private i;
    constructor(image: HTMLImageElement, chipSize: number, x: number, y: number);
    setXY(x: number, y: number): void;
    nextPattern(): void;
    draw(context: CanvasRenderingContext2D, left: number, top: number): void;
}
export declare class MainChara extends Walker {
    hpMax: number;
    hp: number;
    walkCount: number;
    safeCount: number;
    private readonly diff;
    private readonly screenX;
    private readonly screenY;
    constructor(image: HTMLImageElement, hpMax: number);
    draw(context: CanvasRenderingContext2D): void;
}
export declare enum ENEMY_RESULT {
    UNENCOUNTERED = 10,
    DODGED = 11,
    CRASHED = 12,
    GAMEOVER = 13
}
export declare class Enemy extends Walker {
    readonly design: EnemyDesign;
    result: ENEMY_RESULT;
    constructor(design: EnemyDesign, x: number, y: number);
}
export declare class EnemyDesign {
    readonly chase: boolean;
    readonly safeItem: Item;
    readonly image: HTMLImageElement;
    readonly encountText: string;
    readonly safeText: string;
    readonly damageText: string;
    constructor(chase: boolean, safeItem: Item, image: HTMLImageElement, encountText: string, safeText: string, damageText: string);
    generate(x: number, y: number): Enemy;
}
export {};
//# sourceMappingURL=character.d.ts.map