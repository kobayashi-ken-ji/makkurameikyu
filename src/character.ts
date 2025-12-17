// ファイル内容
//      Item        - アイテム情報
//      Walker      - キャラ・敵 の親クラス
//      MainChara   - メインキャラ
//      EnemyDesign - 敵 (設計)
//      Enemy       - 敵 (実体)

//=============================================================================
// インポート
//=============================================================================

import {CELL_PX, CHARA_PX, CANVAS, WALK_PATTERN, Direction} from './constants.js';

//=============================================================================
// アイテム情報
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
// 歩行者 クラス (継承元)
//      - 座標・移動量・向き・歩行パターン を管理
//      - 描画処理
//=============================================================================

abstract class Walker
{
    // 現在のセル座標、移動量
    private _x    = 0;
    private _y    = 0;
    private moveX = 0;
    private moveY = 0;

    // 向き、歩行パターンのインデックス
    public  direction: Direction = Direction.DOWN;
    private i: 0|1|2|3 = 0;

    /**
     * @param image     画像シート
     * @param chipSize  画像チップの幅
     */
    constructor(
        private readonly image    : HTMLImageElement,
        private readonly chipSize : number,
    ) {}


    // ゲッターのみを実装
    get x() { return this._x; }
    get y() { return this._y; }


    /**
     * 背景上の座標(px) = 移動後の位置 - 歩行アニメーション用補正
     * @param offset  歩行アニメーションの際にずらすpx数
     */
    getXyOnBg(offset: number = 0) {
        return {
            x : (this._x * CELL_PX) - (this.moveX * offset),
            y : (this._y * CELL_PX) - (this.moveY * offset),
        };
    }


    // 座標指定 (歩行処理、階層移動 などに使用)
    setXy(x: number, y: number, direction?: Direction) {

        // 移動量 (移動後 - 移動前)
        this.moveX  = x - this._x;
        this.moveY  = y - this._y;

        // 新座標
        this._x   = x;
        this._y   = y;

        // 向き (移動量が0の場合は変更なし)
        this.direction = 
            direction ??
            (this.moveY < 0)  ? Direction.UP    :
            (this.moveY > 0)  ? Direction.DOWN  :
            (this.moveX < 0)  ? Direction.LEFT  :
            (this.moveX > 0)  ? Direction.RIGHT :
            this.direction;     // 移動なし → 方角もそのまま
    }


    // 歩行パターンを次へ
    nextPattern() {
        // 0~3 に限定
        if (this.i==3)  this.i = 0;
        else this.i++;
    }


    /**
     * チップを描画
     * @param context   描画先
     * @param left      描画座標X
     * @param top       描画座標Y
     */
    draw(context: CanvasRenderingContext2D, left: number, top: number) {
        const {chipSize, i, direction, image} = this;

        // チップ取得座標
        const chipX = WALK_PATTERN[i] * chipSize;
        const chipY = direction       * chipSize;

        // 描画
        context.drawImage(
            image,                              // 画像
            chipX, chipY, chipSize, chipSize,   // 取得範囲
            left,  top,   chipSize, chipSize    // 描画範囲
        );
    }
}

//=============================================================================
// メインキャラ クラス
//      - ステータス・座標 を管理
//      - 歩行アニメ処理
//=============================================================================

export class MainChara extends Walker
{
    // 画面上のキャラ描画座標 (px)
    // 主人公のみ画像サイズが異なるため、描画座標を調整
    private readonly diff    = CHARA_PX - CELL_PX;
    private readonly screenX = CANVAS.CHARA_X - (this.diff / 2);
    private readonly screenY = CANVAS.CHARA_Y - this.diff;

    /**
     * @param image 画像シート
     */
    constructor(image: HTMLImageElement) {
        super(image, CHARA_PX);
    }

    /**
     * キャラを描画
     * @param context 描画先
     */
    override draw(context: CanvasRenderingContext2D) {
        super.draw(context, this.screenX, this.screenY);
    }
}

//=============================================================================
// 敵クラス  (実体)
//      EnemyDesign.prototype.generate() 経由で生成される
//=============================================================================

/**
 * 敵との遭遇イベントの処理結果
 */
export enum EnemyResult {
    UNENCOUNTERED,  // 未遭遇
    DODGED,         // 回避
    CRASHED,        // 衝突
    GAMEOVER,       // 衝突後、キャラのHPが0
};

export class Enemy extends Walker
{
    readonly design;
    result: EnemyResult;

    constructor(design: EnemyDesign, x: number, y: number) {

        super(design.image, CELL_PX);
        this.setXy(x, y, Direction.DOWN);
        this.design = design;
        this.result = EnemyResult.UNENCOUNTERED;
    }
}

//=============================================================================
// 敵クラス (設計図/基本情報) 
//=============================================================================

export class EnemyDesign
{
    /**
     * @param isChaser      true 追跡 / false ランダム移動
     * @param dodgingItem   この敵を回避できるアイテムの番号
     * @param image         画像シート
     * @param encountText   遭遇時のテキスト
     * @param dodgedText    回避のテキスト
     * @param damageText    ダメージ時のテキスト
     */
    constructor(
        public readonly isChaser    : boolean,
        public readonly dodgingItem : number,
        public readonly image       : HTMLImageElement,
        public readonly encountText : string,
        public readonly dodgedText  : string,
        public readonly damageText  : string
    ) {}

    
    /**
     * Enemyインスタンスを生成
     * @param x 初期座標X
     * @param y 初期座標Y
     * @returns 敵の実体インスタンス
     */
    generate(x: number, y: number): Enemy {
        return new Enemy(this, x, y);
    }
}
