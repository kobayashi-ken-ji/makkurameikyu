import { type Coordinate, type FloorExcelData } from './constants.js';
import { Bgm, Point, Input } from './utility.js';
import { Direction, MainChara, EnemyDesign, Enemy, type ReadonlyWalker, type ReadonlyEnemy } from './character.js';
declare enum Event {
    NONE = 1,
    WALL = 2,
    STAIRS = 3,
    TREASURE = 4,
    ENEMY = 9
}
export declare class Item {
    quantity: number;
    readonly name: string;
    constructor(quantity: number, name: string);
}
export declare class Cell {
    event: Event;
    param: number;
    chipX: number;
    chipY: number;
    mapped: boolean;
    constructor(excelData: number);
    static readonly ROAD_CHIP: {
        readonly X: 0;
        readonly Y: number;
    };
}
interface WalkingResult {
    readonly event: Event;
    readonly isFloorCompleted: boolean;
    readonly isGameCompleted: boolean;
}
interface EnemyResult {
    readonly enemyDesign: EnemyDesign;
    readonly isDodged: boolean;
    readonly isGameOver: boolean;
}
export interface CharaStatus {
    readonly hpMax: number;
    hp: number;
    walkingCount: number;
    dodgedCount: number;
}
interface ReadonlyFloor {
    readonly cells: readonly (readonly Readonly<Cell>[])[];
    readonly enemies: readonly ReadonlyEnemy[];
    readonly mappingRate: number;
    readonly mappingPoints: readonly Readonly<Point>[];
}
interface ReadonlyDungeonModel {
    readonly chara: ReadonlyWalker;
    readonly charaStatus: Readonly<CharaStatus>;
    readonly items: readonly Readonly<Item>[];
    readonly floor: ReadonlyFloor;
    readonly floorIndex: number;
}
export declare class Floor implements ReadonlyFloor {
    private readonly _cells;
    private readonly _enemies;
    private mappingMax;
    private mappingCount;
    private _mappingPoints;
    get enemies(): readonly ReadonlyEnemy[];
    get cells(): readonly (readonly Readonly<Cell>[])[];
    get mappingPoints(): readonly Readonly<Point>[];
    get mappingRate(): number;
    constructor(mapExcelData: FloorExcelData, enemyDesigns: readonly EnemyDesign[]);
    getCell(x: number, y: number, event?: Event): Readonly<Cell>;
    private _getCell;
    openTreasure(x: number, y: number): number;
    getStairsParam(x: number, y: number): number;
    moveEnemy(floorEnemyIndex: number, x: number, y: number): void;
    deleteEnemy(x: number, y: number): Enemy;
    mappingAll(): void;
    mappingCell(x: number, y: number, stop?: boolean): void;
    mappingAround(x: number, y: number): void;
    debugMappingAll(x: number, y: number): void;
}
export declare class DungeonModel implements ReadonlyDungeonModel {
    private readonly _chara;
    private readonly _items;
    private readonly floors;
    private readonly stairsDestinations;
    private _floorIndex;
    private _floor;
    private completeCount;
    private readonly _charaStatus;
    constructor(_chara: MainChara, _items: readonly Item[], floors: readonly Floor[], stairsDestinations: readonly Coordinate[], initialCoordinate: Coordinate);
    get floor(): ReadonlyFloor;
    get chara(): ReadonlyWalker;
    get items(): readonly Readonly<Item>[];
    get charaStatus(): Readonly<CharaStatus>;
    get floorIndex(): number;
    changeFloor(floorIndex: number, x: number, y: number): void;
    walkAll(direction: Direction): WalkingResult;
    private walkChara;
    private getEnemyDestination;
    treasureEvent(): Readonly<Item>;
    stairsEvent(): void;
    enemyEvent(): EnemyResult;
}
export declare class FloorMedia {
    readonly name: string;
    readonly image: HTMLImageElement;
    readonly bgm: Bgm;
    constructor(name: string, image: HTMLImageElement, bgm: Bgm);
}
export interface Contexts {
    readonly ui: CanvasRenderingContext2D;
    readonly dark: CanvasRenderingContext2D;
    readonly bg: CanvasRenderingContext2D;
    readonly preRender: CanvasRenderingContext2D;
}
export interface SoundEffects {
    readonly complete1: HTMLAudioElement;
    readonly complete2: HTMLAudioElement;
    readonly stairs: HTMLAudioElement;
    readonly openBox: HTMLAudioElement;
    readonly useItem: HTMLAudioElement;
    readonly crash: HTMLAudioElement;
    readonly select: HTMLAudioElement;
    readonly wall: HTMLAudioElement;
    readonly gameover: HTMLAudioElement;
    readonly encount: HTMLAudioElement;
}
export declare class DungeonView {
    private readonly model;
    private readonly floorMedias;
    private readonly input;
    private readonly contexts;
    private readonly se;
    private readonly rects;
    private floorMedia;
    constructor(model: ReadonlyDungeonModel, floorMedias: readonly FloorMedia[], input: Input, contexts: Contexts, se: SoundEffects);
    changeFloorMedia(): void;
    drawAll(): void;
    drawFloor(offset?: number): void;
    drawMap(): void;
    drawButton(): void;
    drawStatus(): void;
    drawDark(): void;
    floorChangeScreen(): void;
    drawDungeonScreen(): void;
    walkingAnimation(nextFunction: () => void): void;
    preRenderAll(): void;
    preRenderCell(x: number, y: number): void;
    private pushMessage;
    wallEvent(): void;
    floorCompleteEvent(): Promise<void>;
    gameCompleteEvent(): Promise<void>;
    treasureEvent(item: Readonly<Item>): Promise<void>;
    enemyEvent(result: EnemyResult): Promise<void>;
}
export declare class DungeonController {
    readonly model: Readonly<DungeonModel>;
    private readonly view;
    private readonly input;
    nextFunction?: (result: Readonly<CharaStatus>) => void;
    private readonly triangles;
    constructor(model: Readonly<DungeonModel>, view: DungeonView, input: Readonly<Input>);
    show(): void;
    private inputStandby;
    private drawAndInputStandby;
    private onInput;
    private getInputDirection;
}
export {};
//# sourceMappingURL=dungeon.d.ts.map