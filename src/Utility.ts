// ファイル内容
//      Rect        - 矩形、テキストボックス
//      Triangle    - 三角形 (クリック判定用)
//      Bgm         - Audioのループ再生・排他再生
//      ImageLoader - 画像読込ユーティリティ
//      Input       - 入力受付 (クリック、キーボード、タッチ)

//=============================================================================
// 矩形クラス
//      - ボタン、メッセージウィンドウ、ステータス表示 などに使用
//      - x, y, w, h を保持
//      - 描画機能 (白ベタ、黒枠、テキスト)
//      - クリックされたかの判定機能
//=============================================================================

export class Rect
{
    /**
     * @param fontSize  [省略可] フォントサイズ
     * @param padding   [省略可] 外枠と文字の隙間
     * @param text      [省略可] 描画する文字列
     */
    constructor (
        public x: number,
        public y: number,
        public w: number,
        public h: number,
        public fontSize: number = 16,
        public padding : number = 10,
        public text    : string = ""
    ) {}

    //-----------------------------------------------------
    // クラス変数, クラスメソッド
    //-----------------------------------------------------

    private static context   : CanvasRenderingContext2D;
    private static messageSe : HTMLAudioElement;

    /**
     * クラスを初期化
     * @param context   描画先キャンバス
     * @param messageSe メッセージを表示したときのSE
     */
    static init(context:CanvasRenderingContext2D, messageSe: HTMLAudioElement) {
        Rect.context   = context;
        Rect.messageSe = messageSe;
    }

    //-----------------------------------------------------
    // インスタンスメソッド
    //-----------------------------------------------------

    // 矩形に含まれる座標か (クリックされたか否か)
    contains(clickX: number, clickY: number): boolean {

        const {x, y, w, h} = this;
        return (
            x <= clickX   &&   clickX <= (x + w)   && 
            y <= clickY   &&   clickY <= (y + h)
        );
    }


    // ウィンドウを消去  (1px拡張)
    clear() {
        Rect.context.clearRect(
            this.x - 1,   this.y - 1,
            this.w + 2,   this.h + 2
        );
    }


    /**
     * ウィンドウ、テキスト を描画
     * @param text          ウィンドウに表示するテキスト
     * @param textAnimation テキストをアニメーション表示するか否か
     */
    draw(text: string = "", textAnimation: boolean = false) {

        // テキストが無ければ描画しない
        text = text || this.text;
        if(!text) return;

        const {x, y, w, h, padding, fontSize} = this;
        const context = Rect.context;

        // 白ベタ
        context.fillStyle = "rgba(255, 255, 255, 1)";    // 透明度も設定
        context.fillRect(x, y, w, h);

        // 外枠 黒
        context.fillStyle = "rgb(0, 0, 0)";
        context.strokeRect(x, y, w, h);

        // テキスト設定
        context.fillStyle    = "black";
        context.font         =  fontSize + "px 'mainfont'";
        context.textAlign    = "left";
        context.textBaseline = "top";
        
        // テキスト描画用
        const left  = x + padding;           // 左端 位置
        const top   = y + padding;           // 上端 位置
        const lineW = w - (padding * 2);     // 文字を表示できる幅
        const lineH = fontSize + 5;          // 改行の高さ

        // 文字コマ送り
        if (textAnimation) {
            
            // 一文字ずつを配列に
            const chars = text.split(""); 

            let i = 0;  // ループカウンタ
            let x = 0;  // 表示位置 x
            let y = 0;  // 表示位置 y
            
            // アニメーション
            const intervalID = setInterval( () => {

                // 文字 と 文字幅
                const char = chars[i++];
                if (char == undefined) return;  // 起こらないはず
                const charW = context.measureText(char).width;

                // 改行文字 or 文字がはみ出す
                const isNewLine = (char == "\n") || (lineW  <  x + charW);

                // 改行処理
                if (isNewLine) {
                    x = 0;
                    y += lineH;
                }

                // 文字描画
                context.fillText(char,  left + x,  top + y);   
                x += charW;

                // アニメ終了 + 効果音
                if (i >= chars.length) {
                    clearInterval(intervalID);
                    Rect.messageSe.play();
                }
            }, 20);
        }
        
        // 瞬間表示
        else {
            // 1行ごとに区切る
            const lines = text.split("\n");

            // 行ごとに表示
            let h = top;
            for (let line of lines) {
                context.fillText(line, left, h, lineW);
                h += lineH;
            }
        }
    }
}

//=============================================================================
// 三角形クラス
//      点が三角形の範囲内か否か (外積を利用)
//=============================================================================

// 座標クラス
export class Point {
    constructor(
        public x: number,
        public y: number
    ) {}
}

export class Triangle
{
    public points: [Point, Point, Point];

    /**
     * 三角形の各頂点の座標 を渡す
     * @param {Point} pointA 
     * @param {Point} pointB 
     * @param {Point} pointC 
     */
    constructor(pointA: Point, pointB: Point, pointC: Point) {
        this.points = [pointA, pointB, pointC];
    }

    
    /**
     * 指定座標が、この三角形の内側か否か
     * (境界線上は外側判定)
     * @param x 座標を指定
     * @param y 座標を指定
     * @returns 三角形の内側か否か
     */
    contains(x: number, y: number): boolean {

        const point = new Point(x, y);
        const [a, b, c] = this.points;

        // 各辺から外積を求め、それが正の値か否か
        const isPositive1 = this.getVectorProduct(point, a, b) > 0;
        const isPositive2 = this.getVectorProduct(point, b, c) > 0;
        const isPositive3 = this.getVectorProduct(point, c, a) > 0;

        // 正負が全て同じ → 三角形の内側
        return (isPositive1 == isPositive2  &&  isPositive2 == isPositive3);
    }


    /**
     * ベクトルのZ成分を取得
     * @param p 指定座標
     * @param a 辺の終点
     * @param b 辺の始点
     * @returns Z成分
     */
    private getVectorProduct(p: Point, a: Point, b: Point): number {

        // 2本のベクトル
        //      ベクトルの成分 = 終点 - 始点
        //      x, y それぞれで行う
        const abX = a.x - b.x;
        const abY = a.y - b.y;

        const pbX = p.x - b.x;
        const pbY = p.y - b.y;

        // 外積
        //      求めたい成分以外をたすき掛け
        //      Z成分 = (X1 * Y2) - (Y1 * X2)
        return (pbX * abY)  -  (pbY * abX);
    }
}

//=============================================================================
// SEクラス
//=============================================================================

export class Sound extends Audio
{
    // インスタンス生成時の音量
    static InitialVolume = 0.5;

    constructor(filePath: string) {
        super(filePath);
        this.volume = Sound.InitialVolume;
    }
}

//=============================================================================
// BGMクラス
//      - Audioクラスを継承し、排他再生・ループ再生 を標準化
//=============================================================================

export class Bgm extends Audio
{
    // インスタンス生成時の音量
    static InitialVolume = 0.5;

    // 再生中のBGM
    private static playingBGM: Bgm | null;

    // ループ再生を設定
    constructor(filePath: string) {
        super(filePath);
        this.loop = true;
        this.volume = Bgm.InitialVolume;
    }

    /**
     * 再生中のものがあれば停止
     */
    public static stop() {
        if (Bgm.playingBGM) {
            Bgm.playingBGM.pause();
            Bgm.playingBGM.currentTime = 0;
            Bgm.playingBGM = null;
        }
    }

    /**
     * BGMの排他再生
     */
    play(): Promise<void> {
        Bgm.stop();
        Bgm.playingBGM = this;
        return super.play();
    }
}

//=============================================================================
// 画像読込待ちユーティリティ
//=============================================================================

export class ImageLoader
{
    // 読込待ち用 プロミス配列
    private static promises: Promise<void>[] = [];

    /**
     * 画像データを読込、Imageインスタンスを返す
     */
    static load(filePath: string): HTMLImageElement {

        // 画像読込
        let image = new Image();
        image.src = filePath;

        // 読込待ち用 Promise
        const promises = new Promise<void>((resolve, reject) => {
            image.onload = ()=>resolve();
        });
        
        this.promises.push(promises);
        return image;
    }

    
    /**
     * load() の読込処理が完了するのを待つ Promise を取得
     * @returns コード例  await ImageLoader.getPromise();
     */
    static getPromise(): Promise<void[]> {

        const promises = ImageLoader.promises;
        ImageLoader.promises = [];
        return Promise.all(promises);
    }
}

//=============================================================================
// 2Dコンテキスト 取得ユーティリティー
//=============================================================================

export class Context2D
{
    /**
     * 2Dコンテキストを取得
     * @param canvasID  canvasタグのid属性
     * @returns         キャンバスコンテキスト
     */
    static get(canvasID: string): CanvasRenderingContext2D {
        
        const canvas = document.getElementById(canvasID);

        if (! (canvas instanceof HTMLCanvasElement))
            throw new Error("指定されたidはキャンバスではありません");

        const context = canvas.getContext('2d');
        if (!context) throw new Error("コンテキストを取得できません");
        return context;
    }
    

    /**
     * 仮想キャンバスを作成, コンテキストを取得
     */
    static createVirtual(w: number, h: number): CanvasRenderingContext2D {

        // getImageData() 高頻度用設定
        const Frequently = {willReadFrequently : true};

        const canvas  = document.createElement('canvas');
        canvas.width  = w;
        canvas.height = h;
        const context = canvas.getContext('2d', Frequently);
        
        if (!context || !(context instanceof CanvasRenderingContext2D))
            throw new Error("仮想キャンバスを作成できません");

        return context;
    }
}

//=============================================================================
// 入力処理クラス
//      - イベントリスナーを作成 (クリック、キーボード、タッチ)
//      - 入力時の処理を管理
//=============================================================================

export class Input
{
    // クリック、タッチ、キーボード の入力値 (初期値は離されている状態)
    private x   : number = -1;
    private y   : number = -1;
    private key : string = "";

    // 入力時に実行する処理
    private onInput : ()=>void  = ()=>{};


    /**
     * 入力された値を取得
     */
    getInputValue() {
        return {
            x   : this.x,
            y   : this.y,
            key : this.key,
        };
    }

    //-------------------------------------------------------------------------
    // 入力待機
    //-------------------------------------------------------------------------

    /**
     * 入力受付状態へ移行
     * @param onInput  入力されたときに実行する処理
     */
    standby(onInput: ()=>void) {
        this.onInput = onInput;
    }

    /**
     * 入力受付を解除
     */
    stop() {
        this.onInput = ()=>{};
    }

    //-------------------------------------------------------------------------    
    // イベントリスナーを生成
    //-------------------------------------------------------------------------

    /**
     * @param element 座標を取得するための要素 (キャンバスなど)
     */
    constructor(element: Element) {

        // 入力受付停止、処理実行
        const run = ()=>{
            const fn = this.onInput;
            this.onInput = ()=>{};
            fn();
        };

        //-------------------------------------------
        // マウス
        //-------------------------------------------

        const mouseDown = (event: MouseEvent)=>{

            const rect = element.getBoundingClientRect();
            this.x     = event.pageX - rect.left;
            this.y     = event.pageY - rect.top;
            this.key   = "click";
            run();
        };

        const mouseUp = (event: MouseEvent)=>{
            this.key = "";
        };

        //-------------------------------------------
        // キーボード
        //-------------------------------------------

        const keyDown = (event: KeyboardEvent)=>{
            this.x   = -1;
            this.y   = -1;
            this.key = event.key;
            run();
        };

        // 最新のキーが離された場合のみ
        const keyUp = (event: KeyboardEvent)=>{
            if (this.key == event.key)
                this.key = "";
        };

        //-------------------------------------------
        // タッチ
        //-------------------------------------------
        
        const touchStart = (event: TouchEvent)=>{

            const touch = event.changedTouches[0];
            if (!touch) return;
            if (!event.target) return;
            
            const rect = element.getBoundingClientRect();
            this.x     = touch.pageX - rect.left;
            this.y     = touch.pageY - rect.top;
            this.key   = "touch";
            run();
        };

        
        const touchEnd = (event: TouchEvent)=>{
            this.key = "";
        };

        //-------------------------------------------
        // クリックリスナーを設定
        //-------------------------------------------

        // タッチできるデバイスかどうか
        const isTouchDevice = window.matchMedia('(hover: none)').matches;

        if (isTouchDevice) {
            document.addEventListener("touchstart", touchStart, false);
            document.addEventListener("touchend"  , touchEnd  , false);
        } else {
            document.addEventListener("mousedown" , mouseDown , false);
            document.addEventListener("mouseup"   , mouseUp   , false);
            document.addEventListener("keydown"   , keyDown   , false);
            document.addEventListener("keyup"     , keyUp     , false);
        }
    }
}

//=============================================================================
// 入力時の処理をキュー化
//      複数処理を登録し、入力されるごとに順次実行する
//      クリックでのメッセージ送り などに使用
//=============================================================================

export class OnInputQueue
{
    private onInputs : (()=>void)[] = [];
    private delays   : number[]     = [];
    private input    : Input;

    constructor(input: Input) {
        this.input = input;
    }


    /**
     * 処理を登録
     * @param onInput   入力時に実行する関数
     * @param delay     関数終了後、次の入力受付を開始するまでの時間 [ミリ秒/省略可]
     */
    push(onInput: ()=>void, delay = 400) {
        this.onInputs.push(onInput);
        this.delays.push(delay);
    }


    /**
     * キューを全て実行
     * (最初の処理は、クリックなしで即時実行)
     */
    run() {
        // デキューし、処理実行
        const onInput = this.onInputs.shift();
        const delay   = this.delays.shift();
        if (onInput == undefined || delay == undefined) return;
        onInput();

        // 次の処理をセット
        if (this.onInputs.length > 0) {
            const run     = () => this.run();
            const standby = () => this.input.standby(run);
            setTimeout(standby, delay);
        }
    }
}