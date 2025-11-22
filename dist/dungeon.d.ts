import { DIRECTION, type Stairs, type Contexts, type Se } from './constants.js';
import { Rect, Bgm, Point, Input } from './utility.js';
import { Item, MainChara, EnemyDesign, Enemy } from './character.js';
declare enum EVENT {
    NONE = 1,
    WALL = 2,
    STAIRS = 3,
    BOX = 4,
    ENEMY = 9
}
export declare class Cell {
    event: EVENT;
    param: number;
    chipX: number;
    chipY: number;
    visible: boolean;
    constructor(excelData: Readonly<number>);
    getEnemyNum(): number;
    openBox(): number;
}
export declare class Floor {
    readonly image: HTMLImageElement;
    readonly bgm: Bgm;
    cells: Cell[][];
    enemies: Enemy[];
    mappingMax: number;
    mappingCount: number;
    mappingRate: number;
    constructor(mapExcelData: Readonly<number[][]>, image: HTMLImageElement, bgm: Bgm, enemyDesigns: Readonly<EnemyDesign[]>);
    moveEnemy(enemy: Enemy, x: number, y: number): void;
    deleteEnemy(x: number, y: number): Enemy;
    updateMappingRate(): boolean;
}
export declare class DungeonModel {
    readonly chara: MainChara;
    readonly items: Item[];
    readonly enemyDesigns: EnemyDesign[];
    readonly floors: Floor[];
    readonly stairsList: Stairs[];
    completeCount: number;
    floorNum: number;
    floor: Floor;
    cell: Cell;
    mappingPoints: Point[];
    constructor(chara: MainChara, items: Item[], enemyDesigns: EnemyDesign[], floors: Floor[], stairsList: Stairs[]);
    setCharaCoordinate(floorNum: number, x: number, y: number): void;
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
    readonly model: DungeonModel;
    readonly input: Input;
    readonly contexts: Contexts;
    readonly se: Se;
    readonly rects: {
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
    animateWalking(direction: DIRECTION, nextFunction: () => void): void;
    preRenderAll(): void;
    preRenderCell(x: number, y: number): void;
    enqueueMessage(text: string, audio?: HTMLAudioElement | null, delay?: number, bgmStop?: boolean): void;
    floorCompleteEvent(): Promise<void>;
    gameCompleteEvent(): Promise<void>;
    boxEvent(item: Readonly<Item>): Promise<void>;
    enemyEvent(enemy: Readonly<Enemy>): Promise<void>;
}
export declare class DungeonScreen {
    readonly model: DungeonModel;
    readonly view: DungeonView;
    private readonly input;
    nextFunction: () => void;
    private readonly triangles;
    constructor(model: DungeonModel, view: DungeonView, input: Input);
    show(): void;
    private inputStandby;
    private drawAndInputStandby;
    private onInput;
    private getInputDirection;
}
export {};
//# sourceMappingURL=dungeon.d.ts.map