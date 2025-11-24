"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { CANVAS, BG_CANVAS, DUNGEON_EXCEL_DATA, STAIRS_LIST } from './constants.js';
import { Rect, Sound, Bgm, ImageLoader, Context2D, Input } from './utility.js';
import { Item, MainChara, EnemyDesign } from './character.js';
import { Floor, DungeonModel, DungeonView, DungeonScreen } from './dungeon.js';
class Main {
    constructor() {
        Sound.InitialVolume = 0.3;
        Bgm.InitialVolume = 0.3;
        const contexts = {
            ui: Context2D.get("g_canvas3"),
            dark: Context2D.get("g_canvas2"),
            bg: Context2D.get("g_canvas1"),
            preRender: Context2D.createVirtual(BG_CANVAS.W, BG_CANVAS.H),
        };
        const bgm = {
            rockFloor: new Bgm("sounds/bgm118_okkuumura.mp3"),
            stoneFloor: new Bgm("sounds/bgm221_chinkena.mp3"),
            iceFloor: new Bgm("sounds/bgm137-zenjinmitou.mp3"),
        };
        const se = {
            complete1: new Sound("sounds/se_fanfare1.wav"),
            complete2: new Sound("sounds/se_fanfare2.wav"),
            stairs: new Sound("sounds/se_kaidan.wav"),
            openBox: new Sound("sounds/se_takara.wav"),
            useItem: new Sound("sounds/se_present.wav"),
            crash: new Sound("sounds/se_crash.wav"),
            select: new Sound("sounds/se_select.wav"),
            wall: new Sound("sounds/se_pyokotto.wav"),
            gameover: new Sound("sounds/se_gameover.wav"),
            encount: new Sound("sounds/se_encount.wav"),
        };
        const images = {
            mainChara: ImageLoader.load("images/char_44px.png"),
            enemyCat: ImageLoader.load("images/enm_chase.png"),
            enemyChick: ImageLoader.load("images/enm_random.png"),
            enemySlime: ImageLoader.load("images/enm_through.png"),
            bgRock: ImageLoader.load("images/bg_rock.png"),
            bgStone: ImageLoader.load("images/bg_stone.png"),
            bgIce: ImageLoader.load("images/bg_ice.png"),
            startScreen: ImageLoader.load("images/start_screen.png"),
        };
        const items = [
            new Item(0, "ヘルメット"),
            new Item(0, "キャンディ"),
            new Item(0, "たいまつ"),
        ];
        const enemyDesigns = [
            new EnemyDesign(false, items[0], images.enemyChick, "ちびっ子にぶつかった！", "ヘルメットが守ってくれた！", "たんこぶが出来た！"),
            new EnemyDesign(true, items[1], images.enemyCat, "いたずらっ子に追いつかれた！", "キャンディをあげたら去っていった！", "おかしが無かったのでイタズラされた！"),
            new EnemyDesign(false, items[2], images.enemySlime, "スライムがあらわれた！", "たいまつを投げつけると、逃げていった！", "まとわりつかれた！"),
        ];
        const chara = new MainChara(images.mainChara, 3);
        const floors = [
            new Floor(DUNGEON_EXCEL_DATA[0], images.bgStone, bgm.stoneFloor, enemyDesigns),
            new Floor(DUNGEON_EXCEL_DATA[1], images.bgRock, bgm.rockFloor, enemyDesigns),
            new Floor(DUNGEON_EXCEL_DATA[2], images.bgIce, bgm.iceFloor, enemyDesigns),
        ];
        const element = document.getElementById("g_canvas3");
        if (!element)
            throw new Error("ID g_canvas3 の要素を取得できません ");
        const input = new Input(element);
        const model = new DungeonModel(chara, items, enemyDesigns, floors, STAIRS_LIST);
        const view = new DungeonView(model, input, contexts, se);
        const screen = new DungeonScreen(model, view, input);
        this.input = input;
        this.startScreen = new StartScreen(contexts.ui, images.startScreen, input);
        this.endScreen = new EndScreen(contexts.ui, images.startScreen, chara);
        this.dungeonScreen = screen;
        Rect.init(contexts.ui, se.select);
    }
    main() {
        return __awaiter(this, void 0, void 0, function* () {
            yield ImageLoader.getPromise();
            const { startScreen, endScreen, dungeonScreen } = this;
            const model = dungeonScreen.model;
            model.setCharaCoordinate(0, 13, 11);
            startScreen.nextFunction = () => dungeonScreen.show();
            dungeonScreen.nextFunction = () => endScreen.show();
            startScreen.show();
        });
    }
}
class StartScreen {
    constructor(context, bgImage, input) {
        this.context = context;
        this.bgImage = bgImage;
        this.input = input;
        this.nextFunction = () => { };
    }
    show() {
        const input = this.input;
        input.enqueue(() => this.draw(), 0);
        input.enqueue(this.nextFunction, 0);
        input.runQueue();
    }
    draw() {
        const context = this.context;
        context.fillStyle = "white";
        context.textAlign = "center";
        context.textBaseline = "top";
        context.drawImage(this.bgImage, 0, 0);
        const x = CANVAS.W / 2;
        let y = 120;
        const texts = {
            title: "まっくら迷宮",
            rule1: "敵を避けながら歩いて",
            rule2: "ダンジョンの地図を完成させよう！",
            rule3: "Click to Start",
            input1: "マウスのクリックと",
            input2: "↑↓←→ キーが使用できます。",
        };
        context.font = 30 + "px 'ＭＳ ゴシック'";
        context.fillText(texts.title, x, y);
        context.font = 16 + "px 'ＭＳ ゴシック'";
        context.fillText(texts.rule1, x, y += 80);
        context.fillText(texts.rule2, x, y += 24);
        context.fillText(texts.rule3, x, y += 100);
        context.font = 11 + "px 'ＭＳ ゴシック'";
        context.fillText(texts.input1, x, y += 80);
        context.fillText(texts.input2, x, y += 16);
    }
}
class EndScreen {
    constructor(context, bgImage, chara) {
        this.context = context;
        this.bgImage = bgImage;
        this.chara = chara;
    }
    show() {
        const chara = this.chara;
        const context = this.context;
        context.fillStyle = "white";
        context.textAlign = "center";
        context.textBaseline = "top";
        context.drawImage(this.bgImage, 0, 0);
        const x = CANVAS.W / 2;
        let y = 160;
        const texts = {
            title: "ゲームクリア",
            walk: "歩数 : " + chara.walkCount,
            damage: "受けたダメージ : " + (chara.hpMax - chara.hp),
            item: "アイテム消費数 : " + chara.safeCount,
        };
        context.font = 30 + "px 'ＭＳ ゴシック'";
        context.fillText(texts.title, x, y);
        context.font = 16 + "px 'ＭＳ ゴシック'";
        context.fillText(texts.walk, x, y += 100);
        context.fillText(texts.damage, x, y += 24);
        context.fillText(texts.item, x, y += 24);
    }
}
window.addEventListener('load', () => new Main().main(), false);
//# sourceMappingURL=main.js.map