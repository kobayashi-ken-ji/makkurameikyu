export declare const WALK_PATTERN: readonly [1, 0, 1, 2];
export declare enum Direction {
    UP = 0,
    RIGHT = 1,
    DOWN = 2,
    LEFT = 3
}
export interface ReadonlyWalker {
    x: number;
    y: number;
    direction: Direction;
    getXyOnBg(offset?: number): {
        x: number;
        y: number;
    };
    nextWalkingPattern(): void;
    draw(context: CanvasRenderingContext2D, left?: number, top?: number): void;
}
declare abstract class Walker implements ReadonlyWalker {
    private readonly image;
    private readonly chipSize;
    private _x;
    private _y;
    private moveX;
    private moveY;
    direction: Direction;
    private i;
    constructor(image: HTMLImageElement, chipSize: number);
    get x(): number;
    get y(): number;
    getXyOnBg(offset?: number): {
        x: number;
        y: number;
    };
    setXy(x: number, y: number, direction?: Direction): void;
    nextWalkingPattern(): void;
    draw(context: CanvasRenderingContext2D, left: number, top: number): void;
}
export declare class MainChara extends Walker {
    private readonly screenX;
    private readonly screenY;
    constructor(image: HTMLImageElement);
    draw(context: CanvasRenderingContext2D): void;
}
export type ReadonlyEnemy = ReadonlyWalker & {
    readonly design: EnemyDesign;
};
export declare class Enemy extends Walker implements ReadonlyEnemy {
    readonly design: EnemyDesign;
    constructor(design: EnemyDesign, x: number, y: number);
}
export declare class EnemyDesign {
    readonly isChaser: boolean;
    readonly dodgingItem: number;
    readonly image: HTMLImageElement;
    readonly encountText: string;
    readonly dodgedText: string;
    readonly damageText: string;
    constructor(isChaser: boolean, dodgingItem: number, image: HTMLImageElement, encountText: string, dodgedText: string, damageText: string);
    generate(x: number, y: number): Enemy;
}
export {};
//# sourceMappingURL=character.d.ts.map