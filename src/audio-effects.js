import * as Tone from 'tone'

export class AudioEffects {

    MAJOR_SCALE = [0,2,4,5,7,9,11,12];
    NATURAL_MINOR_SCALE = [0,2,3,5,7,8,10,12];
    MIDI_NUM_NAMES = ["C_1", "C#_1", "D_1", "D#_1", "E_1", "F_1", "F#_1", "G_1", "G#_1", "A_1", "A#_1", "B_1",
                "C0", "C#0", "D0", "D#0", "E0", "F0", "F#0", "G0", "G#0", "A0", "A#0", "B0",
                "C1", "C#1", "D1", "D#1", "E1", "F1", "F#1", "G1", "G#1", "A1", "A#1", "B1",
                "C2", "C#2", "D2", "D#2", "E2", "F2", "F#2", "G2", "G#2", "A2", "A#2", "B2",
                "C3", "C#3", "D3", "D#3", "E3", "F3", "F#3", "G3", "G#3", "A3", "A#3", "B3",
                "C4", "C#4", "D4", "D#4", "E4", "F4", "F#4", "G4", "G#4", "A4", "A#4", "B4",
                "C5", "C#5", "D5", "D#5", "E5", "F5", "F#5", "G5", "G#5", "A5", "A#5", "B5",
                "C6", "C#6", "D6", "D#6", "E6", "F6", "F#6", "G6", "G#6", "A6", "A#6", "B6",
                "C7", "C#7", "D7", "D#7", "E7", "F7", "F#7", "G7", "G#7", "A7", "A#7", "B7",
                "C8", "C#8", "D8", "D#8", "E8", "F8", "F#8", "G8", "G#8", "A8", "A#8", "B8",
                "C9", "C#9", "D9", "D#9", "E9", "F9", "F#9", "G9"];
    MELODY_KEY_NOTE = 59; // middle B

    majChordIntervals = [0, 4, 7];
    minChordIntervals = [0, 3, 7];
    maj7ChordIntervals = [0, 4, 7, 11];
    min7ChordIntervals = [0, 3, 7, 10];

    melodyNoteIntervals = [];
    randomNotesBuffer = [];
    randomWalkIndex = 12;
    
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
        //this.baseSoundOscDst.start();

        // double the melody scale notes
        const scale = this.MAJOR_SCALE;
        this.melodyInstrument = [...scale];
        for(let i=1; i<scale.length; ++i) {
            this.melodyNoteIntervals.push(scale[i] + 12);
            this.melodyNoteIntervals.push(scale[i] + 24);
        }
        this.melodyInstrument = new Tone.FMSynth().toDestination();

        this.harmonyInstrument = new Tone.PolySynth(
            Tone.MonoSynth, {
                volume: -8,
                oscillator: {
                    type: "square8"
                },
                envelope: {
                    attack: .05,
                    decay: 0.3,
                    sustain: 0.4,
                    release: 0.8,
                },
                /*filterEnvelope: {
                    attack: .001,
                    decay: 0.7,
                    sustain: 0.1,
                    release: 0.8,
                    baseFrequency: 300,
                    octaves: 4
                }*/
            }
        ).toDestination();
        const rootNote = this.MELODY_KEY_NOTE;
        const chordProgression = [
            ...this.min7ChordIntervals.map(i => [0, this.MIDI_NUM_NAMES[i + rootNote]]),
            ...this.maj7ChordIntervals.map(i => ['1:0:0', this.MIDI_NUM_NAMES[i + rootNote - 2]]),
            ...this.minChordIntervals.map(i => ['2:0:0', this.MIDI_NUM_NAMES[i + rootNote - 5]]),
            ...this.majChordIntervals.map(i => ['3:0:0', this.MIDI_NUM_NAMES[i + rootNote - 7]])
        ];

        this.harmonyPart = new Tone.Part((time, chord) => {
            this.harmonyInstrument.triggerAttackRelease(chord, "1n", time);
        }, chordProgression ).start(0);
        this.harmonyPart.loop = true;
        this.harmonyPart.loopEnd = '4:0:0';


        Tone.Transport.bpm.value = 60;
        Tone.Transport.stop();

        this.#initTweakpane();
    }

    onLeafGrow(ndx) {
        if (Tone.context.state !== 'running') {
            Tone.context.resume();
            return;
        }

        if (ndx % 3 != 0) return;

        //this.bell.triggerAttackRelease(2 + ndx * 5, '8n');
        this.#playRandomMelodyNote();
    }

    onLeafWither() {
        //this.bell.triggerAttackRelease(100, '8n');
    }

    onPlantGrow() {
        //this.bell.triggerAttackRelease(70, '2m');
        const ndx = Math.floor(Math.random() * this.baseSoundsOscFreq.length);
        this.baseSoundOsc.frequency.rampTo(this.baseSoundsOscFreq[ndx], 0.2);
    }

    #playRandomMelodyNote() {
        if (this.randomNotesBuffer.length === 0) {
            // fill with random notes
            for (let i = 0; i < this.melodyNoteIntervals.length; i++) {
                this.randomNotesBuffer.push(i);
            }
        }

        // random choose an index, and then remove it so it's not chosen again
        const ndx = this.randomNotesBuffer.splice(Math.floor(this.randomNotesBuffer.length * Math.random()), 1)[0];
        const note = this.MELODY_KEY_NOTE - 24 + this.melodyNoteIntervals[ndx];


        /*const step = Math.random() < .5 ? -1 : 1;
        this.randomWalkIndex += step;
        this.randomWalkIndex = Math.max(0, Math.min(this.randomWalkIndex, this.melodyNoteIntervals.length - 1));
        const note = this.MELODY_KEY_NOTE + this.melodyNoteIntervals[this.randomWalkIndex];*/

    
       // this.melodyInstrument.triggerAttackRelease(this.MIDI_NUM_NAMES[note], '8n');
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