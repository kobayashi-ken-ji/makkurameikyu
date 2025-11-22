export declare const CELL_PX = 32;
export declare const CHARA_PX = 44;
export declare const CANVAS: {
    readonly W: 320;
    readonly H: 480;
    readonly CHARA_X: number;
    readonly CHARA_Y: number;
};
export declare const BG_CANVAS: {
    readonly W: number;
    readonly H: number;
};
export declare const WALK_PATTERN: readonly [1, 0, 1, 2];
export declare enum DIRECTION {
    UP = 0,
    RIGHT = 1,
    DOWN = 2,
    LEFT = 3
}
export type Contexts = Readonly<{
    ui: CanvasRenderingContext2D;
    dark: CanvasRenderingContext2D;
    bg: CanvasRenderingContext2D;
    preRender: CanvasRenderingContext2D;
}>;
export type Se = Readonly<{
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
}>;
export type Stairs = [floorNum: number, x: number, y: number];
export declare const STAIRS_LIST: Stairs[];
type floor = number[][];
export declare const DUNGEON_EXCEL_DATA: [floor, floor, floor];
export {};
//# sourceMappingURL=constants.d.ts.map