import { DIRECTION, type Stairs } from './constants.js';
import { Rect, BGM, Point, Input } from './utility.js';
import { Item, MainChara, EnemyDesign, Enemy } from './character.js';
declare enum EVENT {
    NONE = 1,
    WALL = 2,
    STAIRS = 3,
    BOX = 4,
    ENEMY = 9
}
export type Contexts = {
    ui: CanvasRenderingContext2D;
    dark: CanvasRenderingContext2D;
    bg: CanvasRenderingContext2D;
    preRender: CanvasRenderingContext2D;
};
export type Se = {
    complete1: HTMLAudioElement;
    complete2: HTMLAudioElement;
    stairs: HTMLAudioElement;
    openBox: HTMLAudioElement;
    useItem: HTMLAudioElement;
    crash: HTMLAudioElement;
    select: HTMLAudioElement;
    wall: HTMLAudioElement;
    gameover: HTMLAudioElement;
    encount: HTMLAudioElement;
};
export declare class Cell {
    event: EVENT;
    param: number;
    chipX: number;
    chipY: number;
    visible: boolean;
    constructor(excelData: number);
    getEnemyNum(): number;
    openBox(): number;
}
export declare class Floor {
    cells: Cell[][];
    image: HTMLImageElement;
    bgm: BGM;
    constructor(mapExcelData: number[][], image: HTMLImageElement, bgm: BGM);
}
export declare class DungeonModel {
    chara: MainChara;
    items: Item[];
    enemyDesigns: EnemyDesign[];
    floors: Floor[];
    stairsList: Stairs[];
    completeCount: number;
    floorNum: number;
    enemies: Enemy[];
    cell: Cell;
    cells: Cell[][];
    image: HTMLImageElement;
    bgm: BGM;
    mappingMax: number;
    mappingCount: number;
    mappingRate: number;
    mappingPoints: Point[];
    constructor(chara: MainChara, items: Item[], enemyDesigns: EnemyDesign[], floors: Floor[], stairsList: Stairs[]);
    setCharaCoordinate(floorNum: number, x: number, y: number): void;
    moveEnemy(enemy: Enemy, x: number, y: number): void;
    deleteEnemy(x: number, y: number): Enemy;
    updateMappingRate(notCount?: boolean): boolean;
    isGameCompleted(): boolean;
    mappingAll(cellEvent?: EVENT): void;
    mappingCell(x: number, y: number, stop?: boolean): void;
    mappingAround(x: number, y: number): void;
    walkChara(direction: DIRECTION): boolean;
    walkEnemy(enemy: Enemy): void;
    boxEvent(): Item;
    stairsEvent(): void;
    enemyEvent(): Enemy;
}
export declare class DungeonView {
    model: DungeonModel;
    input: Input;
    contexts: Contexts;
    se: Se;
    rects: {
        readonly status: Rect;
        readonly items: Rect;
        readonly message: Rect;
        readonly up: Rect;
        readonly down: Rect;
        readonly left: Rect;
        readonly right: Rect;
    };
    constructor(model: DungeonModel, input: Input, contexts: Contexts, se: Se);
    drawAll(): void;
    drawFloor(shiftPx?: number): void;
    drawMap(): void;
    drawButton(): void;
    drawStatus(): void;
    drawDark(): void;
    drawStairsScreen(): void;
    animateWalking(nextFunction: () => void): void;
    preRenderAll(): void;
    preRenderCell(x: number, y: number): void;
    enqueueMessage(text: string, audio?: HTMLAudioElement | null, delay?: number, bgmStop?: boolean): void;
    floorCompleteEvent(): Promise<void>;
    gameCompleteEvent(): Promise<void>;
    boxEvent(item: Item): Promise<void>;
    enemyEvent(enemy: Enemy): Promise<void>;
}
export declare class DungeonScreen {
    model: DungeonModel;
    view: DungeonView;
    private input;
    nextFunction: () => void;
    private triangles;
    constructor(model: DungeonModel, view: DungeonView, input: Input);
    show(): void;
    inputStandby(): void;
    drawAndInputStandby(): void;
    onInput(): Promise<void>;
    getInputDirection(): DIRECTION | null;
}
export {};
//# sourceMappingURL=dungeon.d.ts.map