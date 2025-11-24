class AudioVolume {
    adjustAudioVolume() {
        const audioContext = new (window.AudioContext)();
        const audioBufferSourceNode = audioContext.createBufferSource();
        const gainNode = audioContext.createGain();
        gainNode.gain.value = 0.1;
        audioBufferSourceNode.connect(gainNode).connect(audioContext.destination);
    }
}
export {};
//# sourceMappingURL=AudioVolume.js.map