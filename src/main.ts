"use strict";

// ファイルの内容
//      Main                - ゲーム本体
//      StartScreen         - ゲーム開始画面
//      EndScreen           - ゲームクリア画面
//      new Main().main();  - ゲーム実行

//=============================================================================
// インポート
//=============================================================================

import {CANVAS, BG_CANVAS, DUNGEON_EXCEL_DATA, STAIRS_DESTINATIONS, type Coordinate}
from './constants.js';

import {Rect, Sound, Bgm, ImageLoader, Context2D, Input, OnInputQueue} from './utility.js';
import {Item, MainChara, EnemyDesign} from './character.js';

import {Floor, DungeonModel, DungeonView, DungeonScreen, CharaStatus, 
    type Contexts, type SoundEffects} from './dungeon.js';

//=============================================================================
// ゲーム本体
//      ・リソースの読込 (画像、音声)
//      ・外部クラスを統括
//      ・アイテム、敵、階層 のデータを定義
//      ・ゲーム開始処理
//=============================================================================

class Main
{
    readonly startScreen   : StartScreen;
    readonly endScreen     : EndScreen;
    readonly dungeonScreen : DungeonScreen;

    constructor() {

        // 主人公の初期座標
        const INITIAL_COORDINATE: Coordinate = [0, 13, 11];

        // 音量調整
        Sound.InitialVolume = 0.3;
        Bgm.InitialVolume   = 0.3;

        //---------------------------------------------------------------------
        // リソース読込
        //---------------------------------------------------------------------

        // キャンバス
        const contexts: Contexts = {
            ui        : Context2D.get("g_canvas3"),    // ステータス、ボタン、テキスト、地図用
            dark      : Context2D.get("g_canvas2"),    // 暗闇用
            bg        : Context2D.get("g_canvas1"),    // キャラ、敵、背景用
            preRender : Context2D.createVirtual(BG_CANVAS.W, BG_CANVAS.H), // 背景 事前描画用
        };

        // BGM (ループ再生・排他再生)
        const bgm = {
            rockFloor  : new Bgm("sounds/bgm118_okkuumura.mp3"  ),
            stoneFloor : new Bgm("sounds/bgm221_chinkena.mp3"   ),
            iceFloor   : new Bgm("sounds/bgm137-zenjinmitou.mp3"),
        };

        // 効果音
        const se: SoundEffects = {
            complete1 : new Sound("sounds/se_fanfare1.wav"),    // 階層クリア
            complete2 : new Sound("sounds/se_fanfare2.wav"),    // ゲームクリア
            stairs    : new Sound("sounds/se_kaidan.wav"),      // 階段移動
            openBox   : new Sound("sounds/se_takara.wav"),      // 宝箱
            useItem   : new Sound("sounds/se_present.wav"),     // アイテムで敵を回避
            crash     : new Sound("sounds/se_crash.wav"),       // 敵と衝突
            select    : new Sound("sounds/se_select.wav"),      // 選択音 (メッセージ表示)
            wall      : new Sound("sounds/se_pyokotto.wav"),    // 壁衝突音
            gameover  : new Sound("sounds/se_gameover.wav"),    // ゲームオーバー
            encount   : new Sound("sounds/se_encount.wav"),     // 遭遇
        };


        // 画像 (ゲーム開始時に読込待ちが必要)
        const images = {
            mainChara   : ImageLoader.load("images/char_44px.png"),     // キャラ
            enemyCat    : ImageLoader.load("images/enm_chase.png"),     // 敵_追跡
            enemyChick  : ImageLoader.load("images/enm_random.png"),    // 敵_ランダム
            enemySlime  : ImageLoader.load("images/enm_through.png"),   // 敵_壁通過
            bgRock      : ImageLoader.load("images/bg_rock.png"),       // 背景_岩
            bgStone     : ImageLoader.load("images/bg_stone.png"),      // 背景_石
            bgIce       : ImageLoader.load("images/bg_ice.png"),        // 背景_氷
            startScreen : ImageLoader.load("images/start_screen.png"),  // スタート画面
        };
        
        //---------------------------------------------------------------------
        // ダンジョン関連 変数
        //---------------------------------------------------------------------

        // アイテム配列
        const items: readonly Item[] = [
            new Item(0, "ヘルメット"),
            new Item(0, "キャンディ"),
            new Item(0, "たいまつ"),
        ];

        // 敵データ
        const enemyDesigns: readonly EnemyDesign[] = [

            // ひよこ
            new EnemyDesign(
                false, 0,
                images.enemyChick,
                "ちびっ子にぶつかった！",
                "ヘルメットが守ってくれた！",
                "たんこぶが出来た！"
            ),

            // ねこ
            new EnemyDesign(
                true, 1,
                images.enemyCat,
                "いたずらっ子に追いつかれた！",
                "キャンディをあげたら去っていった！",
                "おかしが無かったのでイタズラされた！"
            ),

            // スライム
            new EnemyDesign(
                false, 2,
                images.enemySlime,
                "スライムがあらわれた！",
                "たいまつを投げつけると、逃げていった！",
                "まとわりつかれた！"
            ),
        ];

        // 主人公 (操作キャラ)
        const chara = new MainChara(images.mainChara);

        // ダンジョンの階層データ
        const floors = [
            new Floor(DUNGEON_EXCEL_DATA[0], "地下1階", images.bgStone, bgm.stoneFloor, enemyDesigns),
            new Floor(DUNGEON_EXCEL_DATA[1], "地下2階", images.bgRock,  bgm.rockFloor , enemyDesigns),
            new Floor(DUNGEON_EXCEL_DATA[2], "地下3階", images.bgIce,   bgm.iceFloor  , enemyDesigns),
        ];

        // 入力クラス
        const element = document.getElementById("g_canvas3");
        if (!element) throw new Error("ID g_canvas3 の要素を取得できません。");
        const input = new Input(element);

        // ダンジョン画面関連
        const model  = new DungeonModel(chara, items, floors, STAIRS_DESTINATIONS, INITIAL_COORDINATE);
        const view   = new DungeonView(model, model.getFloor(), input, contexts, se);
        const screen = new DungeonScreen(model, view, input);
        
        //---------------------------------------------------------------------
        // フィールド初期化
        //---------------------------------------------------------------------

        this.startScreen    = new StartScreen(contexts.ui, images.startScreen, input);
        this.endScreen      = new EndScreen  (contexts.ui, images.startScreen);
        this.dungeonScreen  = screen;

        Rect.init(contexts.ui, se.select);
    }


    // ゲーム開始処理 (エントリーポイント)
    async main() {

        // 画像読込待ち
        await ImageLoader.getPromise();

        const {startScreen, endScreen, dungeonScreen} = this;

        // [デバッグ] ゲームクリア画面を表示
        // endScreen.show(); return;

        // 画面遷移を設定 (スタート画面 → ダンジョン画面 → ゲームクリア画面)
        startScreen.nextFunction   = ()=>dungeonScreen.show();
        dungeonScreen.nextFunction = (charaStatus)=>endScreen.show(charaStatus);

        // ゲーム開始
        startScreen.show();
    }
}

//=============================================================================
// ゲームスタート画面
//=============================================================================

class StartScreen
{
    // この画面の終了時に実行する処理 (次の画面)
    nextFunction = ()=>{};

    /**
     * @param context 描画先
     * @param bgImage 背景画像
     * @param input   入力クラス
     */
    constructor(
        private readonly context: CanvasRenderingContext2D,
        private readonly bgImage: HTMLImageElement,
        private readonly input  : Input
    ) {}

    // 画面を表示、クリックされたら次の画面へ
    show() {
        const queue = new OnInputQueue(this.input);
        queue.push(()=>this.draw(), 0);
        queue.push(this.nextFunction, 0);
        queue.run();
    }
    
    // 画面を描画
    private draw() {
        // キャンバス設定
        const context = this.context;
        context.fillStyle    = "white";
        context.textAlign    = "center";
        context.textBaseline = "top";

        // 画像背景
        context.drawImage(this.bgImage, 0, 0);

        const x = CANVAS.W / 2;
        let   y = 120;

        const texts = {
            title   : "まっくら迷宮",
            rule1   : "敵を避けながら歩いて",
            rule2   : "ダンジョンの地図を完成させよう！",
            rule3   : "Click to Start",
            input1  : "マウスのクリックと",
            input2  : "↑↓←→ キーが使用できます。",
        };

        // タイトル
        context.font = 30 + "px 'ＭＳ ゴシック'";
        context.fillText( texts.title , x, y);

        // ルール
        context.font = 16 + "px 'ＭＳ ゴシック'";
        context.fillText( texts.rule1 , x, y+=80  );
        context.fillText( texts.rule2 , x, y+=24  );
        context.fillText( texts.rule3 , x, y+=100 );

        // 操作方法
        context.font = 11 + "px 'ＭＳ ゴシック'";
        context.fillText( texts.input1 , x, y+=80 );
        context.fillText( texts.input2 , x, y+=16 );
    }
}

//=============================================================================
// ゲームクリア画面
//=============================================================================

class EndScreen
{
    /**
     * @param context 描画先
     * @param bgImage 背景画像
     * @param chara   ゲームのリザルトを所持しているクラス
     */
    constructor(
        private readonly context: CanvasRenderingContext2D,
        private readonly bgImage: HTMLImageElement,
    ) {}

    
    // 画面を表示
    show(charaStatus: Readonly<CharaStatus>) {
        const {walkCount, hpMax, hp, safeCount} = charaStatus;

        // キャンバス設定
        const context = this.context;
        context.fillStyle    = "white";
        context.textAlign    = "center";
        context.textBaseline = "top";

        // 画像背景
        context.drawImage(this.bgImage, 0, 0);

        const x = CANVAS.W / 2;
        let   y = 160;

        const texts = {
            title   : "ゲームクリア",
            walk    : "歩数 : "          + walkCount,
            damage  : "受けたダメージ : " + (hpMax - hp),
            item    : "アイテム消費数 : " + safeCount,
        };
        
        // タイトル
        context.font = 30 + "px 'ＭＳ ゴシック'";
        context.fillText( texts.title, x, y );

        // リザルト
        context.font = 16 + "px 'ＭＳ ゴシック'";
        context.fillText( texts.walk  , x, y+=100 );
        context.fillText( texts.damage, x, y+=24  );
        context.fillText( texts.item  , x, y+=24  );
    }
}

//=============================================================================
// 実行
//=============================================================================

window.addEventListener('load', ()=>new Main().main(), false);
