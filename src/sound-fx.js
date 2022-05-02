import * as Tone from 'tone'

export class SoundFX {
    
    constructor(pane) {
        this.pane = pane;

        this.bell = new Tone.MetalSynth({
			harmonicity: 12,
			resonance: 800,
			modulationIndex: 20,
			envelope: {
				decay: 0.4,
			},
			volume: -15
		}).toDestination();

        /*const bellPart = new Tone.Sequence(((time, freq) => {
			this.bell.triggerAttack(freq, time, Math.random()*0.5 + 0.5);
		}), [[300, null, 200], 
			[null, 200, 200], 
			[null, 200, null], 
			[200, null, 200]
		], "4n").start(0);*/

        this.baseSoundsOscFreq = ['B3', 'E3', 'A3', 'D3', 'F#3'];
        this.baseSoundOsc = new Tone.FatOscillator('B3', 'square', 10);
        this.baseSoundOscDst = this.baseSoundOsc.toDestination();
        this.baseSoundOscDst.volume.value = -25;
        this.baseSoundOscDst.start();

        Tone.Transport.bpm.value = 115;
        Tone.Transport.stop();

        this.#initTweakpane();
    }

    onLeafGrow(ndx) {
        if (Tone.context.state !== 'running') 
            Tone.context.resume();

        if (ndx % 5 != 0) return;

        //this.bell.triggerAttackRelease(2 + ndx * 5, '8n');
    }

    onLeafWither() {
        this.bell.triggerAttackRelease(100, '8n');
    }

    onPlantGrow() {
        //this.bell.triggerAttackRelease(70, '2m');
        const ndx = Math.floor(Math.random() * this.baseSoundsOscFreq.length);
        this.baseSoundOsc.frequency.rampTo(this.baseSoundsOscFreq[ndx], 0.2);
    }

    #initTweakpane() {
        if (this.pane) {
            const audioFolder = this.pane.addFolder({ title: 'audio' });

            const playBtn = audioFolder.addButton({ title: 'play' });
            playBtn.on('click', () => Tone.Transport.start());

            const stopBtn = audioFolder.addButton({ title: 'stop' });
            stopBtn.on('click', () => Tone.Transport.stop());
        }
    }

}