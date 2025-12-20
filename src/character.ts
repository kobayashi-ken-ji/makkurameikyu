// ファイル内容
//      Item        - アイテムデータ
//      Walker      - キャラ・敵 の親クラス
//      MainChara   - メインキャラ
//      EnemyDesign - 敵 (設計)
//      Enemy       - 敵 (実体)

//=============================================================================
// インポート
//=============================================================================

import {CELL_PX, CHARA_PX, CANVAS} from './constants.js';

//=============================================================================
// 画像シートの X軸、Y軸
//=============================================================================

/** 歩行パターン [直立 → 左足前 → 直立 → 右足前]  (画像シートの X軸) */
export const WALK_PATTERN = [1, 0, 1, 2] as const;

/** キャラの向き  (画像シートの Y軸) */
export enum Direction  {
    UP    = 0,
    RIGHT = 1,
    DOWN  = 2,
    LEFT  = 3,
}

//=============================================================================
// 歩行者 クラス (継承元)
//      ・座標・移動量・向き・歩行パターン を管理
//      ・整合性を維持するための、操作メソッド
//      ・描画メソッド
//=============================================================================

/** 座標を変更できるメソッドを排除  */
export interface ReadonlyWalker {
    x: number;
    y: number;
    direction: Direction;
    getXyOnBg(offset?: number): {x: number, y: number};
    nextWalkingPattern(): void;
    draw(context: CanvasRenderingContext2D, left?: number, top?: number): void;
}


abstract class Walker implements ReadonlyWalker
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
     * 背景上の座標(px)
     * @param offset ずらすpx数 (歩行アニメ用 / ずらす方向は、歩行履歴から自動判定)
     */
    getXyOnBg(offset: number = 0) {
        return {
            x : (this._x * CELL_PX) - (this.moveX * offset),
            y : (this._y * CELL_PX) - (this.moveY * offset),
        };
    }


    /** 座標指定 (歩行処理、階層移動 などに使用) */
    setXy(x: number, y: number, direction?: Direction) {

        // 移動量 (移動後 - 移動前)
        this.moveX = x - this._x;
        this.moveY = y - this._y;

        // 新座標
        this._x = x;
        this._y = y;

        // 向き (移動量が0 → 変更しない)
        this.direction = 
            direction ??
            (this.moveY < 0)  ? Direction.UP    :
            (this.moveY > 0)  ? Direction.DOWN  :
            (this.moveX < 0)  ? Direction.LEFT  :
            (this.moveX > 0)  ? Direction.RIGHT :
            this.direction;
    }


    /** 歩行パターンを次へ (直立 → 左足前 → 直立 → 右足前) */
    nextWalkingPattern() {
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
    private readonly screenX: number;
    private readonly screenY: number;

    /**
     * @param image 画像シート
     */
    constructor(image: HTMLImageElement) {
        super(image, CHARA_PX);

        const diff   = CHARA_PX - CELL_PX;
        this.screenX = CANVAS.CHARA_X - (diff / 2);
        this.screenY = CANVAS.CHARA_Y - diff;
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
//      EnemyDesign.generate() 経由で生成される
//=============================================================================

/** 座標を変更できるメソッドを排除 */
export type ReadonlyEnemy = ReadonlyWalker & {readonly design: EnemyDesign;};


export class Enemy extends Walker implements ReadonlyEnemy
{
    readonly design: EnemyDesign;

    /** EnemyDesign.generate() から呼び出される */
    constructor(design: EnemyDesign, x: number, y: number) {

        super(design.image, CELL_PX);
        this.setXy(x, y, Direction.DOWN);
        this.design = design;
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
     * @returns 敵の実体
     */
    generate(x: number, y: number): Enemy {
        return new Enemy(this, x, y);
    }
}
