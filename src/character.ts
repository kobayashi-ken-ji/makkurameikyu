// ファイル内容
//      Item        - アイテム情報
//      Walker      - キャラ・敵 の親クラス
//      MainChara   - メインキャラ
//      EnemyDesign - 敵 (設計)
//      Enemy       - 敵 (実体)

//=============================================================================
// インポート
//=============================================================================

import {CELL_PX, CHARA_PX, CANVAS, WALK_PATTERN, DIRECTION} from './constants.js';

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
        public name: string
    ) {}
}

//=============================================================================
// 歩行者 クラス (継承元)
//      - 座標・移動量・向き・歩行パターン を管理
//      - 描画処理
//=============================================================================

class Walker
{
    // セル単位
    x     = 0;  // 現在の座標
    y     = 0;
    moveX = 0;  // 移動量 (移動後座標 - 移動前座標)
    moveY = 0;
    
    // px単位
    pxX   = 0;  // 現在の座標
    pxY   = 0;

    // 向き
    direction: DIRECTION;

    // 画像シート, 画像チップの幅、歩行パターンインデックス
    private readonly image    : HTMLImageElement;
    private readonly chipSize : number;
    private i: 0|1|2|3;

    constructor(image: HTMLImageElement, chipSize: number, x: number, y: number) {

        this.image    = image;
        this.chipSize = chipSize;
        this.setXY(x, y);

        // 初期は下向き & 棒立ち
        this.direction = DIRECTION.DOWN;
        this.i = 0;
    }
    

    // 座標を移動
    setXY(x: number, y: number) {

        const lastX  = this.x;
        const lastY  = this.y;
        this.x      = x;
        this.y      = y;
        this.moveX  = x - lastX;
        this.moveY  = y - lastY;
        this.pxX    = x * CELL_PX;
        this.pxY    = y * CELL_PX;

        this.direction = 
            (this.moveY < 0)  ? DIRECTION.UP    :
            (this.moveY > 0)  ? DIRECTION.DOWN  :
            (this.moveX < 0)  ? DIRECTION.LEFT  :
            (this.moveX > 0)  ? DIRECTION.RIGHT :
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
    draw(context: CanvasRenderingContext2D, left: number, top: number)
    {
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
    // キャラステータス
    hpMax : number;
    hp    : number;
    walkCount = 0;    // 歩数
    safeCount = 0;    // 敵を防いだ回数

    // 画面上のキャラ描画座標 (px)
    // 主人公のみ、画像サイズが異なる
    private readonly diff    = CHARA_PX - CELL_PX;
    private readonly screenX = CANVAS.CHARA_X  - (this.diff / 2);
    private readonly screenY = CANVAS.CHARA_Y  - this.diff;


    /**
     * @param image 画像シート
     * @param hpMax HPの最大値
     */
    constructor(image: HTMLImageElement, hpMax: number) {

        super(image, CHARA_PX, 0, 0);
        this.hpMax  = hpMax;
        this.hp     = hpMax;
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
export enum ENEMY_RESULT {
    UNENCOUNTERED = 10,     // 未遭遇
    DODGED        = 11,     // 回避
    CRASHED       = 12,     // 衝突
    GAMEOVER      = 13,     // 衝突後、キャラのHPが0
};

export class Enemy extends Walker
{
    readonly design;
    result: ENEMY_RESULT;

    constructor(design: EnemyDesign, x: number, y: number) {

        super(design.image, CELL_PX, x, y);
        this.design = design;
        this.result = ENEMY_RESULT.UNENCOUNTERED;
    }
}

//=============================================================================
// 敵クラス (設計図/基本情報) 
//=============================================================================

export class EnemyDesign
{
    /**
     * @param chase         true 追跡 / false ランダム移動
     * @param safeItem      この敵を防御できるアイテム
     * @param image         画像シート
     * @param encountText   遭遇時のテキスト
     * @param safeText      回避のテキスト
     * @param damageText    ダメージ時のテキスト
     */
    constructor(
        public readonly chase       : boolean,
        public readonly safeItem    : Item,
        public readonly image       : HTMLImageElement,
        public readonly encountText : string,
        public readonly safeText    : string,
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
