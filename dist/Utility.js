export class Rect {
    constructor(x, y, w, h, fontSize = 16, padding = 10, text = "") {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.fontSize = fontSize;
        this.padding = padding;
        this.text = text;
    }
    static init(context, messageSe) {
        Rect.context = context;
        Rect.messageSe = messageSe;
    }
    contains(clickX, clickY) {
        const { x, y, w, h } = this;
        return (x <= clickX && clickX <= (x + w) &&
            y <= clickY && clickY <= (y + h));
    }
    clear() {
        Rect.context.clearRect(this.x - 1, this.y - 1, this.w + 2, this.h + 2);
    }
    draw(text = "", textAnimation = false) {
        text = text || this.text;
        if (!text)
            return;
        const { x, y, w, h, padding, fontSize } = this;
        const context = Rect.context;
        context.fillStyle = "rgba(255, 255, 255, 1)";
        context.fillRect(x, y, w, h);
        context.fillStyle = "rgb(0, 0, 0)";
        context.strokeRect(x, y, w, h);
        context.fillStyle = "black";
        context.font = fontSize + "px 'mainfont'";
        context.textAlign = "left";
        context.textBaseline = "top";
        const left = x + padding;
        const top = y + padding;
        const lineW = w - (padding * 2);
        const lineH = fontSize + 5;
        if (textAnimation) {
            const chars = text.split("");
            let i = 0;
            let x = 0;
            let y = 0;
            const intervalID = setInterval(() => {
                const char = chars[i++];
                if (char == undefined)
                    return;
                const charW = context.measureText(char).width;
                const isNewLine = (char == "\n") || (lineW < x + charW);
                if (isNewLine) {
                    x = 0;
                    y += lineH;
                }
                context.fillText(char, left + x, top + y);
                x += charW;
                if (i >= chars.length) {
                    clearInterval(intervalID);
                    Rect.messageSe.play();
                }
            }, 20);
        }
        else {
            const lines = text.split("\n");
            let h = top;
            for (let line of lines) {
                context.fillText(line, left, h, lineW);
                h += lineH;
            }
        }
    }
}
export class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}
export class Triangle {
    constructor(pointA, pointB, pointC) {
        this.points = [pointA, pointB, pointC];
    }
    contains(x, y) {
        const point = new Point(x, y);
        const [a, b, c] = this.points;
        const isPositive1 = this.getVectorProduct(point, a, b) > 0;
        const isPositive2 = this.getVectorProduct(point, b, c) > 0;
        const isPositive3 = this.getVectorProduct(point, c, a) > 0;
        return (isPositive1 == isPositive2 && isPositive2 == isPositive3);
    }
    getVectorProduct(p, a, b) {
        const abX = a.x - b.x;
        const abY = a.y - b.y;
        const pbX = p.x - b.x;
        const pbY = p.y - b.y;
        return (pbX * abY) - (pbY * abX);
    }
}
export class Sound extends Audio {
    constructor(filePath) {
        super(filePath);
        this.volume = Sound.InitialVolume;
    }
}
Sound.InitialVolume = 0.5;
export class Bgm extends Audio {
    constructor(filePath) {
        super(filePath);
        this.loop = true;
        this.volume = Bgm.InitialVolume;
    }
    static stop() {
        if (Bgm.playingBGM) {
            Bgm.playingBGM.pause();
            Bgm.playingBGM.currentTime = 0;
            Bgm.playingBGM = null;
        }
    }
    play() {
        Bgm.stop();
        Bgm.playingBGM = this;
        return super.play();
    }
}
Bgm.InitialVolume = 0.5;
export class ImageLoader {
    static load(filePath) {
        let image = new Image();
        image.src = filePath;
        const promises = new Promise((resolve, reject) => {
            image.onload = () => resolve();
        });
        this.promises.push(promises);
        return image;
    }
    static getPromise() {
        const promises = ImageLoader.promises;
        ImageLoader.promises = [];
        return Promise.all(promises);
    }
}
ImageLoader.promises = [];
export class Context2D {
    static get(canvasID) {
        const canvas = document.getElementById(canvasID);
        if (!(canvas instanceof HTMLCanvasElement))
            throw new Error("指定されたidはキャンバスではありません");
        const context = canvas.getContext('2d');
        if (!context)
            throw new Error("コンテキストを取得できません");
        return context;
    }
    static createVirtual(w, h) {
        const Frequently = { willReadFrequently: true };
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const context = canvas.getContext('2d', Frequently);
        if (!context || !(context instanceof CanvasRenderingContext2D))
            throw new Error("仮想キャンバスを作成できません");
        return context;
    }
}
export class Input {
    standby(onInput) {
        this.onInput = onInput;
    }
    stop() {
        this.onInput = () => { };
    }
    constructor(element) {
        this.x = -1;
        this.y = -1;
        this.key = null;
        this.onInput = () => { };
        this.queue = [];
        const run = () => {
            const fn = this.onInput;
            this.onInput = () => { };
            fn();
        };
        const mouseDown = (event) => {
            const rect = element.getBoundingClientRect();
            this.x = event.pageX - rect.left;
            this.y = event.pageY - rect.top;
            this.key = "click";
            run();
        };
        const mouseUp = (event) => {
            this.key = null;
        };
        const keyDown = (event) => {
            this.x = -1;
            this.y = -1;
            this.key = event.key;
            run();
        };
        const keyUp = (event) => {
            if (this.key == event.key)
                this.key = null;
        };
        const touchStart = (event) => {
            const touch = event.changedTouches[0];
            if (!touch)
                return;
            if (!event.target)
                return;
            const rect = element.getBoundingClientRect();
            this.x = touch.pageX - rect.left;
            this.y = touch.pageY - rect.top;
            this.key = "touch";
            run();
        };
        const touchEnd = (event) => {
            this.key = null;
        };
        const isTouchDevice = window.matchMedia('(hover: none)').matches;
        if (isTouchDevice) {
            document.addEventListener("touchstart", touchStart, false);
            document.addEventListener("touchend", touchEnd, false);
        }
        else {
            document.addEventListener("mousedown", mouseDown, false);
            document.addEventListener("mouseup", mouseUp, false);
            document.addEventListener("keydown", keyDown, false);
            document.addEventListener("keyup", keyUp, false);
        }
    }
    enqueue(onInput, delay = 400) {
        const queue = { onInput, delay };
        this.queue.push(queue);
    }
    runQueue() {
        this.stop();
        const isLast = (this.queue.length == 1);
        const delayFn = this.queue.shift();
        if (!delayFn)
            return;
        const { onInput, delay } = delayFn;
        onInput();
        if (!isLast) {
            const run = () => { this.runQueue(); };
            setTimeout(() => { this.onInput = run; }, delay);
        }
    }
}
//# sourceMappingURL=utility.js.map