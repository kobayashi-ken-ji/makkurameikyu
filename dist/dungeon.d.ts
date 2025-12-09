import { Direction, type StairsExcelData, type FloorExcelData, type Contexts, type SoundEffects } from './constants.js';
import { Bgm, Point, Input } from './utility.js';
import { Item, MainChara, EnemyDesign, Enemy } from './character.js';
declare enum Event {
    NONE = 1,
    WALL = 2,
    STAIRS = 3,
    TREASURE = 4,
    ENEMY = 9
}
export declare class Cell {
    event: Event;
    param: number;
    chipX: number;
    chipY: number;
    mapped: boolean;
    constructor(excelData: number);
    deleteEvent(): number;
}
export declare class Floor {
    readonly image: HTMLImageElement;
    readonly bgm: Bgm;
    readonly cells: readonly (readonly Cell[])[];
    readonly enemies: Enemy[];
    private mappingMax;
    private mappingCount;
    mappingRate: number;
    mappingPoints: Point[];
    constructor(mapExcelData: FloorExcelData, image: HTMLImageElement, bgm: Bgm, enemyDesigns: readonly EnemyDesign[]);
    getCell(x: number, y: number): Cell;
    moveEnemy(enemy: Enemy, x: number, y: number): void;
    deleteEnemy(x: number, y: number): Enemy;
    updateMappingRate(): boolean;
    mappingAll(cellEvent?: Event): void;
    mappingCell(x: number, y: number, stop?: boolean): void;
    debugMappingAll(x: number, y: number): void;
}
export declare class DungeonModel {
    readonly chara: MainChara;
    readonly items: readonly Item[];
    readonly enemyDesigns: readonly EnemyDesign[];
    readonly floors: readonly Floor[];
    readonly stairsList: readonly StairsExcelData[];
    floorNum: number;
    floor: Floor;
    cell: Cell;
    private completeCount;
    constructor(chara: MainChara, items: readonly Item[], enemyDesigns: readonly EnemyDesign[], floors: readonly Floor[], stairsList: readonly StairsExcelData[]);
    setCharaCoordinate(floorNum: number, x: number, y: number): void;
    incrementCompleteCount(): boolean;
    mappingAround(x: number, y: number): void;
    walkChara(direction: Direction): boolean;
    walkEnemy(enemy: Enemy): void;
    treasureEvent(): Readonly<Item>;
    stairsEvent(): void;
    enemyEvent(): Enemy;
}
export declare class DungeonView {
    private readonly model;
    private readonly input;
    private readonly contexts;
    private readonly se;
    private readonly rects;
    constructor(model: Readonly<DungeonModel>, input: Input, contexts: Contexts, se: SoundEffects);
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
    private pushMessage;
    wallEvent(): void;
    floorCompleteEvent(): Promise<void>;
    gameCompleteEvent(): Promise<void>;
    treasureEvent(item: Readonly<Item>): Promise<void>;
    enemyEvent(enemy: Readonly<Enemy>): Promise<void>;
}
export declare class DungeonScreen {
    readonly model: DungeonModel;
    private readonly view;
    private readonly input;
    nextFunction: () => void;
    private readonly triangles;
    constructor(model: DungeonModel, view: DungeonView, input: Readonly<Input>);
    show(): void;
    private inputStandby;
    private drawAndInputStandby;
    private onInput;
    private getInputDirection;
}
export {};
//# sourceMappingURL=dungeon.d.ts.map