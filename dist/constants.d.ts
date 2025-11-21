export declare const CELL_PX = 32;
export declare const CHARA_PX = 44;
export declare const CANVAS_W = 320;
export declare const CANVAS_H = 480;
export declare const V_CANVAS_PX = 1600;
export declare const SCREEN_CENTER_X = 5;
export declare const SCREEN_CENTER_Y = 5;
export declare const SCREEN_CENTER_PX_X: number;
export declare const SCREEN_CENTER_PX_Y: number;
export declare const INVISIBLE_CELL_COLOR = "black";
export declare const WALK_PATTERN: readonly [1, 0, 1, 2];
export declare enum DIRECTION {
    UP = 0,
    RIGHT = 1,
    DOWN = 2,
    LEFT = 3
}
export type Stairs = [floorNum: number, x: number, y: number];
export declare const STAIRS_LIST: Stairs[];
type floor = number[][];
export declare const DUNGEON_EXCEL_DATA: [floor, floor, floor];
export {};
//# sourceMappingURL=constants.d.ts.map