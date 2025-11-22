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
    CELL_PX, CANVAS, BG_CANVAS, DIRECTION, type Stairs, type Contexts, type Se
} from './constants.js';

// クラス
import {Rect, Bgm, Point, Triangle, Input} from './utility.js';
import {Item, MainChara, EnemyDesign, Enemy, ENEMY_RESULT} from './character.js';

//=============================================================================
// 定数 (エクセルデータと共通)
//=============================================================================

// 不可視セルの色
const INVISIBLE_CELL_COLOR = "black";    // #101010

/**
 * セルのイベント
 */
enum EVENT {
    NONE   = 1,    // 通路     敵は ここのみ通行可
    WALL   = 2,    // 壁       キャラは ここ以外を通行可
    STAIRS = 3,    // 階段
    BOX    = 4,    // 宝箱
    ENEMY  = 9,    // 通路に敵がいる
}

/**
 * 壁の種類
 */
enum WALL {
    NORMAL      = 0,    // 通常
    MAPPING_TOP = 1,    // 上のセルも同時に可視化
};

//=============================================================================
// 自作エラー
//=============================================================================

/**
 * Floor.cells[y][x] を取得できなかった場合のエラー
 */
class CoordinateError extends Error
{
    constructor(x: number, y: number) {
        const message = `cellsの範囲外です  x:${x}, y:${y}`;
        super(message);
    }
}

//=============================================================================
// セル クラス
//      ダンジョンの１マスのデータ型
//      定数を定義  (イベントの種類, 壁の種類)
//=============================================================================

export class Cell
{
    event   : EVENT;    // イベント
    param   : number    // イベント詳細( 壁の種類, 階段番号, アイテム番号, 敵番号 )
    chipX   : number;   // チップ座標X (背景画像シート用)
    chipY   : number;   // チップ座標Y (背景画像シート用)
    visible : boolean;  // 可視/不可視

    /**
     * @param excelData  エクセルで作成したセルデータ
     */
    constructor(excelData: Readonly<number>) {

        // エクセルデータを桁ごとに分解
        //      例: excelData 1234  →  ["1", "2", "3", "4"]
        const arr: string[] = excelData.toString().split("");

        // フィールドに代入
        this.event   = Number(arr[0]);
        this.param   = Number(arr[1]);
        this.chipX   = Number(arr[2]) * CELL_PX;     // セル座標 → ピクセル座標
        this.chipY   = Number(arr[3]) * CELL_PX;
        this.visible = false;
    }

    
    /**
     * 敵番号を取得
     * @returns 敵番号 (存在しない場合は -1)
     */
    getEnemyNum(): number {
        const existsEnemy = (this.event == EVENT.ENEMY);
        return existsEnemy ? this.param : -1;
    }


    /**
     * 宝箱を通路化し、アイテム番号を返す
     */
    openBox(): number {

        // 宝箱を通路化
        this.event = EVENT.NONE;
        this.chipX = 0;
        this.chipY = 5 * CELL_PX;

        // item番号を返す
        return this.param;
    }
}

//=============================================================================
// 階層 クラス
//=============================================================================

export class Floor
{
    // メディア
    readonly image : HTMLImageElement; // 背景画像シート
    readonly bgm   : Bgm;

    // 階層データ
    cells   : Cell[][]; // マップデータ
    enemies : Enemy[];  // 敵実体のリスト

    // マッピング率関連
    mappingMax   = 0;   // 通行できるセルの数
    mappingCount = 0;   // マッピング数 (通行できるセルのみ)
    mappingRate  = 0;   // 踏破率


    /**
     * @param mapExcelData  エクセルで作成した階層データ
     * @param image         背景画像シート
     * @param bgm           BGM (ループ再生される)
     * @param enemyDesigns  敵の設計図リスト
     */
    constructor(
        mapExcelData: Readonly<number[][]>, image: HTMLImageElement, bgm: Bgm,
        enemyDesigns: Readonly<EnemyDesign[]>
    ) {
        // エクセルデータ → Cell[][]
        const cells =
            mapExcelData.map(
                line => line.map(
                    num => new Cell(num) ));

        // フィールド初期化
        this.cells   = cells;
        this.image   = image;
        this.bgm     = bgm;
        this.enemies = [];


        for (let y=0; y<cells    .length; ++y) {
        for (let x=0; x<cells[y]!.length; ++x) {

            const cell = cells[y]![x]!;

            // 敵番号を取得
            const enemyNum = cell.getEnemyNum();
            if (enemyNum != -1) {

                // 敵の設計図を取得
                const design = enemyDesigns[enemyNum];
                if (!design) throw Error("enemyNum が不適切です : " + enemyNum);

                // 敵インスタンスを生成、リストへ追加
                const enemy = design.generate(x, y);
                this.enemies.push(enemy);
            }

            // 通路数カウント
            if (cell.event != EVENT.WALL) 
                this.mappingMax++;
        }}
    }

    //-------------------------------------------------------------------------
    // 敵の管理
    //-------------------------------------------------------------------------

    // 敵を移動
    moveEnemy(enemy: Enemy, x: number, y: number) {
    
        // 移動前、移動後 セル
        const from = this.cells[enemy.y]?.[enemy.x];
        const to   = this.cells[y]?.[x];
        if (!from)  throw new CoordinateError(enemy.x, enemy.y);
        if (!to)    throw new CoordinateError(x, y);
        
        // enemies側
        enemy.setXY(x, y);

        // map側
        from.event = EVENT.NONE;     // 消去
        to.event   = EVENT.ENEMY;    // 追加
        to.param   = from.param;     // 敵番号
    }


    // 指定座標の敵を削除し、取得
    deleteEnemy(x: number, y: number): Enemy {

        const enemies = this.enemies;

        // cell から削除
        const cell = this.cells[y]?.[x];
        if (!cell) throw new CoordinateError(x, y);
        cell.event = EVENT.NONE;

        // enemies 内を検索、削除
        for (let i=0; i<enemies.length; ++i) {
            const enemy = enemies[i]!;

            if (enemy.x == x && enemy.y == y) {
                enemies.splice(i, 1);
                return enemy;
            }
        }

        throw new Error("指定座標に敵は存在しません");
    }
    
    //-------------------------------------------------------------------------
    // マッピング
    //-------------------------------------------------------------------------

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

        return isCompleted;
    }
}

//=============================================================================
// ダンジョンの処理、データ管理
//=============================================================================

export class DungeonModel
{
    // 階層以外のデータ
    readonly chara        : MainChara;
    readonly items        : Item[];
    readonly enemyDesigns : EnemyDesign[];

    // 全階層分のデータ
    readonly floors     : Floor[];
    readonly stairsList : Stairs[];
    completeCount = 0;   // クリアした階層数

    // 現階層データ
    floorNum = 0;       // 階層番号 (floors用インデックス)
    floor : Floor;      // 現在の階層データ
    cell  : Cell;       // キャラ座標のセル

    // 歩行時に、新しくマッピングした座標 の配列
    mappingPoints: Point[] = [];

    /**
     * @param chara         メインキャラ
     * @param items         アイテムリスト
     * @param enemyDesigns  敵設計図リスト
     * @param floors        全階層データ
     * @param stairsList    階段リスト
     */
    constructor(
        chara: MainChara, items: Item[], enemyDesigns: EnemyDesign[],
        floors: Floor[], stairsList: Stairs[])
    {
        this.chara        = chara;
        this.items        = items;
        this.enemyDesigns = enemyDesigns;
        this.floors       = floors;
        this.stairsList   = stairsList;

        // 現階層データを初期化
        const floor = this.floors[0];
        if (!floor) throw new Error("floorsの要素数が0です");
        this.floor = floor;
        this.cell  = this.floor.cells[0]![0]!;
    }


    // キャラの座標を設定 (インスタンス生成後に必ず実行)
    setCharaCoordinate(floorNum: number, x: number, y: number) {

        // キャラ座標 変更
        const chara = this.chara;
        chara.setXY(x, y);
        chara.direction = DIRECTION.DOWN;

        // 階層データを切り替え
        const floor = this.floors[ floorNum ];
        if (!floor) throw new Error("floorNum が不適切です : " + floorNum);
        
        this.floorNum = floorNum;
        this.floor    = floor;

        // キャラの周囲を可視化
        this.mappingCell(x, y);
        this.mappingAround(x, y);
        floor.updateMappingRate();
    }
    
    //-------------------------------------------------------------------------
    // マッピング
    //-------------------------------------------------------------------------

    // 全ての階層を踏破したか否か
    isGameCompleted(): boolean {
        return (this.completeCount == this.floors.length);
    }


    /**
     * 全てのセルを可視化
     * @param cellEvent  [省略可] 指定イベントのみを可視化
     */
    mappingAll(cellEvent?: EVENT) {

        const cells = this.floor.cells;

        for (let y=0;  y < cells    .length;  ++y) {
        for (let x=0;  x < cells[y]!.length;  ++x) {

            if (cellEvent == undefined  ||
                cellEvent == cells[y]![x]!.event)
                this.mappingCell(x, y, true);
        }}
    }


    /**
     * 単セルを可視化
     * @param x 
     * @param y 
     * @param stop    省略する (再帰用の変数)
     */
    mappingCell(x: number, y: number, stop = false) {
        
        const floor = this.floor;
        const cell  = floor.cells[y]?.[x];
        if (!cell) throw new CoordinateError(x, y);

        // 不可視
        if (!cell.visible) {

            // 可視化、リストに追加
            cell.visible = true;
            this.mappingPoints.push(new Point(x, y));

            // 壁以外  →  マッピングをカウント
            if (cell.event != EVENT.WALL) {
                floor.mappingCount++;
                return;
            }
        }

        // 連続で再帰することを防ぐ
        if (stop) return;

        // 「上のセルも同時に可視化」処理
        if (cell.event == EVENT.WALL  &&
            cell.param == WALL.MAPPING_TOP)
            this.mappingCell(x, y-1, true);
    }

    
   // 歩行時の可視化処理
    mappingAround(x: number, y: number) {

        const top    = y - 1;
        const bottom = y + 1;
        const left   = x - 1;
        const right  = x + 1;

        // 上下左右 (十字型)
        this.mappingCell(x    , top);
        this.mappingCell(x    , bottom);
        this.mappingCell(left , y  );
        this.mappingCell(right, y  );

        // 8方向化 (難易度調整)
        this.mappingCell(left , top);
        this.mappingCell(right, top);
        this.mappingCell(left , bottom);
        this.mappingCell(right, bottom);
    }

    //-------------------------------------------------------------------------
    // 歩行
    //-------------------------------------------------------------------------

    /**
     * メインキャラの歩行処理
     * @param   direction 入力された方向
     * @returns 壁にぶつかったか否か
     */
    walkChara(direction: DIRECTION): boolean {

        // 移動前の座標を取得
        const chara = this.chara;
        let x = chara.x;
        let y = chara.y;

        // キャラの向き
        chara.direction = direction;
        
        // 移動後の座標に変更
        if      (direction == DIRECTION.UP   ) y += -1;
        else if (direction == DIRECTION.DOWN ) y +=  1;
        else if (direction == DIRECTION.LEFT ) x += -1;
        else if (direction == DIRECTION.RIGHT) x +=  1;

        // 壁にぶつかるか否か
        const cell = this.floor.cells[y]?.[x];
        if (!cell) throw new CoordinateError(x, y);
        const isWall = (cell.event == EVENT.WALL);

        this.mappingPoints = [];
        
        // 壁以外 → キャラ移動 + マッピング
        if (!isWall) {
            this.mappingAround(x, y);
            chara.setXY(x, y);
            chara.walkCount++;
            this.cell = cell;
        }

        return isWall;
    }


    /**
     * 敵の歩行処理
     */
    walkEnemy(enemy: Enemy) {

        const {chara, floor}  = this;
        const {x, y} = enemy;

        // キャラと敵が同座標  →  移動しない
        if (x == chara.x  &&  y == chara.y) {
            floor.moveEnemy(enemy, x, y);
            return;
        }

        //-----------------------------------
        // 移動先の候補を作成
        //-----------------------------------

        // 上下左右から、通行可能なものだけに絞る
        const coords = [
            new Point(x  ,  y-1),
            new Point(x  ,  y+1),
            new Point(x-1,  y  ),
            new Point(x+1,  y  ),

        ].filter( ({x, y}) => (floor.cells[y]?.[x]?.event == EVENT.NONE) );

        // 候補先なし → 移動しない
        if (coords.length == 0) {
            floor.moveEnemy(enemy, x, y);
            return;
        }

        //-----------------------------------
        // 候補の中から決定
        //-----------------------------------

        // 追跡の敵
        if (enemy.design.chase) {

            let minDistance = 1000;
            let minCoord = coords[0]!;

            for (const coord of coords) {

                // 主人公と敵の相対距離
                const distance =
                    Math.abs( coord.y - chara.y ) +
                    Math.abs( coord.x - chara.x );
                
                // 最短距離の更新
                if (minDistance > distance) {
                    minDistance = distance;
                    minCoord    = coord;
                }
            }

            floor.moveEnemy(enemy, minCoord.x, minCoord.y);
        }

        // ランダム移動の敵
        else {
            const i = Math.floor( Math.random() * coords.length );
            const {x, y} = coords[i]!;
            floor.moveEnemy(enemy, x, y);
        }
    }

    //-------------------------------------------------------------------------
    // イベント
    //-------------------------------------------------------------------------

    // 宝箱
    boxEvent(): Item {

        // アイテムを取得
        const itemNum = this.cell.openBox();
        const item = this.items[itemNum];
        if (!item) throw new Error("セルのアイテム番号が不適切です : " + itemNum);
        
        // 所持数を増やす
        item.quantity ++;
        return item;
    }

    // 階段
    stairsEvent() {

        // 移動先を取得
        const index  = this.cell.param;
        const stairs = this.stairsList[index];
        if (!stairs) throw new Error("セルの階段番号が不適切です : " + index);

        // キャラの座標を設定
        const [floorNum, x, y] = stairs;
        this.setCharaCoordinate(floorNum, x, y);
    }


    /**
     * 敵の遭遇処理
     * @returns 遭遇した敵
     */
    enemyEvent(): Enemy {

        // 遭遇した敵を削除
        const chara = this.chara;
        const enemy = this.floor.deleteEnemy(chara.x, chara.y);
        const safeItem = enemy.design.safeItem;
        
        // 回避 → アイテムを消費
        if (safeItem.quantity > 0) {
            safeItem.quantity--;
            chara.safeCount++;
            enemy.result = ENEMY_RESULT.DODGED;
        }
        
        // ダメージ → HP減少
        else {
            chara.hp--;
            enemy.result = (chara.hp == 0)
                ? ENEMY_RESULT.GAMEOVER
                : ENEMY_RESULT.CRASHED;
        }

        return enemy;
    }
}

//=============================================================================
// ダンジョンの描画、イベント演出
//=============================================================================

export class DungeonView
{
    // ステータスバー、装備表示、メッセージウィンドウ、十字ボタン(描画用)
    readonly rects = {
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
        public readonly model    : DungeonModel,
        public readonly input    : Input,
        public readonly contexts : Contexts,
        public readonly se       : Se
    ) {}

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
     * @param shiftPx  歩行アニメーションの際にずらすpx数
     */
    drawFloor(shiftPx: number = 0) {

        const {chara, floor} = this.model;
        const {bg:contextBg, preRender:contextPre} = this.contexts;

        // 背景の取得座標
        //      = (A)背景キャンバスの余白幅 + キャラ座標 - (B)画面上のキャラ座標
        //      = キャラ座標 （A==B のため相殺した)

        // キャラ座標(背景上) = 移動後の位置 - 歩行アニメーション用補正
        const bgX = chara.pxX - (chara.moveX * shiftPx);
        const bgY = chara.pxY - (chara.moveY * shiftPx);

        // 画像取得、実画面へ描画
        const bgImage = contextPre.getImageData(bgX, bgY, CANVAS.W, CANVAS.H);
        contextBg.putImageData(bgImage, 0, 0);

        // 敵を描画
        for (const enemy of floor.enemies) {

            // 背景上の敵座標 = 移動後の位置 - 歩行アニメーション用補正
            const enemyX = enemy.pxX - (enemy.moveX * shiftPx);
            const enemyY = enemy.pxY - (enemy.moveY * shiftPx);

            // 画面上の敵座標 = 背景キャンバスの余白幅 + 背景上の敵座標 - 背景の取得座標
            enemy.draw(
                contextBg,
                CANVAS.CHARA_X + enemyX - bgX,
                CANVAS.CHARA_Y + enemyY - bgY
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

        // 使用グローバル
        const chara   = this.model.chara;
        const cells   = this.model.floor.cells;
        const context = this.contexts.ui;
        
        // マップクリア （移動前の敵を消す）
        context.clearRect(LEFT, TOP, WIDTH, WIDTH);

        // 全背景
        for (let y=0;  y<cells    .length;  ++y) {
        for (let x=0;  x<cells[y]!.length;  ++x) {

            // 現位置のデータ
            const {event, visible} = cells[y]![x]!;

            // 色を指定
            const color = 
                (event === EVENT.ENEMY ) ? "red"         :   // 敵
                (visible === false     ) ? null          :   // 不可視
                (event === EVENT.WALL  ) ? "dimgray"     :   // 壁
                (event === EVENT.NONE  ) ? "white"       :   // 通路
                (event === EVENT.STAIRS) ? "lightgreen"  :   // 階段（上下）
                (event === EVENT.BOX   ) ? "yellow"      :   // 宝箱
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
        const {floorNum, floor, chara, items} = this.model;
        const {hpMax, hp, walkCount} = chara;

        // ステータス
        const hpText = "●".repeat(hp) + "○".repeat(hpMax - hp);
        const status = `地下${floorNum}階  ${floor.mappingRate}％  ${walkCount}歩  HP${hpText}`;

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


    // 階層切り替え画面を描画
    drawStairsScreen() {

        this.se.stairs.play();

        // 黒背景
        const context        = this.contexts.ui;  
        context.fillStyle    = "black";
        context.fillRect( 0, 0, CANVAS.W, CANVAS.H );
        
        // 文字表示
        const text           = "地下" + this.model.floorNum + "階";
        context.fillStyle    = "white";
        context.font         = "30px 'ＭＳ ゴシック'";
        context.textAlign    = "left";
        context.textBaseline = "top";
        context.fillText( text, CANVAS.W/3, CANVAS.H/2 );
    }

    //-------------------------------------------------------------------------
    // 歩行アニメーション
    //-------------------------------------------------------------------------

    /**
     * キャラ、敵、背景 をアニメーションする
     * @param nextFunction アニメ終了後に実行する処理
     */
    animateWalking(direction: DIRECTION, nextFunction: ()=>void) {

        const self = this;
        const {chara, floor, mappingPoints} = this.model;
        const ctxPre = this.contexts.preRender;

        // 歩行パターン を次のものに変更
        chara.nextPattern();
        for (const enemy of floor.enemies)
            enemy.nextPattern();

        // フレーム設定
        const FRAME_LENGTH  = 6;                        // アニメのフレーム数
        const INTERVAL      = 28;                       // アニメ間隔（ミリ秒）
        const FRAME_PX      = CELL_PX / FRAME_LENGTH;   // 1フレームの移動幅

        // フレームカウンタ (カウントダウン方式)
        let i = FRAME_LENGTH;

        // キャラを中心に 3*3セル の範囲 (背景描画用)
        const x = CANVAS.CHARA_X + chara.pxX - CELL_PX;
        const y = CANVAS.CHARA_Y + chara.pxY - CELL_PX;
        const w = CELL_PX * 3;
        const h = CELL_PX * 3;
        const isHorizontalMove = (chara.moveX != 0);
        
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
            const shiftPx = FRAME_PX * i;

            // 新しくマッピングされた背景の 描画範囲を限定 
            //      アニメに合わせて、描画範囲を広げていく
            //      最終フレームは限定せず、全て描画
            if (i != 0) {
                ctxPre.save();
                const path = new Path2D();
                path.rect(
                    ( isHorizontalMove) ? x + shiftPx   : x,
                    (!isHorizontalMove) ? y + shiftPx   : y,
                    ( isHorizontalMove) ? w - shiftPx*2 : w,
                    (!isHorizontalMove) ? h - shiftPx*2 : h
                );
                ctxPre.clip(path);
            }
            
            // 新しくマッピングした背景をプリレンダ
            for (const {x,y} of mappingPoints) 
                self.preRenderCell(x, y);
            
            // 範囲の限定を解除
            ctxPre.restore();

            // 実キャンバスへ描画
            self.drawFloor(shiftPx);
        }
    }

    //-------------------------------------------------------------------------
    // プリレンダ
    //-------------------------------------------------------------------------

    // 全体描画 (仮想キャンバス)
    preRenderAll() {

        const context = this.contexts.preRender;
        const cells   = this.model.floor.cells;

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
        const {cells, image} = this.model.floor;

        // 描画座標
        const left = CANVAS.CHARA_X + (x * CELL_PX);
        const top  = CANVAS.CHARA_Y + (y * CELL_PX);
    
        // セルを取得
        const cell = cells[y]?.[x];
        if (!cell) throw new CoordinateError(x, y);
        const {visible, chipX, chipY} = cell;

        // 可視 → 背景描画
        if (visible) {
            context.drawImage(
                image,                              // 読込画像
                chipX,  chipY,  CELL_PX, CELL_PX,   // 画像座標
                left,   top,    CELL_PX, CELL_PX    // キャンバス座標
            );
        }
    }

    //-------------------------------------------------------------------------
    // イベント演出
    //-------------------------------------------------------------------------

    /**
     * 「メッセージ表示・SE再生」処理を登録 
     *  (enqueue のショートハンド)
     * @param text      表示するメッセージ
     * @param audio     再生するSE
     * @param delay     終了後、次の入力受付を開始するまでの時間 [ミリ秒]
     * @param bgmStop   再生中のBGMを停止する場合 true
     */
    enqueueMessage(
        text: string, audio: HTMLAudioElement | null = null,
        delay = 400, bgmStop = false
    ) {
        this.input.enqueue(() => {
            this.rects.message.draw(text, true);
            if (bgmStop) Bgm.stop();
            if (audio) audio.play();
        }, delay);
    }
    

    /**
     * 階層クリア演出
     */
    floorCompleteEvent(): Promise<void> {

        return new Promise<void>(resolve => {
            const {input, se, model} = this;

            // 暗闇を晴らす
            this.drawDark();

            // 演出をキューに追加
            this.enqueueMessage(
                "地下" + model.floorNum + "階の地図が完成した！",
                se.complete1,
                1500
            );

            // クリックで次の処理へ
            input.enqueue(resolve);
            input.runQueue();
        });
    }


    /**
     * ゲームクリア演出
     */
    gameCompleteEvent(): Promise<void> {

        return new Promise<void>(resolve => {
            const {input, se, rects} = this;

            input.enqueue(()=>{
                Bgm.stop();
                se.complete2.play();
                rects.message.draw("すべての階の地図が完成した！", true);
            }, 3000);

            // クリックで次の処理へ
            input.enqueue(resolve);
            input.runQueue();
        });
    }

    /**
     * 宝箱演出
     * @param item 入手したアイテム
     */
    boxEvent(item: Readonly<Item>): Promise<void> {

        return new Promise<void>(resolve => {
            const {se, input, model} = this;

            this.enqueueMessage("宝箱を開けた！", se.openBox);
            this.enqueueMessage(item.name + "を手に入れた！");
            this.enqueueMessage("ちゃんと装備した！");

            input.enqueue(()=> {
                const {x, y} = model.chara;
                this.preRenderCell(x, y);    // 宝箱をBGで上書き
                resolve();
            });

            input.runQueue();
        });
    }

    
    /**
     * 敵との遭遇演出
     * @param enemy  遭遇した敵
     */
    enemyEvent(enemy: Readonly<Enemy>): Promise<void> {

        return new Promise<void>(resolve => {

            const result = enemy.result;
            const {encountText, safeText, damageText} = enemy.design;
            const {input, se} = this;

            // 遭遇
            this.enqueueMessage(encountText, se.encount);

            // 回避
            if (result == ENEMY_RESULT.DODGED)
                this.enqueueMessage(safeText, se.useItem);

            // ダメージ
            else {
                input.enqueue( ()=>{
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
            if (result == ENEMY_RESULT.GAMEOVER) {
                this.enqueueMessage("体力が尽きてしまった！", se.gameover, 3000, true);
                this.enqueueMessage("-  ゲームオーバー  -", null, 1000);
            }

            // クリック待ち
            input.enqueue(resolve);
            input.runQueue();
        });
    }
}

//=============================================================================
// ダンジョン関連の統括 (Controller)
//=============================================================================

export class DungeonScreen
{
    // ダンジョンを全てクリアしたときの処理 (次の画面)
    public nextFunction = ()=>{};

    // 十字ボタンのクリック範囲 (視認性のため、描画とは別々に定義)
    private readonly triangles = {
        up    : new Triangle( new Point(100, 380), new Point( 10, 290), new Point(190, 290) ),
        down  : new Triangle( new Point(100, 380), new Point( 10, 470), new Point(190, 470) ),
        left  : new Triangle( new Point(100, 380), new Point( 10, 290), new Point( 10, 470) ),
        right : new Triangle( new Point(100, 380), new Point(190, 290), new Point(190, 470) ),
    };

    /**
     * @param model ダンジョンの処理、データ
     * @param view  ダンジョンの演出
     * @param input 入力クラス
     */
    constructor(
        public  readonly model: DungeonModel,
        public  readonly view : DungeonView,
        private readonly input: Input
    ) {}
    

    /**
     * ダンジョン画面を表示する
     * (階層移動演出  →  ダンジョン画面+入力待機へ)
     */
    public show() {

        const {model, view} = this;
        view.drawStairsScreen();

        // [デバッグ] 1歩で階層クリア  (キャラ地点以外を可視化)
        // (()=>{
        //     const floor  = model.floor;
        //     const {x, y} = model.chara;
        //     if (floor.mappingRate == 100) return;
        //     model.mappingAll();
        //     floor.cells[y]![x]!.visible = false;
        //     floor.mappingCount--;
        //     floor.updateMappingRate();
        // })();

        setTimeout(()=>{
            model.floor.bgm.play();
            view.preRenderAll();
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
        const floor = model.floor;

        // 入力方向を取得
        const direction = this.getInputDirection();
        if (direction == null) {
            this.inputStandby();
            return;
        }

        //---------------------------------------
        // 歩行
        //---------------------------------------

        // キャラ歩行
        const isWall = model.walkChara(direction);

        // 壁にぶつかる処理
        if (isWall) {
            view.se.wall.play();
            view.drawFloor();
            this.inputStandby();
            return;
        }

        // 敵歩行
        for (let enemy of floor.enemies)
            model.walkEnemy(enemy);

        // 歩行アニメーション
        await new Promise<void>(resolve => view.animateWalking(direction, resolve));

        //---------------------------------------
        // クリアイベント
        //---------------------------------------

        // 踏破率更新
        const isFloorCompleted = floor.updateMappingRate();
        view.drawStatus();
        view.drawMap();

        // 階層クリア
        if (isFloorCompleted) {
            model.completeCount++;

            // 全背景を可視化
            model.mappingAll();
            view.preRenderAll();
            view.drawFloor();

            await view.floorCompleteEvent();
            view.drawAll();

            // ゲームクリア
            if (model.isGameCompleted()) {
                await view.gameCompleteEvent();
                this.nextFunction();
                return;
            }
        }

        //---------------------------------------
        // 移動先イベント
        //---------------------------------------
        
        switch (model.cell.event) {

            // 通路  →  連続歩行
            case EVENT.NONE :
                this.onInput();
                return;

            // 宝箱
            case EVENT.BOX :
                const item = model.boxEvent();
                await view.boxEvent(item);
                this.drawAndInputStandby();
                return;

            // 階段  →  階層移動
            case EVENT.STAIRS :
                model.stairsEvent();
                setTimeout(()=>this.show(), 200);
                return;

            // 敵と遭遇
            case EVENT.ENEMY :
                const enemy = model.enemyEvent();
                await view.enemyEvent(enemy);
                
                // ゲームオーバー  →  ページリロード
                if (enemy.result == ENEMY_RESULT.GAMEOVER)
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
    private getInputDirection(): DIRECTION | null {

        // キーが離された → 連続歩行を停止
        const {x, y, key} = this.input;
        if (!key) return null;

        const trais = this.triangles;

        // 入力された方向 を取得
        return ( 
            
            // キーボード入力
            (key == "ArrowUp"          ) ? DIRECTION.UP    : 
            (key == "ArrowDown"        ) ? DIRECTION.DOWN  :
            (key == "ArrowLeft"        ) ? DIRECTION.LEFT  :
            (key == "ArrowRight"       ) ? DIRECTION.RIGHT :

            // 方向ボタン
            (trais.up   .contains(x, y)) ? DIRECTION.UP    :
            (trais.down .contains(x, y)) ? DIRECTION.DOWN  :
            (trais.left .contains(x, y)) ? DIRECTION.LEFT  :
            (trais.right.contains(x, y)) ? DIRECTION.RIGHT :
            null
        );
    }
}
