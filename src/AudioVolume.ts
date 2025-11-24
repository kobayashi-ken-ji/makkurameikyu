class AudioVolume
{
    // 全体の音量調整
    adjustAudioVolume() {

        // // AudioContext 音声処理の土台

        // // 以下の順に接続
        // // 最終出力 → gainNode → バッファーソース
        // const audioContext = new (window.AudioContext)();
        // const gainNode = audioContext.createGain();
        // // gainNode.connect(audioContext.destination);
        // const audioBufferSourceNode = audioContext.createBufferSource();
        // // audioBufferSourceNode.connect(gainNode);

        // // 音量を調節
        // gainNode.gain.value = 0.1;

        // audioBufferSourceNode.connect(gainNode).connect(audioContext.destination);


        const audioContext = new (window.AudioContext)();
        const audioBufferSourceNode = audioContext.createBufferSource();
        // audioBufferSourceNode.connect(audioContext.destination);

        /** 「音量つまみ」のようなものです */
        const gainNode = audioContext.createGain();

        // 主な機能
        gainNode.gain.value = 0.1; // 音量を取得、設定（最大:1 ~ 最小:0）
        // gainNode.gain.setValueAtTime(音量, 開始時間); // 音量の変化時間
        // gainNode.gain.linearRampToValueAtTime(目標音量, 終了時間); // 音量の変化の仕方

        // 「音声トラック」から `.connect()` されることで、「どのトラックの音量つまみか」が決まります。
        // audioBufferSourceNode.connect(gainNode);

        // ↑の設定をしたあとで、「スピーカー」への `.connect()` を行います。順番が重要です！
        // gainNode.connect(audioContext.destination);

        // チェーン記述が可能なので、この方法で覚えてしまいましょう！
        audioBufferSourceNode.connect(gainNode).connect(audioContext.destination);
    }
}