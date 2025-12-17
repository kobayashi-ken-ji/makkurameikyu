export declare class Rect {
    x: number;
    y: number;
    w: number;
    h: number;
    fontSize: number;
    padding: number;
    text: string;
    constructor(x: number, y: number, w: number, h: number, fontSize?: number, padding?: number, text?: string);
    private static context;
    private static messageSe;
    static init(context: CanvasRenderingContext2D, messageSe: HTMLAudioElement): void;
    contains(clickX: number, clickY: number): boolean;
    clear(): void;
    draw(text?: string, textAnimation?: boolean): void;
}
export declare class Point {
    x: number;
    y: number;
    constructor(x: number, y: number);
}
export declare class Triangle {
    points: [Point, Point, Point];
    constructor(pointA: Point, pointB: Point, pointC: Point);
    contains(x: number, y: number): boolean;
    private getVectorProduct;
}
export declare class Sound extends Audio {
    static InitialVolume: number;
    constructor(filePath: string);
}
export declare class Bgm extends Audio {
    static InitialVolume: number;
    private static playingBGM;
    constructor(filePath: string);
    static stop(): void;
    play(): Promise<void>;
}
export declare class ImageLoader {
    private static promises;
    static load(filePath: string): HTMLImageElement;
    static getPromise(): Promise<void[]>;
}
export declare class Context2D {
    static get(canvasID: string): CanvasRenderingContext2D;
    static createVirtual(w: number, h: number): CanvasRenderingContext2D;
}
export declare class Input {
    private x;
    private y;
    private key;
    private onInput;
    getInputValue(): {
        x: number;
        y: number;
        key: string;
    };
    standby(onInput: () => void): void;
    stop(): void;
    constructor(element: Element);
}
export declare class OnInputQueue {
    private onInputs;
    private delays;
    private input;
    constructor(input: Input);
    push(onInput: () => void, delay?: number): void;
    run(): void;
}
//# sourceMappingURL=utility.d.ts.map