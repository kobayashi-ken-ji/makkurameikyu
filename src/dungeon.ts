// ファイルの内容
//      データクラス
//          Cell  - 1マス
//          Floor - 1階層
// 
//      ダンジョン関連クラス (MVCモデル)
//          DungeonModel        - ロジック、データ保持
//          DungeonView         - 描画・演出、メディア保持
//          DungeonController   - 入力値を受取り、Model と View を連携させる

//=============================================================================
// インポート
//=============================================================================

// 定数
import {CELL_PX, CANVAS, BG_CANVAS, type Coordinate, type FloorExcelData}
from './constants.js';

// クラス
import {Rect, Bgm, Point, Triangle, Input, OnInputQueue} from './utility.js';

import {Direction, MainChara, EnemyDesign, Enemy,
    type ReadonlyWalker, type ReadonlyEnemy} from './character.js';

//=============================================================================
// 定数 (エクセルデータと共通)
//=============================================================================

/** セルのイベント (エクセルデータと共通) */
enum Event {
    NONE     = 1,    // 通路     敵は ここのみ通行可
    WALL     = 2,    // 壁       キャラは ここ以外を通行可
    STAIRS   = 3,    // 階段
    TREASURE = 4,    // 宝箱
    ENEMY    = 9,    // 通路に敵がいる
}

/** 壁の種類  (エクセルデータと共通) */
enum Wall {
    NORMAL      = 0,    // 通常
    MAPPING_TOP = 1,    // 上のセルも同時に可視化
};

//=============================================================================
// インデックスで配列から取得した時の undefined チェック用エラー
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
// アイテムデータ
//=============================================================================

export class Item
{
    /**
     * @param quantity 所持数
     * @param name     アイテム名
     */
    constructor(
        public quantity: number,
        public readonly name: string
    ) {}
}

//=============================================================================
// セルデータ
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

        // 入力値チェック
        if (!(1000 <= excelData  &&  excelData <= 9999))
            throw new Error(`引数${excelData}は4桁ではありません。`);

        // エクセルデータを桁ごとに分解
        //      例: 1234  →  ["1", "2", "3", "4"]
        const arr: string[] = excelData.toString().split("");

        // フィールドに代入
        this.event  = Number(arr[0]);
        this.param  = Number(arr[1]);
        this.chipX  = Number(arr[2]) * CELL_PX;     // セル座標 → ピクセル座標
        this.chipY  = Number(arr[3]) * CELL_PX;
        this.mapped = false;
    }


    /** 通路の画像チップ (宝箱を削除するときに使用) */
    static readonly ROAD_CHIP = {X: 0,   Y: 5 * CELL_PX} as const;
}


//=============================================================================
// データ転送用インターフェース
//      Model, View, Controller 間の転送に利用される
//=============================================================================

/** 
 * 歩行処理の戻り値
 *      Model → Controller
 */
interface WalkingResult {
    readonly event            : Event;       // 移動先セルのイベント
    readonly isFloorCompleted : boolean;     // 現階層で初めて踏破率100%になった時のみtrue
    readonly isGameCompleted  : boolean;     // 全階層を踏破したか否か
}

/** 
 * 敵イベント処理の戻り値
 *      Model → Controller → View
 */
interface EnemyResult {
    readonly enemyDesign : EnemyDesign;  // 敵の設計図
    readonly isDodged    : boolean;      // 回避したか
    readonly isGameOver  : boolean;      // キャラのHPが0
}


/** 
 * キャラクターの状態
 *      Model のフィールド (公開時はReadonly化)
 *      Model → View
 *      Model → Controller → ゲームクリア画面
 */
export interface CharaStatus {
    readonly hpMax : number;    // 最大HP
    hp             : number;    // 現在のHP
    walkingCount   : number;    // 歩数
    dodgedCount    : number;    // 敵を防いだ回数
}


/**
 * Floor をReadonly化
 *      Model のフィールド
 *      Model → View
 */
interface ReadonlyFloor {
    readonly cells          : readonly (readonly Readonly<Cell>[])[];
    readonly enemies        : readonly ReadonlyEnemy[];
    readonly mappingRate    : number;
    readonly mappingPoints  : readonly Readonly<Point>[];
}


/**
 * Model をReadonly化
 *      Model自身 → View
 */
interface ReadonlyDungeonModel {
    readonly chara       : ReadonlyWalker;
    readonly charaStatus : Readonly<CharaStatus>;
    readonly items       : readonly Readonly<Item>[];
    readonly floor       : ReadonlyFloor;
    readonly floorIndex  : number;
}

//=============================================================================
// 階層 クラス
//      ・階層１つ分のデータ
//      ・整合性を維持するための操作メソッド
//=============================================================================

export class Floor implements ReadonlyFloor
{
    // マップデータ(セルの二次元配列)、階層内の敵リスト
    private readonly _cells : readonly(readonly Cell[])[];
    private readonly _enemies : Enemy[] = [];

    // マッピング率関連
    private mappingMax    = 0;              // 通行できるセルの数
    private mappingCount  = 0;              // マッピング数 (通行できるセルのみ)
    private _mappingPoints: Point[] = [];   // 歩行時にマッピングした座標 の配列

    // Readonly<>化して公開
    get enemies(): readonly ReadonlyEnemy[] {return this._enemies;}
    get cells(): readonly (readonly Readonly<Cell>[])[] {return this._cells;}
    get mappingPoints(): readonly Readonly<Point>[] {return this._mappingPoints;}

    // 踏破率 (取得時に計算)
    get mappingRate(): number {
        return Math.floor(this.mappingCount / this.mappingMax * 100);
    }


    /**
     * @param mapExcelData エクセルで作成した階層データ
     * @param enemyDesigns 敵の設計図リスト
     */
    constructor(mapExcelData: FloorExcelData, enemyDesigns: readonly EnemyDesign[]) {

        // エクセルデータから、セルデータに変換
        const cells = this._cells =
            mapExcelData.map(
                line => line.map(
                    num => new Cell(num) ));
        
        // 全セルを調査
        for (let y=0; y<cells    .length; ++y) {
        for (let x=0; x<cells[y]!.length; ++x) {

            const cell = cells[y]?.[x];
            if (!cell) throw new IndexError2D(x, y);

            // 敵インスタンスを生成、リストへ追加
            if (cell.event == Event.ENEMY) {

                const design = enemyDesigns[cell.param];
                if (!design) throw new IndexError(cell.param);

                const enemy = design.generate(x, y);
                this._enemies.push(enemy);
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
     * セルを取得、取得できない場合はエラー
     * @param event この指定とセルイベントが異なる場合は、エラーを発生させる
     */
    getCell(x: number, y: number, event?: Event): Readonly<Cell> {
        return this._getCell(x, y, event);
    }


    /** [内部用] セルを取得 */
    private _getCell(x: number, y: number, event?: Event): Cell {

        const cell = this._cells[y]?.[x];
        if (!cell) throw new IndexError2D(x, y);

        if (event != undefined  &&  event != cell.event)
            throw new Error(`想定されているeventと異なります。 event:${cell.event}`);

        return cell;
    }

    //-------------------------------------------------------------------------
    // イベントの処理
    //-------------------------------------------------------------------------

    /** 宝箱を通路化し、アイテム番号を取得 */
    openTreasure(x: number, y: number): number {
        const cell = this._getCell(x, y, Event.TREASURE);

        cell.event = Event.NONE;
        cell.chipX = Cell.ROAD_CHIP.X;
        cell.chipY = Cell.ROAD_CHIP.Y;

        return cell.param;
    }

    /** 階段の行先リストのインデックスを取得 */
    getStairsParam(x: number, y: number): number {
        const cell = this._getCell(x, y, Event.STAIRS);
        return cell.param;
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
        const enemy = this._enemies[ floorEnemyIndex ];
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


    /** 指定座標の敵を削除し、取得 */
    deleteEnemy(x: number, y: number): Enemy {
        const enemies = this._enemies;

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

    /** 全てのセルをマッピング */
    mappingAll() {
        const cells = this._cells;

        for (let y=0;  y < cells    .length;  ++y) {
        for (let x=0;  x < cells[y]!.length;  ++x) {
            this.mappingCell(x, y, true);
        }}
    }


    /**
     * 単セルをマッピング
     * マップの範囲外を指定した場合は、処理は行われない (エラーも発生しない)
     * @param x 
     * @param y 
     * @param stop    省略する (再帰用の変数)
     */
    mappingCell(x: number, y: number, stop = false) {
        
        // セルを取得
        const cell = this._cells[y]?.[x];
        if (!cell) return;

        if (!cell.mapped) {

            // マッピングし、リストに追加
            cell.mapped = true;
            this._mappingPoints.push(new Point(x, y));

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

        this._mappingPoints = [];

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
    }
}

//=============================================================================
// ダンジョンModel
//      ・全階層のデータをまとめて管理
//      ・ダンジョンのロジック
//=============================================================================

export class DungeonModel implements ReadonlyDungeonModel
{
    // 現階層のデータ
    //  コンストラクタ内で changeFloor() を呼び出し、初期化している
    private _floorIndex !: number;
    private _floor      !: Floor;

    // クリアした階層数、HPなどのステータス
    private completeCount = 0;
    private readonly _charaStatus: CharaStatus = {
        hpMax        : 3,
        hp           : 3,
        walkingCount : 0,
        dodgedCount  : 0,
    };

    /**
     * @param _chara                メインキャラ
     * @param _items                アイテムリスト
     * @param floors                階層データリスト
     * @param stairsDestinations    階段の行先リスト
     * @param initialCoordinate     メインキャラの初期座標
     */
    constructor(
        private readonly _chara             : MainChara,
        private readonly _items             : readonly Item[],
        private readonly floors             : readonly Floor[],
        private readonly stairsDestinations : readonly Coordinate[],
        initialCoordinate: Coordinate
    ) {
        this.changeFloor(...initialCoordinate);
    }

    // 公開するフィールド
    //  DungeonView から参照される
    get floor(): ReadonlyFloor {return this._floor;}
    get chara(): ReadonlyWalker {return this._chara;}
    get items(): readonly Readonly<Item>[] {return this._items;}
    get charaStatus(): Readonly<CharaStatus> {return this._charaStatus;}
    get floorIndex(): number {return this._floorIndex;}

    
    /**
     * 階層を切り替え
     *  コンストラクタ、階段イベント で使用
     */
    changeFloor(floorIndex: number, x: number, y: number) {

        // 階層データを切り替え
        const floor = this.floors[ floorIndex ];
        if (!floor) throw new IndexError(floorIndex);
        this._floorIndex = floorIndex;
        this._floor = floor;

        // 移動先の整合性チェック
        const cell = floor.getCell(x, y);
        if (cell.event == Event.WALL)
            throw new Error("指定座標が壁のため、キャラを配置できません。");

        // キャラ座標 変更
        const chara = this._chara;
        chara.setXy(x, y);
        chara.direction = Direction.DOWN;

        // キャラの周囲をマッピング
        floor.mappingAround(x, y);
        floor.mappingCell(x, y);

        // [デバッグ] 1歩で階層クリア  (キャラ地点以外をマッピング済みにする)
        // this._floor.debugMappingAll(chara.x, chara.y);
    }

    //-------------------------------------------------------------------------
    // 歩行
    //-------------------------------------------------------------------------

    /** 歩行処理 (キャラ + すべての敵) */
    walkAll(direction: Direction): WalkingResult {

        const floor = this._floor;

        // 戻り値を生成
        let event            = Event.WALL;
        let isFloorCompleted = false;
        let isGameCompleted  = false;

        // キャラを移動
        const beforeMapRate = floor.mappingRate;
        const cell = this.walkChara(direction);

        // 壁にぶつかる → 敵は移動しない
        if (cell.event == Event.WALL)
            return {event, isFloorCompleted, isGameCompleted};

        // すべての敵を移動
        floor.enemies.forEach( (enemy, index) => {
            const {x, y} = this.getEnemyDestination(enemy);
            floor.moveEnemy(index, x, y);
        });

        // 階層クリア判定
        const afterMapRate = floor.mappingRate;
        isFloorCompleted = (beforeMapRate != 100  &&  afterMapRate == 100);

        // クリア → 全てをマッピング(可視化)
        if (isFloorCompleted) {
            floor.mappingAll();

            // ゲームクリア判定
            this.completeCount++;
            isGameCompleted = (this.completeCount == this.floors.length);
        }

        // イベントは敵の移動後に取得
        event = cell.event;
        return {event, isFloorCompleted, isGameCompleted};
    }


    /**
     * メインキャラの歩行処理
     * @param   direction 入力された方向
     * @returns 壁にぶつかったか否か
     */
    private walkChara(direction: Direction): Cell {

        // 向きを設定
        const {_chara, _floor, _charaStatus} = this;
        _chara.direction = direction;

        // 移動前の座標
        let x = _chara.x;
        let y = _chara.y;
        
        // 移動後の座標に変更
        if      (direction == Direction.UP   ) y += -1;
        else if (direction == Direction.DOWN ) y +=  1;
        else if (direction == Direction.LEFT ) x += -1;
        else if (direction == Direction.RIGHT) x +=  1;

        const cell = _floor.getCell(x, y);
        
        // 壁以外 → キャラ移動 + マッピング
        if (cell.event != Event.WALL) {
            _chara.setXy(x, y);
            _charaStatus.walkingCount++;
            _floor.mappingAround(x, y);
        }

        return cell;
    }


    /**
     * 敵の移動先を決定
     */
    private getEnemyDestination(enemy: ReadonlyEnemy): Point {

        const {_chara, _floor}  = this;
        const {x, y} = enemy;
        const cells = _floor.cells;

        // キャラと敵が同座標  →  移動しない
        if (x == _chara.x  &&  y == _chara.y) 
            return new Point(x, y);

        //-----------------------------------
        // 移動先の候補を作成
        //-----------------------------------

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
                    Math.abs( point.y - _chara.y ) +
                    Math.abs( point.x - _chara.x );
                
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
            const index = Math.floor( Math.random() * points.length );
            const point = points[index];
            if (!point) throw new IndexError(index);
            return point;
        }
    }
    
    //-------------------------------------------------------------------------
    // 歩行後のセルイベント
    //-------------------------------------------------------------------------

    /** 宝箱イベント */
    treasureEvent(): Readonly<Item> {
        const {_chara, _floor, _items} = this;

        // アイテムを取得
        const index = _floor.openTreasure(_chara.x, _chara.y);
        const item  = _items[index];
        if (!item) throw new IndexError(index);
        
        // 所持数を増やす
        item.quantity ++;
        return item;
    }

    /**
     * 階段イベント
     * @returns 階層番号
     */
    stairsEvent() {
        const {_chara, _floor, stairsDestinations} = this;

        // 移動先を取得
        const index  = _floor.getStairsParam(_chara.x, _chara.y);
        const stairs = stairsDestinations[index];
        if (!stairs) throw new IndexError(index);

        // 座標を設定
        const [floorIndex, x, y] = stairs;
        this.changeFloor(floorIndex, x, y);
        return;
    }


    /**
     * 敵イベント
     * @returns 遭遇した敵
     */
    enemyEvent(): EnemyResult {
        const {_chara, _charaStatus, _floor, _items} = this;

        // 遭遇した敵を削除
        const enemy = _floor.deleteEnemy(_chara.x, _chara.y);
        
        // 結果を格納
        const enemyDesign = enemy.design;
        let isDodged      = false;
        let isGameOver    = false;

        // 回避用アイテムを取得
        const index = enemy.design.dodgingItem;
        const item  = _items[index];
        if (!item) throw new IndexError(index);
        
        // 回避 → アイテムを消費
        if (item.quantity >= 1) {
            item.quantity--;
            _charaStatus.dodgedCount++;
            isDodged = true;
        }
        
        // ダメージ → HP減少
        else {
            _charaStatus.hp--;
            isGameOver = (_charaStatus.hp == 0)
        }

        return {enemyDesign, isDodged, isGameOver};
    }
}

//=============================================================================
// View のコンストラクタ引数用 クラス/インターフェース
//=============================================================================

/**
 * 階層1つ分の 演出用データ
 * DungeonView 内で使用
 */
export class FloorMedia {
    /**
     * @param name  階層名 ステータスバーに表示される
     * @param image 画像シート
     * @param bgm   BGM
     */
    constructor(
        readonly name  : string,
        readonly image : HTMLImageElement,
        readonly bgm   : Bgm,
    ) {}
}


/** DungeonView で使用するキャンバス */
export interface Contexts {
    readonly ui        : CanvasRenderingContext2D;   // ステータス、ボタン、テキスト、地図用
    readonly dark      : CanvasRenderingContext2D;   // 暗闇用
    readonly bg        : CanvasRenderingContext2D;   // キャラ、敵、背景用
    readonly preRender : CanvasRenderingContext2D;   // 背景 事前描画用
}


/** DungeonView で使用する効果音 */
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

//=============================================================================
// ダンジョンView 
//      ・画像、音声データの保持
//      ・画面描画、イベント演出、アニメーション を行うメソッド
//=============================================================================

export class DungeonView
{
    /** 描画範囲 (ステータスバー、装備表示、メッセージウィンドウ、十字ボタン) */
    private readonly rects = {
        status  : new Rect( 10,   5, 300,  35),
        items   : new Rect(200, 350, 108, 120),
        message : new Rect( 10, 295, 300,  50),
        up      : new Rect( 70, 290,  60,  60,   20, 20, "▲"),
        down    : new Rect( 70, 410,  60,  60,   20, 20, "▼"),
        left    : new Rect( 10, 350,  60,  60,   20, 20, "◀"),
        right   : new Rect(130, 350,  60,  60,   20, 20, "▶"),
    } as const;

    /** 現在の階層の画像、BGM */
    //  コンストラクタ内で changeFloorMedia() を呼出し、初期化している
    private floorMedia!: FloorMedia;

    /**
     * @param model     ダンジョンの処理、データクラス
     * @param input     入力クラス
     * @param contexts  コンテキストのリスト
     * @param se        効果音のリスト
     */
    constructor(
        private readonly model       : ReadonlyDungeonModel,
        private readonly floorMedias : readonly FloorMedia[],
        private readonly input       : Input,
        private readonly contexts    : Contexts,
        private readonly se          : SoundEffects,
    ) {
        this.changeFloorMedia();
    }

    /** Modelから現在の階層を取得、その階層のメディアに切替え */
    changeFloorMedia() {
        const index = this.model.floorIndex;
        const media = this.floorMedias[index];
        if (!media) throw new IndexError(index);
        this.floorMedia = media;
    }

    //-------------------------------------------------------------------------
    // 描画
    //-------------------------------------------------------------------------

    /** ダンジョン画面内の全て描画 */
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

        const {chara, floor} = this.model;
        const {bg:contextBg, preRender:contextPre} = this.contexts;

        // 背景の取得座標
        //      = (A)背景キャンバスの余白幅 + 背景上のキャラ座標 - (B)画面上のキャラ座標
        //      = 背景上のキャラ座標 （A==B のため相殺した)
        const bg = chara.getXyOnBg(offset);

        // 画像取得、実画面へ描画
        const bgImage = contextPre.getImageData(bg.x, bg.y, CANVAS.W, CANVAS.H);
        contextBg.putImageData(bgImage, 0, 0);

        // 敵を描画
        for (const enemy of floor.enemies) {

            // 画面上の敵座標 = 背景キャンバスの余白幅 + 背景上の敵座標 - 背景の取得座標
            const enemyOnBg = enemy.getXyOnBg(offset);
            const onScreenX = BG_CANVAS.LEFT_MARGIN + enemyOnBg.x - bg.x;
            const onScreenY = BG_CANVAS.TOP_MARGIN  + enemyOnBg.y - bg.y;
            enemy.draw(contextBg, onScreenX, onScreenY);
        }

        // キャラを画面中央に描画
        chara.draw(contextBg);
    }


    /** ミニマップを描画 */
    drawMap() {

        // 定数
        const CELL_PX = 3;                    // 1コマのサイズ
        const LENGTH  = 35;                   // マップ 縦・横のセル数
        const WIDTH   = LENGTH * CELL_PX;     // 描画幅 （縦・横）
        const LEFT    = 10;                   // マップを表示する 座標
        const TOP     = 50;

        const {chara, floor} = this.model;
        const cells   = floor.cells;
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
                (event === Event.ENEMY   ) ? "red"        : // 敵は必ず表示
                (mapped === false        ) ? null         : // 未マッピングは非表示
                (event === Event.WALL    ) ? "dimgray"    :
                (event === Event.NONE    ) ? "white"      :
                (event === Event.STAIRS  ) ? "lightgreen" :
                (event === Event.TREASURE) ? "yellow"     :
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


    /** 方向ボタンを描画 */
    drawButton() {
        const rects = this.rects;
        rects.up   .draw();
        rects.down .draw();
        rects.left .draw();
        rects.right.draw();
    }


    /** ステータスバー、装備一覧 を描画 */
    drawStatus() {

        const rects = this.rects;
        const {items, charaStatus, floor} = this.model;
        const {hpMax, hp, walkingCount} = charaStatus;
        const {mappingRate} = floor;
        const floorName = this.floorMedia.name;

        // ステータス
        const hpText = "●".repeat(hp) + "○".repeat(hpMax - hp);
        const status = `${floorName}  ${mappingRate}％  ${walkingCount}歩  HP${hpText}`;

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
     *  階層をクリアすると、闇が晴れる
     */
    drawDark() {

        // 黒ベタの不透明度 (アルファ)、 ぼかしpx数
        const ALPHA = 0.7;
        const BLUR  = 8;

        // 画面を消去
        const context = this.contexts.dark;
        context.clearRect( 0, 0, CANVAS.W+1, CANVAS.H+1 );

        // 階層クリア済み → 暗闇なし
        const isCompleted = (this.model.floor.mappingRate == 100);
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


    /** 階層切り替え画面を描画 */
    floorChangeScreen() {
        this.se.stairs.play();

        // 黒背景
        const context        = this.contexts.ui;  
        context.fillStyle    = "black";
        context.fillRect( 0, 0, CANVAS.W, CANVAS.H );
        
        // 文字表示
        const text           = this.floorMedia.name;
        context.fillStyle    = "white";
        context.font         = "30px 'ＭＳ ゴシック'";
        context.textAlign    = "left";
        context.textBaseline = "top";
        context.fillText( text, CANVAS.W/3, CANVAS.H/2 );
    }


    /** ダンジョン画面を描画 (階層切り替え画面の次の画面) */
    drawDungeonScreen() {
        this.floorMedia.bgm.play();
        this.preRenderAll();
        this.drawAll();
    }

    //-------------------------------------------------------------------------
    // 歩行アニメーション
    //-------------------------------------------------------------------------

    /**
     * キャラ、敵、背景 をアニメーションする
     * @param nextFunction アニメ終了後に実行する処理
     */
    walkingAnimation(nextFunction: ()=>void) {

        const self = this;
        const {chara, floor} = this.model;
        const {mappingPoints, enemies} = floor;
        const ctxPre = this.contexts.preRender;

        // 歩行パターン を次のものに変更
        chara.nextWalkingPattern();
        for (const enemy of enemies)
            enemy.nextWalkingPattern();

        // フレーム設定
        const FRAME_LENGTH  = 7;                        // アニメのフレーム数
        const INTERVAL      = 28;                       // アニメ間隔（ミリ秒）
        const FRAME_PX      = CELL_PX / FRAME_LENGTH;   // 1フレームの移動幅

        // フレームカウンタ (カウントダウン方式)
        let i = FRAME_LENGTH;

        //-----------------------------------
        // 歩行時にマッピングしたセルを
        // アニメーションで可視化するための変数
        //-----------------------------------

        // キャラを中心に 3*3セル の範囲
        const charaOnBg = chara.getXyOnBg();
        const x = BG_CANVAS.LEFT_MARGIN + charaOnBg.x - CELL_PX;
        const y = BG_CANVAS.TOP_MARGIN  + charaOnBg.y - CELL_PX;
        const w = CELL_PX * 3;
        const h = CELL_PX * 3;

        // 水平方向への移動か否か
        const direction = chara.direction;
        const isHorizontalMove =
            (direction == Direction.LEFT || direction == Direction.RIGHT);
        
        //-----------------------------------
        // アニメ処理
        //-----------------------------------

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
            //      描画位置 = 移動後座標 - ずらすpx
            //      最終フレームで ズレは0px になる
            const offset = FRAME_PX * i;

            // 新しくマッピングされた背景の 描画範囲を限定 
            //      アニメに合わせて、描画範囲を広げていく
            //      最終フレームは限定せずに、全て描画
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

    /** 背景全体を描画 (仮想キャンバス) */
    preRenderAll() {
        const context = this.contexts.preRender;
        const cells   = this.model.floor.cells;

        // ベースの黒ベタ (不可視部分の色)
        context.fillStyle = "black";
        context.fillRect(0, 0, BG_CANVAS.W +1, BG_CANVAS.H +1);

        // 全セルの描画
        for (let y=0;  y < cells    .length;  ++y) {
        for (let x=0;  x < cells[y]!.length;  ++x) {
            this.preRenderCell(x, y);
        }}
    }


    /** 1セル描画 (仮想キャンバス) */
    preRenderCell(x: number, y: number) {
        const {floorMedia, contexts, model} = this;

        // セルを取得
        const cell = model.floor.cells[y]?.[x];
        if (!cell) throw new IndexError2D(x, y);
        const {mapped, chipX, chipY} = cell;
        if (!mapped) return;

        // 描画座標
        const left = BG_CANVAS.LEFT_MARGIN + (x * CELL_PX);
        const top  = BG_CANVAS.TOP_MARGIN  + (y * CELL_PX);

        // 背景描画
        contexts.preRender.drawImage(
            floorMedia.image,                   // 読込画像
            chipX, chipY, CELL_PX, CELL_PX,     // 画像座標
            left , top  , CELL_PX, CELL_PX      // キャンバス座標
        );
    }

    //-------------------------------------------------------------------------
    // イベント演出
    //-------------------------------------------------------------------------

    /**
     * 「メッセージ表示・SE再生」処理を登録  (OnInputQueue.push のショートハンド)
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


    /** 壁にぶつかる演出 */
    wallEvent() {
        this.se.wall.play();
        this.drawFloor();
    }

    /** 階層クリア演出 */
    floorCompleteEvent(): Promise<void> {

        return new Promise<void>(resolve => {
            const {input, se, floorMedia} = this;
            const queue = new OnInputQueue(input);

            // 暗闇を晴らす
            this.drawDark();

            // 演出をキューに追加
            const message = `${floorMedia.name}の地図が完成した！`;
            this.pushMessage(queue, message, se.complete1, 1500);

            // クリックで次の処理へ
            queue.push(resolve);
            queue.run();
        });
    }

    
    /** ゲームクリア演出 */
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
                const {x, y} = model.chara;
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
    enemyEvent(result: EnemyResult): Promise<void> {

        return new Promise<void>(resolve => {

            const {encountText, dodgedText, damageText} = result.enemyDesign;
            const {input, se} = this;
            const queue = new OnInputQueue(input);

            // 遭遇
            this.pushMessage(queue, encountText, se.encount);

            // 回避
            if (result.isDodged)
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
            if (result.isGameOver) {
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
// ダンジョンController
//      ・ダンジョン関連の統括
//      ・Input から入力値を受取り、Model と View を連携させる
//=============================================================================

export class DungeonController
{
    /**
     * ダンジョンを全てクリアしたときの処理 (次の画面)
     * 外部から代入する
     */
    public nextFunction?: (result: Readonly<CharaStatus>)=>void;

    /** 十字ボタンのクリック範囲 (操作性向上のため、描画範囲とは別に定義) */
    private readonly triangles = {
        up    : new Triangle( new Point(100, 380), new Point( 10, 290), new Point(190, 290) ),
        down  : new Triangle( new Point(100, 380), new Point( 10, 470), new Point(190, 470) ),
        left  : new Triangle( new Point(100, 380), new Point( 10, 290), new Point( 10, 470) ),
        right : new Triangle( new Point(100, 380), new Point(190, 290), new Point(190, 470) ),
    } as const;


    /**
     * @param model データ、ロジッククラス
     * @param view  描画、演出クラス
     * @param input 入力クラス
     */
    constructor(
        public  readonly model: Readonly<DungeonModel>,
        private readonly view : DungeonView,
        private readonly input: Readonly<Input>,
    ) {
        // 階層を同期
        view.changeFloorMedia();
    }
    

    /**
     * ダンジョン画面を表示する
     * (階層移動演出  →  ダンジョン画面+入力待機へ)
     */
    public show() {
        const view = this.view;
        view.floorChangeScreen();

        setTimeout(()=>{
            view.drawDungeonScreen();
            this.inputStandby();
        }, 1500);
    }


    /** 入力待機へ移行 */
    private inputStandby() {
        this.input.standby( ()=>this.onInput() );
    }

    /** 全て描画し、入力待機へ移行 */
    private drawAndInputStandby() {

        this.view.drawAll();
        this.inputStandby();
    }


    /** 入力されたときの処理  */
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
        const result = model.walkAll(direction);
        const {event, isFloorCompleted, isGameCompleted} = result;

        // 壁にぶつかる処理
        if (event == Event.WALL) {
            view.wallEvent();
            this.inputStandby();
            return;
        }

        // 歩行アニメーション
        await new Promise<void>(resolve => view.walkingAnimation(resolve));

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
        }

        // ゲームクリア  →  次の画面へ
        if (isGameCompleted) {
            await view.gameCompleteEvent();
            if (!this.nextFunction) throw new Error("遷移先の画面が未設定です。");
            this.nextFunction(model.charaStatus);
            return;
        }

        //---------------------------------------
        // 移動先イベント
        //---------------------------------------
        
        switch (event) {

            // 通路  →  連続歩行
            case Event.NONE:
                this.onInput();
                return;

            // 宝箱  →  開ける
            case Event.TREASURE:
                const item = model.treasureEvent();
                await view.treasureEvent(item);
                this.drawAndInputStandby();
                return;

            
            // 階段  →  階層移動
            case Event.STAIRS:
                model.stairsEvent();
                view.changeFloorMedia();
                setTimeout(()=>this.show(), 200);
                return;

            
            // 敵と遭遇
            case Event.ENEMY:
                const result = model.enemyEvent();
                await view.enemyEvent(result);
                
                // ゲームオーバー  →  ページリロード
                if (result.isGameOver)
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
