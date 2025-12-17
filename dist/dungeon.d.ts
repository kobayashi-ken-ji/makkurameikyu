import { Direction, type Coordinate, type FloorExcelData } from './constants.js';
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
    checkEvent(event: Event): Cell;
}
interface FloorField {
    readonly name: string;
    readonly image: HTMLImageElement;
    readonly bgm: Bgm;
    readonly cells: readonly (readonly Readonly<Cell>[])[];
    readonly enemies: readonly Readonly<Enemy>[];
    readonly mappingRate: number;
    readonly mappingPoints: readonly Readonly<Point>[];
    getCell(x: number, y: number): Readonly<Cell>;
}
interface FloorMethod {
    moveEnemy(floorEnemyIndex: number, x: number, y: number): void;
    deleteEnemy(x: number, y: number): Enemy;
    updateMappingRate(): boolean;
    mappingAll(): void;
    mappingCell(x: number, y: number, stop?: boolean): void;
    mappingAround(x: number, y: number): void;
    debugMappingAll(x: number, y: number): void;
}
type FloorInterface = FloorField & FloorMethod;
export declare class Floor implements FloorInterface {
    readonly cells: readonly (readonly Cell[])[];
    readonly name: string;
    readonly image: HTMLImageElement;
    readonly bgm: Bgm;
    readonly enemies: Enemy[];
    private mappingMax;
    private mappingCount;
    mappingRate: number;
    mappingPoints: Point[];
    private constructor();
    static create(mapExcelData: FloorExcelData, name: string, image: HTMLImageElement, bgm: Bgm, enemyDesigns: readonly EnemyDesign[]): FloorInterface;
    getCell(x: number, y: number): Readonly<Cell>;
    private _getCell;
    moveEnemy(floorEnemyIndex: number, x: number, y: number): void;
    deleteEnemy(x: number, y: number): Enemy;
    updateMappingRate(): boolean;
    mappingAll(): void;
    mappingCell(x: number, y: number, stop?: boolean): void;
    mappingAround(x: number, y: number): void;
    debugMappingAll(x: number, y: number): void;
}
export declare class CharaStatus {
    readonly hpMax = 3;
    hp: number;
    walkCount: number;
    safeCount: number;
}
interface WalkingResult {
    isWall: boolean;
    event: Event;
    isFloorCompleted: boolean;
    isGameCompleted: boolean;
}
interface ReadonlyDungeonModel {
    getChara(): Readonly<MainChara>;
    getItems(): readonly Readonly<Item>[];
    getCharaStatus(): Readonly<CharaStatus>;
}
export declare class DungeonModel implements ReadonlyDungeonModel {
    private readonly chara;
    private readonly items;
    private readonly floors;
    private readonly stairsDestinations;
    private floor;
    private cell;
    private completeCount;
    private readonly charaStatus;
    constructor(chara: MainChara, items: readonly Item[], floors: readonly FloorInterface[], stairsDestinations: readonly Coordinate[], initialCoordinate: Coordinate);
    getFloor(): FloorField;
    getChara(): Readonly<MainChara>;
    getItems(): readonly Readonly<Item>[];
    getCharaStatus(): Readonly<CharaStatus>;
    changeFloor(floorNum: number, x: number, y: number): void;
    walkAll(direction: Direction): Readonly<WalkingResult>;
    walkChara(direction: Direction): boolean;
    private getEnemyDestination;
    treasureEvent(): Readonly<Item>;
    stairsEvent(): void;
    enemyEvent(): Readonly<Enemy>;
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
    private floor;
    private readonly input;
    private readonly contexts;
    private readonly se;
    private readonly rects;
    constructor(model: ReadonlyDungeonModel, floor: FloorField, input: Input, contexts: Contexts, se: SoundEffects);
    setFloor(floor: FloorField): void;
    drawAll(): void;
    drawFloor(offset?: number): void;
    drawMap(): void;
    drawButton(): void;
    drawStatus(): void;
    drawDark(): void;
    drawStairsScreen(): void;
    drawDungeonScreen(): void;
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