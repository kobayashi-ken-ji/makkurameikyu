// ファイルの内容
//      データ用クラス
//      Cell  - 1マス
//      Floor - 1階層
// 
//      ダンジョン画面用クラス
//      DungeonModel    - Model         処理
//      DungeonView     - View          描画、演出
//      DungeonScreen   - Contoroller   統括

//=============================================================================
// インポート
//=============================================================================

// 定数
import {
    CELL_PX, CANVAS, BG_CANVAS, Direction, type Coordinate, type FloorExcelData
} from './constants.js';

// クラス
import {Rect, Bgm, Point, Triangle, Input, OnInputQueue} from './utility.js';
import {Item, MainChara, EnemyDesign, Enemy, EnemyResult} from './character.js';

//=============================================================================
// 定数 (エクセルデータと共通)
//=============================================================================

/**
 * セルのイベント  (エクセルデータと共通)
 */
enum Event {
    NONE     = 1,    // 通路     敵は ここのみ通行可
    WALL     = 2,    // 壁       キャラは ここ以外を通行可
    STAIRS   = 3,    // 階段
    TREASURE = 4,    // 宝箱
    ENEMY    = 9,    // 通路に敵がいる
}

/**
 * 壁の種類  (エクセルデータと共通)
 */
enum Wall {
    NORMAL      = 0,    // 通常
    MAPPING_TOP = 1,    // 上のセルも同時に可視化
};

//=============================================================================
// 自作エラー
//=============================================================================

class IndexError extends Error {
    public constructor(index: number) {
        super(`配列の要素を取得できませんでした。 index:${index}`);
    }
}

class IndexError2D extends Error {
    public constructor(x: number, y: number) {
        super(`二次元配列の要素を取得できませんでした。 x:${x}, y:${y}`);
    }
}

//=============================================================================
// セル クラス
//      ・ダンジョンの１マスのデータを保持
//=============================================================================

export class Cell
{
    event  : Event;    // イベント
    param  : number;   // イベント詳細 (壁の種類 | 階段番号 | アイテム番号 | 敵番号)
    chipX  : number;   // チップ座標X (背景画像シート用)
    chipY  : number;   // チップ座標Y (背景画像シート用)
    mapped : boolean;  // マッピング済みか否か

    /**
     * @param excelData  エクセルで作成したセルデータ
     */
    constructor(excelData: number) {

        // エクセルデータを桁ごとに分解
        //      例: 1234  →  ["1", "2", "3", "4"]
        const arr: string[] = excelData.toString().split("");
        
        if (arr.length != 4)
            throw new Error(`引数${excelData}は4桁ではありません。`);

        // フィールドに代入
        this.event  = Number(arr[0]);
        this.param  = Number(arr[1]);
        this.chipX  = Number(arr[2]) * CELL_PX;     // セル座標 → ピクセル座標
        this.chipY  = Number(arr[3]) * CELL_PX;
        this.mapped = false;
    }


    /**
     * 通路化し、元イベントのパラメータを返す
     */
    deleteEvent(): number {
        this.event = Event.NONE;
        this.chipX = 0;
        this.chipY = 5 * CELL_PX;
        return this.param;
    }

    /**
     * 指定イベントと異なる場合は、エラーを発生させる
     * @param event 想定されるイベント
     * @returns     セル自身
     */
    checkEvent(event: Event): Cell {
        if (this.event != event)
            throw new Error(`想定されているeventと異なります。 event:${event}`);

        return this;
    }
}

//=============================================================================
// 階層 クラス
//      ・階層１つ分のデータを保持
//      ・整合性を維持するための操作メソッド
//=============================================================================

/**
 * DungeonView へ公開する部分 (内部を変更できるメソッドを排除)
 */
interface ReadonlyFloor {
    readonly name  : string;
    readonly image : HTMLImageElement;
    readonly bgm   : Bgm;
    getCell(x: number, y: number): Readonly<Cell>;
    getCells(): readonly (readonly Readonly<Cell>[])[];
    getEnemies(): readonly Readonly<Enemy>[];
    getMappingRate(): number;
    getMappingPoints(): readonly Readonly<Point>[];
}


export class Floor implements ReadonlyFloor
{
    // マップデータ(セルの二次元配列)、階層内の敵リスト
    private readonly cells   : readonly(readonly Cell[])[];
    private readonly enemies : Enemy[] = [];

    // マッピング率関連
    private mappingMax   = 0;   // 通行できるセルの数
    private mappingCount = 0;   // マッピング数 (通行できるセルのみ)
    private mappingRate  = 0;   // 踏破率
    private mappingPoints: Point[] = [];    // 歩行時にマッピングした座標 の配列

    // 公開するフィールド
    //      クラス内では不使用
    //      階層変更時の処理を簡素化するために、このクラスで保持
    readonly name  : string;
    readonly image : HTMLImageElement;
    readonly bgm   : Bgm;
    
    // フィールド公開用ゲッター (readonly)
    getCells(): readonly (readonly Readonly<Cell>[])[] {return this.cells;}
    getEnemies(): readonly Readonly<Enemy>[] {return this.enemies;}
    getMappingRate(): number {return this.mappingRate;}
    getMappingPoints(): readonly Readonly<Point>[] {return this.mappingPoints;}


    /**
     * @param mapExcelData  エクセルで作成した階層データ
     * @param name          階層名
     * @param image         背景画像シート
     * @param bgm           BGM (ループ再生される)
     * @param enemyDesigns  敵の設計図リスト
     */
    constructor(
        mapExcelData : FloorExcelData,
        name         : string, 
        image        : HTMLImageElement,
        bgm          : Bgm,
        enemyDesigns : readonly EnemyDesign[]
    ) {
        // エクセルデータ → Cell[][]
        const cells =
            mapExcelData.map(
                line => line.map(
                    num => new Cell(num) ));

        // フィールド初期化
        this.name  = name;
        this.image = image;
        this.bgm   = bgm;
        this.cells = cells;

        
        for (let y=0; y<cells    .length; ++y) {
        for (let x=0; x<cells[y]!.length; ++x) {

            const cell = cells[y]?.[x];
            if (!cell) throw new IndexError2D(x, y);

            // 敵インスタンスを生成、リストへ追加
            if (cell.event == Event.ENEMY) {

                const design = enemyDesigns[cell.param];
                if (!design) throw new IndexError(cell.param);

                const enemy = design.generate(x, y);
                this.enemies.push(enemy);
            }

            // 通路数、マッピング数 をカウント
            if (cell.event != Event.WALL) {
                this.mappingMax++;
                if (cell.mapped) this.mappingCount++;
            }
        }}
    }

    //-------------------------------------------------------------------------
    // 配列内の要素を取得する
    //-------------------------------------------------------------------------

    /**
     * セルを取得 (セルがundefinedになる場合はエラー)
     */
    getCell(x: number, y: number): Readonly<Cell> {

        const cell = this.cells[y]?.[x];
        if (!cell) throw new IndexError2D(x, y);
        return cell;
    }

    /**
     * セルを取得 (内部用)
     *  セルがundefinedになる、またはeventが異なる 場合はエラー
     */
    private _getCell(x: number, y: number, event?: Event): Cell {

        const cell = this.cells[y]?.[x];
        if (!cell) throw new IndexError2D(x, y);

        if (event != undefined)
            cell.checkEvent(event);

        return cell;
    }

    //-------------------------------------------------------------------------
    // 敵の操作
    //-------------------------------------------------------------------------

    /**
     * 敵を移動
     * @param floorEnemyIndex   敵を指定 (this.enemies用インデックス)
     * @param x                 行先の座標X
     * @param y                 行先の座標Y
     */
    moveEnemy(floorEnemyIndex: number, x: number, y: number) {

        // 敵を取得
        const enemy = this.enemies[ floorEnemyIndex ];
        if (!enemy) throw new IndexError(floorEnemyIndex);

        // cells側
        const isMoving = !(enemy.x == x  &&  enemy.y == y);
        if (isMoving) {
            const from = this._getCell(enemy.x, enemy.y, Event.ENEMY);
            const to   = this._getCell(x, y, Event.NONE);
            from.event = Event.NONE;     // 消去
            to.event   = Event.ENEMY;    // 追加
            to.param   = from.param;     // 敵番号
        }

        // enemies側  (移動が無くても、敵の移動量を0にするために実行)
        enemy.setXy(x, y);
    }


    /**
     * 指定座標の敵を削除し、取得
     */
    deleteEnemy(x: number, y: number): Enemy {

        const enemies = this.enemies;

        // cells内から削除
        const cell = this._getCell(x, y, Event.ENEMY);
        cell.event = Event.NONE;

        // enemies内を検索し、削除
        for (let i=0; i<enemies.length; ++i) {
            const enemy = enemies[i];
            if (!enemy) throw new IndexError(i);

            if (enemy.x == x && enemy.y == y) {
                enemies.splice(i, 1);
                return enemy;
            }
        }
        throw new Error(`指定座標に敵は存在しません  x:${x}, y:${y}`);
    }
    
    //-------------------------------------------------------------------------
    // マッピング
    //-------------------------------------------------------------------------

    // 踏破率を取得 (0 ~ 100)
    // getMappingRate(): number {
    //     return Math.floor(this.mappingCount / this.mappingMax * 100);
    // }

    /**
     * 踏破率を更新
     * @returns 階層を踏破したか否か (既に踏破済みだった場合は false)
     */
    updateMappingRate(): boolean {

        // 既に100% → 処理を行わない
        if (this.mappingRate === 100)
            return false;

        // 踏破率を更新
        this.mappingRate = Math.floor(this.mappingCount / this.mappingMax * 100);
        const isCompleted = (this.mappingRate === 100);

        // 踏破 → 全セルを可視化
        if (isCompleted) this.mappingAll();
        return isCompleted;
    }


    /**
     * 全てのセルをマッピング
     */
    mappingAll() {
        const cells = this.cells;

        for (let y=0;  y < cells    .length;  ++y) {
        for (let x=0;  x < cells[y]!.length;  ++x) {
            this.mappingCell(x, y, true);
        }}
    }


    /**
     * 単セルをマッピング
     * @param x 
     * @param y 
     * @param stop    省略する (再帰用の変数)
     */
    mappingCell(x: number, y: number, stop = false) {
        
        const cell = this.cells[y]?.[x];
        if (!cell) return;

        if (!cell.mapped) {

            // マッピングし、リストに追加
            cell.mapped = true;
            this.mappingPoints.push(new Point(x, y));

            // 通行可  →  マッピングをカウント
            if (cell.event != Event.WALL) {
                this.mappingCount++;
                return;
            }
        }

        // 連続で再帰することを防ぐ
        if (stop) return;

        // 「上のセルも同時に可視化」処理
        if (cell.event == Event.WALL  &&
            cell.param == Wall.MAPPING_TOP)
            this.mappingCell(x, y-1, true);
    }


   /**
    * キャラの周囲をマッピング (歩行時のマッピング処理)
    * @param x キャラの座標X
    * @param y キャラの座標Y
    */
    mappingAround(x: number, y: number) {

        const up    = y - 1;
        const down  = y + 1;
        const left  = x - 1;
        const right = x + 1;

        this.mappingPoints = [];

        // 上下左右 (十字型)
        this.mappingCell(x    , up  );
        this.mappingCell(x    , down);
        this.mappingCell(left , y   );
        this.mappingCell(right, y   );

        // 8方向化 (難易度調整)
        this.mappingCell(left , up  );
        this.mappingCell(right, up  );
        this.mappingCell(left , down);
        this.mappingCell(right, down);
    }


    /**
     * [デバッグ] 1歩で階層クリアする状態へ (キャラが居るセル以外を全てマッピング)
     * @param x キャラ座標X
     * @param y キャラ座標Y
     */
    debugMappingAll(x: number, y: number) {

        if (this.mappingRate == 100) return;
        this.mappingAll();
        const cell = this._getCell(x, y);
        cell.mapped = false;
        this.mappingCount--;
        this.updateMappingRate();
    }
}

//=============================================================================
// Model 全階層のデータをまとめて管理、ダンジョンの処理
//=============================================================================

/**
 * キャラクターの状態を保持
 */
export class CharaStatus {
    readonly hpMax = 3;
    hp: number = this.hpMax;
    walkCount = 0;    // 歩数
    safeCount = 0;    // 敵を防いだ回数
}

/**
 * 歩行処理の結果 (DungeonScreen へを渡す)
 */
interface WalkingResult {
    isWall : boolean;               // 壁にぶつかったか否か
    event  : Event;                 // 移動先セルのイベント
    isFloorCompleted : boolean;     // 現階層で初めて踏破率100%になった時のみtrue
    isGameCompleted  : boolean;     // 全階層を踏破したか否か
}


/**
 * DungeonView へ公開する部分 (内部を変更できるメソッドを排除)
 */
interface ReadonlyDungeonModel {
    getChara(): Readonly<MainChara>;
    getItems(): readonly Readonly<Item>[];
    getCharaStatus(): Readonly<CharaStatus>;
}


export class DungeonModel implements ReadonlyDungeonModel
{
    // 現階層のデータ
    //      仮値で初期化 (コンパイルエラーを回避) しているが、
    //      コンストラクタ内でメソッドを呼び出し、正式に初期化している
    private floor = new Floor([[2000]], "", new Image(), new Bgm(""), []);
    private cell  = new Cell(2000);

    // クリアした階層数、HPなどのステータス
    private completeCount = 0;
    private readonly charaStatus = new CharaStatus();


    /**
     * @param chara                 メインキャラ
     * @param items                 アイテムリスト
     * @param enemyDesigns          敵設計図リスト
     * @param floors                階層データリスト
     * @param stairsDestinations    階段の行先リスト
     * @param initialCoordinate     メインキャラの初期座標
     */
    constructor(
        private readonly chara              : MainChara,
        private readonly items              : readonly Item[],
        private readonly floors             : readonly Floor[],
        private readonly stairsDestinations : readonly Coordinate[],
        initialCoordinate: Coordinate
    ) {
        this.changeFloor(...initialCoordinate);
    }

    // DungeonView へフィールドを渡すためのメソッド
    getFloor(): ReadonlyFloor {return this.floor;}
    getChara(): Readonly<MainChara> {return this.chara;}
    getItems(): readonly Readonly<Item>[] {return this.items;}
    getCharaStatus(): Readonly<CharaStatus> {return this.charaStatus;}

    
    /**
     * 階層を切り替え (キャラの初期位置設定、階段イベント で使用)
     */
    changeFloor(floorNum: number, x: number, y: number) {

        // 階層データを切り替え
        const floor = this.floors[ floorNum ];
        if (!floor) throw new IndexError(floorNum);
        this.floor = floor;

        // 移動先の整合性チェック
        const cell = floor.getCell(x, y);
        if (cell.event == Event.WALL)
            throw new Error("指定座標が壁のため、キャラを配置できません。");

        // キャラ座標 変更
        const chara = this.chara;
        chara.setXy(x, y);
        chara.direction = Direction.DOWN;

        // キャラの周囲を可視化
        floor.mappingAround(x, y);
        floor.mappingCell(x, y);
        floor.updateMappingRate();

        // [デバッグ] 1歩で階層クリア  (キャラ地点以外をマッピング済みにする)
        this.floor.debugMappingAll(chara.x, chara.y);
    }

    //-------------------------------------------------------------------------
    // 歩行
    //-------------------------------------------------------------------------

    /**
     * キャラ、敵 全ての歩行処理
     */
    walkAll(direction: Direction): Readonly<WalkingResult> {
        const floor = this.floor;

        // 戻り値を生成
        const result: WalkingResult = {
            isWall : false,
            event  : Event.NONE,
            isFloorCompleted : false,
            isGameCompleted  : false,
        }

        // キャラを移動
        result.isWall = this.walkChara(direction);
        if (result.isWall) return result;

        // すべての敵を移動
        floor.getEnemies().forEach( (enemy, index) => {
            const {x, y} = this.getEnemyDestination(enemy);
            floor.moveEnemy(index, x, y);
        });

        // 階層クリア判定
        result.isFloorCompleted = floor.updateMappingRate();

        // ゲームクリア判定
        if (result.isFloorCompleted) {
            this.completeCount++;
            result.isGameCompleted = (this.completeCount == this.floors.length);
        }

        // イベントは敵の移動後に取得
        result.event = this.cell.event;
        return result;
    }

    /**
     * メインキャラの歩行処理
     * @param   direction 入力された方向
     * @returns 壁にぶつかったか否か
     */
    walkChara(direction: Direction): boolean {

        // 向きを設定
        const {chara, floor} = this;
        chara.direction = direction;

        // 移動前の座標
        let x = chara.x;
        let y = chara.y;
        
        // 移動後の座標に変更
        if      (direction == Direction.UP   ) y += -1;
        else if (direction == Direction.DOWN ) y +=  1;
        else if (direction == Direction.LEFT ) x += -1;
        else if (direction == Direction.RIGHT) x +=  1;

        // 壁にぶつかるか否か
        const cell   = floor.getCell(x, y);
        const isWall = (cell.event == Event.WALL);
        
        // 壁以外 → キャラ移動 + マッピング
        if (!isWall) {
            chara.setXy(x, y);
            this.charaStatus.walkCount++;
            floor.mappingAround(x, y);
            this.cell = cell;
        }

        return isWall;
    }


    /**
     * 敵の移動先を決定
     */
    private getEnemyDestination(enemy: Readonly<Enemy>): Point {

        const {chara, floor}  = this;
        const {x, y} = enemy;

        // キャラと敵が同座標  →  移動しない
        if (x == chara.x  &&  y == chara.y) 
            return new Point(x, y);

        //-----------------------------------
        // 移動先の候補を作成
        //-----------------------------------

        const cells = floor.getCells();

        // 上下左右から、通行可能な座標のみに絞る
        const points = [
            new Point(x  ,  y-1),
            new Point(x  ,  y+1),
            new Point(x-1,  y  ),
            new Point(x+1,  y  ),

        ].filter( ({x, y}) => (cells[y]?.[x]?.event == Event.NONE) );

        // 候補なし → 移動しない
        if (points.length == 0)
            return new Point(x, y);

        //-----------------------------------
        // 候補の中から決定
        //-----------------------------------

        // 追跡の敵
        if (enemy.design.isChaser) {

            let minDistance = 1000;
            let minPoint = points[0]!;

            for (const point of points) {

                // 主人公と敵の相対距離
                const distance =
                    Math.abs( point.y - chara.y ) +
                    Math.abs( point.x - chara.x );
                
                // 最短距離の更新
                if (minDistance > distance) {
                    minDistance = distance;
                    minPoint    = point;
                }
            }
            return minPoint;
        }

        // ランダム移動の敵
        else {
            const i = Math.floor( Math.random() * points.length );
            const point = points[i];
            if (!point) throw new IndexError(i);
            return points[i]!;
        }
    }
    
    //-------------------------------------------------------------------------
    // 歩行後のセルイベント
    //-------------------------------------------------------------------------

    // 宝箱
    treasureEvent(): Readonly<Item> {

        // アイテムを取得
        const cell  = this.cell.checkEvent(Event.TREASURE);
        const index = cell.deleteEvent();
        const item  = this.items[index];
        if (!item) throw new IndexError(index);
        
        // 所持数を増やす
        item.quantity ++;
        return item;
    }

    // 階段
    stairsEvent() {

        // 移動先を取得
        const cell   = this.cell.checkEvent(Event.STAIRS);
        const index  = cell.param;
        const stairs = this.stairsDestinations[index];
        if (!stairs) throw new IndexError(index);

        // 座標を設定
        const [floorNum, x, y] = stairs;
        this.changeFloor(floorNum, x, y);
    }


    /**
     * 敵の遭遇処理
     * @returns 遭遇した敵
     */
    enemyEvent(): Readonly<Enemy> {

        // 遭遇した敵を削除
        const {x, y} = this.chara;
        const charaStatus = this.charaStatus;
        const enemy = this.floor.deleteEnemy(x, y);

        // 回避用アイテムを取得
        const index = enemy.design.dodgingItem;
        const item = this.items[index];
        if (!item) throw new IndexError(index);
        
        // 回避 → アイテムを消費
        if (item.quantity > 0) {
            item.quantity--;
            charaStatus.safeCount++;
            enemy.result = EnemyResult.DODGED;
        }
        
        // ダメージ → HP減少
        else {
            charaStatus.hp--;
            enemy.result = (charaStatus.hp == 0)
                ? EnemyResult.GAMEOVER
                : EnemyResult.CRASHED;
        }

        return enemy;
    }
}

//=============================================================================
// ダンジョンの描画、イベント演出
//=============================================================================

/**
 * DungeonViewクラスで使用するキャンバス
 */
export interface Contexts {
    readonly ui        : CanvasRenderingContext2D;   // ステータス、ボタン、テキスト、地図用
    readonly dark      : CanvasRenderingContext2D;   // 暗闇用
    readonly bg        : CanvasRenderingContext2D;   // キャラ、敵、背景用
    readonly preRender : CanvasRenderingContext2D;   // 背景 事前描画用
}

/**
 * DungeonViewクラスで使用する効果音
 */
export interface SoundEffects {
    readonly complete1 : HTMLAudioElement;   // 階層クリア
    readonly complete2 : HTMLAudioElement;   // ゲームクリア
    readonly stairs    : HTMLAudioElement;   // 階段移動
    readonly openBox   : HTMLAudioElement;   // 宝箱
    readonly useItem   : HTMLAudioElement;   // アイテムで敵を回避
    readonly crash     : HTMLAudioElement;   // 敵と衝突
    readonly select    : HTMLAudioElement;   // 選択音 (メッセージ表示)
    readonly wall      : HTMLAudioElement;   // 壁衝突音
    readonly gameover  : HTMLAudioElement;   // ゲームオーバー
    readonly encount   : HTMLAudioElement;   // 遭遇
}


export class DungeonView
{
    // ステータスバー、装備表示、メッセージウィンドウ、十字ボタン(描画用)
    private readonly rects = {
        status  : new Rect( 10,   5, 300,  35),
        items   : new Rect(200, 350, 108, 120),
        message : new Rect( 10, 295, 300,  50),
        up      : new Rect( 70, 290,  60,  60,   20, 20, "▲"),
        down    : new Rect( 70, 410,  60,  60,   20, 20, "▼"),
        left    : new Rect( 10, 350,  60,  60,   20, 20, "◀"),
        right   : new Rect(130, 350,  60,  60,   20, 20, "▶"),
    } as const;

    /**
     * @param model     ダンジョンの処理、データクラス
     * @param input     入力クラス
     * @param contexts  コンテキストのリスト
     * @param se        効果音のリスト
     */
    constructor(
        private readonly model    : ReadonlyDungeonModel,
        private          floor    : ReadonlyFloor,
        private readonly input    : Input,
        private readonly contexts : Contexts,
        private readonly se       : SoundEffects
    ) {}

    setFloor(floor: ReadonlyFloor) {this.floor = floor;}

    //-------------------------------------------------------------------------
    // 描画
    //-------------------------------------------------------------------------

    // 画面内 全て描画
    drawAll() {
        this.contexts.ui.clearRect(0, 0, CANVAS.W+1, CANVAS.H+1);
        this.drawDark();
        this.drawStatus();
        this.drawButton();
        this.drawFloor();
        this.drawMap();
    }


    /**
     * キャラ、敵、背景を描画 (背景はプリレンダが必要)
     * @param offset  歩行アニメーションの際にずらすpx数
     */
    drawFloor(offset: number = 0) {

        const chara = this.model.getChara();
        const enemies = this.floor.getEnemies();
        const {bg:contextBg, preRender:contextPre} = this.contexts;

        // 背景の取得座標
        //      = (A)背景キャンバスの余白幅 + キャラ座標 - (B)画面上のキャラ座標
        //      = キャラ座標 （A==B のため相殺した)

        // キャラ座標(背景上) = 移動後の位置 - 歩行アニメーション用補正
        const bg = chara.getXyOnBg(offset);
        // const bgX = chara.pxX - (chara.moveX * offset);
        // const bgY = chara.pxY - (chara.moveY * offset);

        // 画像取得、実画面へ描画
        const bgImage = contextPre.getImageData(bg.x, bg.y, CANVAS.W, CANVAS.H);
        contextBg.putImageData(bgImage, 0, 0);

        // 敵を描画
        for (const enemy of enemies) {

            // 背景上の敵座標 = 移動後の位置 - 歩行アニメーション用補正
            const enemyOnBg = enemy.getXyOnBg(offset);
            // const enemyX = enemy.pxX - (enemy.moveX * offset);
            // const enemyY = enemy.pxY - (enemy.moveY * offset);

            // 画面上の敵座標 = 背景キャンバスの余白幅 + 背景上の敵座標 - 背景の取得座標
            enemy.draw(
                contextBg,
                BG_CANVAS.LEFT_MARGIN + enemyOnBg.x - bg.x,
                BG_CANVAS.TOP_MARGIN  + enemyOnBg.y - bg.y
            );
        }

        // キャラを画面中央に描画
        chara.draw(contextBg);
    }


    // 地図を描画
    drawMap() {

        // 定数
        const CELL_PX = 3;                    // 1コマのサイズ
        const LENGTH  = 35;                   // マップ 縦・横のセル数
        const WIDTH   = LENGTH * CELL_PX;     // 描画幅 （縦・横）
        const LEFT    = 10;                   // マップを表示する 座標
        const TOP     = 50;

        const chara   = this.model.getChara();
        const cells   = this.floor.getCells();
        const context = this.contexts.ui;
        
        // マップクリア （移動前の敵を消す）
        context.clearRect(LEFT, TOP, WIDTH, WIDTH);

        // 全背景
        for (let y=0;  y<cells    .length;  ++y) {
        for (let x=0;  x<cells[y]!.length;  ++x) {

            // 現位置のデータ
            const cell = cells[y]?.[x];
            if (!cell) throw new IndexError2D(x, y);
            const {event, mapped} = cell;

            // 色を指定
            const color = 
                (event === Event.ENEMY   ) ? "red"         :   // 敵
                (mapped === false        ) ? null          :   // 不可視
                (event === Event.WALL    ) ? "dimgray"     :   // 壁
                (event === Event.NONE    ) ? "white"       :   // 通路
                (event === Event.STAIRS  ) ? "lightgreen"  :   // 階段（上下）
                (event === Event.TREASURE) ? "yellow"      :   // 宝箱
                null;

            // 不可視は描画しない
            if (color === null) continue;
            context.fillStyle = color;

            // 敵＆背景 ドット描画
            context.fillRect(
                LEFT + (CELL_PX * x),
                TOP  + (CELL_PX * y),
                CELL_PX, CELL_PX
            );
        }}

        // キャラの描画
        context.fillStyle = "deepskyblue";
        context.fillRect(
            LEFT + (CELL_PX * chara.x),
            TOP  + (CELL_PX * chara.y),
            CELL_PX, CELL_PX
        );
    }


    // ボタンを描画
    drawButton() {
        const rects = this.rects;
        rects.up   .draw();
        rects.down .draw();
        rects.left .draw();
        rects.right.draw();
    }


    // ステータスバー、装備一覧 を描画
    drawStatus() {

        const rects = this.rects;
        const model = this.model;
        const items = model.getItems();
        const {hpMax, hp, walkCount} = model.getCharaStatus();
        const floor = this.floor;
        const mappingRate = floor.getMappingRate();

        // ステータス
        const hpText = "●".repeat(hp) + "○".repeat(hpMax - hp);
        const status = `${floor.name}  ${mappingRate}％  ${walkCount}歩  HP${hpText}`;

        // 装備アイテム 一覧
        let equipment = "そうび\n";
        for (const {quantity, name} of items) {
            if (quantity > 0)
                equipment += `${quantity} ${name}\n`;
        }

        // 描画
        rects.status.draw(status);
        rects.items.draw(equipment);
    }

    
    /**
     * 暗闇キャンバスの描画
     *      階層未クリア   : 暗闇あり,
     *      階層クリア済み : 暗闇なし (暗闇が晴れる)
     */
    drawDark() {

        // 黒ベタの不透明度 (アルファ)、 ぼかしpx数
        const ALPHA = 0.7;
        const BLUR  = 8;

        // 画面を消去
        const context = this.contexts.dark;
        context.clearRect( 0, 0, CANVAS.W+1, CANVAS.H+1 );

        // 階層クリア済み → 暗闇なし
        const isCompleted = (this.floor.getMappingRate() == 100);
        if (isCompleted) return;

        // 黒塗りつぶし
        context.save();
        context.globalAlpha = ALPHA;
        context.fillStyle   = "black";
        context.fillRect( 0, 0, CANVAS.W, CANVAS.H );
        context.globalAlpha = 1;

        //----------------------
        // キャラ周りを明るくする
        //----------------------

        // 「描画で既存部分を削る」設定、ぼかし設定
        context.globalCompositeOperation = "destination-out";
        context.filter = `blur(${BLUR}px)`;

        // 円の描画
        const centerX = CANVAS.CHARA_X + (CELL_PX / 2);
        const centerY = CANVAS.CHARA_Y + (CELL_PX / 2);
        const radius  = CELL_PX * 1.5;
        context.beginPath();
        context.arc(centerX, centerY, radius, 0, Math.PI * 2);
        context.fill();
        context.restore();
    }


    // 階層切り替え画面を描画
    drawStairsScreen() {

        this.se.stairs.play();

        // 黒背景
        const context        = this.contexts.ui;  
        context.fillStyle    = "black";
        context.fillRect( 0, 0, CANVAS.W, CANVAS.H );
        
        // 文字表示
        const text           = this.floor.name;
        context.fillStyle    = "white";
        context.font         = "30px 'ＭＳ ゴシック'";
        context.textAlign    = "left";
        context.textBaseline = "top";
        context.fillText( text, CANVAS.W/3, CANVAS.H/2 );
    }


    // ダンジョン画面を描画 (階層切り替え画面の次の画面)
    drawDungeonScreen() {
        this.floor.bgm.play();
        this.preRenderAll();
    }

    //-------------------------------------------------------------------------
    // 歩行アニメーション
    //-------------------------------------------------------------------------

    /**
     * キャラ、敵、背景 をアニメーションする
     * @param nextFunction アニメ終了後に実行する処理
     */
    animateWalking(nextFunction: ()=>void) {

        const self = this;
        const chara = this.model.getChara();
        const floor = this.floor;
        const mappingPoints = floor.getMappingPoints();
        const ctxPre = this.contexts.preRender;

        // 歩行パターン を次のものに変更
        chara.nextPattern();
        for (const enemy of floor.getEnemies())
            enemy.nextPattern();

        // フレーム設定
        const FRAME_LENGTH  = 7;                        // アニメのフレーム数
        const INTERVAL      = 28;                       // アニメ間隔（ミリ秒）
        const FRAME_PX      = CELL_PX / FRAME_LENGTH;   // 1フレームの移動幅

        // フレームカウンタ (カウントダウン方式)
        let i = FRAME_LENGTH;

        // キャラを中心に 3*3セル の範囲 (背景描画用)
        const direction = chara.direction;
        const charaOnBg = chara.getXyOnBg();
        const x = BG_CANVAS.LEFT_MARGIN + charaOnBg.x - CELL_PX;
        const y = BG_CANVAS.TOP_MARGIN  + charaOnBg.y - CELL_PX;
        const w = CELL_PX * 3;
        const h = CELL_PX * 3;
        const isHorizontalMove =
            (direction == Direction.LEFT || direction == Direction.RIGHT);
        
        // アニメ処理
        drawFrame();                                        // 1フレーム目
        const bgAnimID = setInterval(drawFrame, INTERVAL);  // 2フレーム目以降

        function drawFrame() {
            i--;

            // 描画終了 → アニメ後の処理
            if (i == -1) {
                clearInterval(bgAnimID);
                nextFunction();
                return;
            }

            // 画像をずらすピクセル数
            //      キャラは移動後の座標のため、
            //      「描画位置 = 移動後座標 - ずらすpx」になる
            //      最終フレームで ズレは0px になる
            const offset = FRAME_PX * i;

            // 新しくマッピングされた背景の 描画範囲を限定 
            //      アニメに合わせて、描画範囲を広げていく
            //      最終フレームは限定せず、全て描画
            if (i != 0) {
                ctxPre.save();
                const path = new Path2D();
                path.rect(
                    ( isHorizontalMove) ? x + offset   : x,
                    (!isHorizontalMove) ? y + offset   : y,
                    ( isHorizontalMove) ? w - offset*2 : w,
                    (!isHorizontalMove) ? h - offset*2 : h
                );
                ctxPre.clip(path);
            }
            
            // 新しくマッピングした背景をプリレンダ
            for (const {x,y} of mappingPoints)
                self.preRenderCell(x, y);
            
            // 範囲の限定を解除
            ctxPre.restore();

            // 実キャンバスへ描画
            self.drawFloor(offset);
        }
    }

    //-------------------------------------------------------------------------
    // プリレンダ
    //-------------------------------------------------------------------------

    // 全体描画 (仮想キャンバス)
    preRenderAll() {

        // 不可視セルの色
        const INVISIBLE_CELL_COLOR = "black";    // #101010

        const context = this.contexts.preRender;
        const cells   = this.floor.getCells();

        // ベースの黒ベタ
        context.fillStyle = INVISIBLE_CELL_COLOR;
        context.fillRect(0, 0, BG_CANVAS.W +1, BG_CANVAS.H +1);

        // 背景の描画
        for (let y=0;  y < cells    .length;  ++y) {
        for (let x=0;  x < cells[y]!.length;  ++x) {
            this.preRenderCell(x, y);
        }}
    }


    // 1セル描画 (仮想キャンバス)
    preRenderCell(x: number, y: number) {

        const context = this.contexts.preRender;
        const floor   = this.floor;

        // 描画座標
        const left = BG_CANVAS.LEFT_MARGIN + (x * CELL_PX);
        const top  = BG_CANVAS.TOP_MARGIN  + (y * CELL_PX);
    
        // セルを取得
        const cell = floor.getCell(x, y);
        const {mapped, chipX, chipY} = cell;

        // マッピング済み → 背景描画
        if (mapped) {
            context.drawImage(
                floor.image,                        // 読込画像
                chipX, chipY, CELL_PX, CELL_PX,     // 画像座標
                left , top  , CELL_PX, CELL_PX      // キャンバス座標
            );
        }
    }

    //-------------------------------------------------------------------------
    // イベント演出
    //-------------------------------------------------------------------------

    /**
     * 「メッセージ表示・SE再生」処理を登録 
     *  (OnInputQueue.push のショートハンド)
     * @param onInputQueue  処理の登録先
     * @param text          表示するメッセージ
     * @param audio         再生するSE
     * @param delay         終了後、次の入力受付を開始するまでの時間 [ミリ秒]
     * @param bgmStop       再生中のBGMを停止する場合 true
     */
    private pushMessage(
        onInputQueue: OnInputQueue,
        text: string,
        audio: HTMLAudioElement | null = null,
        delay = 400, bgmStop = false
    ) {
        onInputQueue.push(() => {
            this.rects.message.draw(text, true);
            if (bgmStop) Bgm.stop();
            if (audio) audio.play();
        }, delay);
    }

    /**
     * 壁にぶつかる演出
     */
    wallEvent() {
        this.se.wall.play();
        this.drawFloor();
    }

    /**
     * 階層クリア演出
     */
    floorCompleteEvent(): Promise<void> {

        return new Promise<void>(resolve => {
            const {input, se, floor} = this;
            const queue = new OnInputQueue(input);

            // 暗闇を晴らす
            this.drawDark();

            // 演出をキューに追加
            const message = `${floor.name}の地図が完成した！`;
            this.pushMessage(queue, message, se.complete1, 1500);

            // クリックで次の処理へ
            queue.push(resolve);
            queue.run();
        });
    }

    /**
     * ゲームクリア演出
     */
    gameCompleteEvent(): Promise<void> {

        return new Promise<void>(resolve => {
            const {input, se} = this;
            const queue = new OnInputQueue(input);

            const message = "すべての階の地図が完成した！";
            this.pushMessage(queue, message, se.complete2, 3000, true);

            // クリックで次の処理へ
            queue.push(resolve);
            queue.run();
        });
    }

    /**
     * 宝箱演出
     * @param item 入手したアイテム
     */
    treasureEvent(item: Readonly<Item>): Promise<void> {

        return new Promise<void>(resolve => {
            const {se, input, model} = this;
            const queue = new OnInputQueue(input);

            this.pushMessage(queue, "宝箱を開けた！", se.openBox);
            this.pushMessage(queue, item.name + "を手に入れた！");
            this.pushMessage(queue, "ちゃんと装備した！");

            queue.push(()=> {
                const {x, y} = model.getChara();
                this.preRenderCell(x, y);    // 宝箱をBGで上書き
                resolve();
            });

            queue.run();
        });
    }

    
    /**
     * 敵との遭遇演出
     * @param enemy  遭遇した敵
     */
    enemyEvent(enemy: Readonly<Enemy>): Promise<void> {

        return new Promise<void>(resolve => {

            const result = enemy.result;
            const {encountText, dodgedText, damageText} = enemy.design;
            const {input, se} = this;
            const queue = new OnInputQueue(input);

            // 遭遇
            this.pushMessage(queue, encountText, se.encount);

            // 回避
            if (result == EnemyResult.DODGED)
                this.pushMessage(queue, dodgedText, se.useItem);

            // ダメージ
            else {
                queue.push( ()=>{
                    se.crash .play();

                    // ホワイトフラッシュ (暗闇キャンバスを使用)
                    const context = this.contexts.dark;
                    context.fillStyle = "white";
                    context.fillRect( 0, 0, CANVAS.W, CANVAS.H );

                    // 元の画面に戻してから、メッセージを表示
                    setTimeout( ()=>{
                        this.drawDark();
                        this.drawStatus();
                        this.rects.message.draw(damageText, true);
                    }, 120 );

                }, 850);
            }

            // ゲームオーバー
            if (result == EnemyResult.GAMEOVER) {
                this.pushMessage(queue, "体力が尽きてしまった！", se.gameover, 3000, true);
                this.pushMessage(queue, "-  ゲームオーバー  -", null, 1000);
            }

            // クリック待ち
            queue.push(resolve);
            queue.run();
        });
    }
}

//=============================================================================
// ダンジョン関連の統括 (Controller)
//=============================================================================

export class DungeonScreen
{
    /**
     * ダンジョンを全てクリアしたときの処理 (次の画面)
     * 外部から代入する
     */
    public nextFunction?: (result: Readonly<CharaStatus>)=>void;

    // 十字ボタンのクリック範囲 (視認性のため、描画とは別々に定義)
    private readonly triangles = {
        up    : new Triangle( new Point(100, 380), new Point( 10, 290), new Point(190, 290) ),
        down  : new Triangle( new Point(100, 380), new Point( 10, 470), new Point(190, 470) ),
        left  : new Triangle( new Point(100, 380), new Point( 10, 290), new Point( 10, 470) ),
        right : new Triangle( new Point(100, 380), new Point(190, 290), new Point(190, 470) ),
    } as const;

    /**
     * @param model ダンジョンの処理、データ
     * @param view  ダンジョンの演出
     * @param input 入力クラス
     */
    constructor(
        public  readonly model: Readonly<DungeonModel>,
        private readonly view : DungeonView,
        private readonly input: Readonly<Input>
    ) {
        // 階層データを、modelからviewへ送る
        const floor = model.getFloor();
        view.setFloor(floor);
    }
    

    /**
     * ダンジョン画面を表示する
     * (階層移動演出  →  ダンジョン画面+入力待機へ)
     */
    public show() {

        const view = this.view;
        view.drawStairsScreen();

        setTimeout(()=>{
            view.drawDungeonScreen();
            this.drawAndInputStandby();
        }, 1500);
    }


    // 入力待機へ移行
    private inputStandby() {
        this.input.standby( ()=>this.onInput() );
    }

    // 全て描画し、入力待機へ移行
    private drawAndInputStandby() {

        this.view.drawAll();
        this.inputStandby();
    }


    // 入力されたときの処理
    private async onInput() {

        const {model, view} = this;

        // 入力方向を取得
        const direction = this.getInputDirection();
        if (direction == null) {
            this.inputStandby();
            return;
        }

        //---------------------------------------
        // 歩行
        //---------------------------------------

        // キャラ、敵の歩行処理
        const {isWall, event, isFloorCompleted, isGameCompleted}
            = model.walkAll(direction);

        // 壁にぶつかる処理
        if (isWall) {
            view.wallEvent();
            this.inputStandby();
            return;
        }

        // 歩行アニメーション
        await new Promise<void>(resolve => view.animateWalking(resolve));

        // ステータスを更新
        view.drawStatus();
        view.drawMap();

        //---------------------------------------
        // クリアイベント
        //---------------------------------------

        // 階層クリア
        if (isFloorCompleted) {

            // 全背景を可視化
            view.preRenderAll();
            view.drawFloor();
            view.drawMap();

            await view.floorCompleteEvent();
            view.drawAll();

            // ゲームクリア  →  次の画面へ
            if (isGameCompleted) {

                // リザルトを取得
                await view.gameCompleteEvent();
                const charaStatus = this.model.getCharaStatus();

                if (!this.nextFunction) throw new Error("遷移先の画面が未設定です。");
                this.nextFunction(charaStatus);
                return;
            }
        }

        //---------------------------------------
        // 移動先イベント
        //---------------------------------------
        
        switch (event) {

            // 通路  →  連続歩行
            case Event.NONE:
                this.onInput();
                return;

            // 宝箱
            case Event.TREASURE:
                const item = model.treasureEvent();
                await view.treasureEvent(item);
                this.drawAndInputStandby();
                return;

            
            // 階段  →  階層移動
            case Event.STAIRS:
                model.stairsEvent();

                // 階層データをviewへ送る
                const floor = model.getFloor();
                view.setFloor(floor);

                setTimeout(()=>this.show(), 200);
                return;

            
            // 敵と遭遇
            case Event.ENEMY:
                const enemy = model.enemyEvent();
                await view.enemyEvent(enemy);
                
                // ゲームオーバー  →  ページリロード
                if (enemy.result == EnemyResult.GAMEOVER)
                    location.reload();
                    
                // ゲーム続行  →  ダンジョンの入力待ちへ
                else this.drawAndInputStandby();
                return;
        }
    }


    /**
     * 入力された方向を取得
     * @returns nullは無効な入力
     */
    private getInputDirection(): Direction | null {

        // キーが離された → 連続歩行を停止
        const {x, y, key} = this.input.getInputValue();
        if (!key) return null;

        const trais = this.triangles;

        // 入力された方向 を取得
        return ( 
            
            // キーボード入力
            (key == "ArrowUp"          ) ? Direction.UP    : 
            (key == "ArrowDown"        ) ? Direction.DOWN  :
            (key == "ArrowLeft"        ) ? Direction.LEFT  :
            (key == "ArrowRight"       ) ? Direction.RIGHT :

            // 方向ボタン
            (trais.up   .contains(x, y)) ? Direction.UP    :
            (trais.down .contains(x, y)) ? Direction.DOWN  :
            (trais.left .contains(x, y)) ? Direction.LEFT  :
            (trais.right.contains(x, y)) ? Direction.RIGHT :
            null
        );
    }
}
