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
    x: number;
    y: number;
    key: string | null;
    private onInput;
    private queue;
    standby(onInput: () => {}): void;
    stop(): void;
    constructor(element: Element);
    enqueue(onInput: () => void, delay?: number): void;
    runQueue(): void;
}
//# sourceMappingURL=utility.d.ts.map