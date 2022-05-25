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

    _kick = true;
    _hiHat = true;
    _harmony = true;
    _melody = true;
    _trap = true;
    
    constructor(pane) {
        this.pane = pane;

        const rootNote = this.MELODY_KEY_NOTE;


        const compressor = new Tone.Compressor().toDestination();
        console.log(Tone.Compressor.getDefaults());
        const destination = compressor;


        this.melodyInstrument = new Tone.PluckSynth({
            volume: -1,
            resonance: .95
        });
        const reverb = new Tone.Reverb(8);

        this.melodyInstrument.chain(reverb, destination);

        const chordNotes = [
            ...this.min7ChordIntervals.map(i => this.MIDI_NUM_NAMES[i + rootNote + 24]),
            ...this.maj7ChordIntervals.map(i => this.MIDI_NUM_NAMES[i + rootNote + 24 - 2]),
            ...this.minChordIntervals.map(i => this.MIDI_NUM_NAMES[i + rootNote + 24 - 5]),
            ...this.majChordIntervals.map(i => this.MIDI_NUM_NAMES[i + rootNote + 36 - 7])
        ];
        this.melodyPattern = new Tone.Pattern((time, note) => {
            this.melodyInstrument.triggerAttackRelease(note, '1n', time);
        }, chordNotes, 'randomOnce').start('1:0:0');
        this.melodyPattern.loop = true;




        this.harmonyInstrument = new Tone.PolySynth(
            Tone.MonoSynth, {
                volume: -22,
                oscillator: {
                    type: 'sawtooth'
                },
                envelope: {
                    attack: '0:4:0',
                    attackCurve: 'exponential',
                    decay: '0:0:0',
                    sustain: 0.8,
                    release: 3
                },
                filterEnvelope: {
                    attack: .0001,
                    decay: 0.7,
                    sustain: 0.1,
                    release: 0.9,
                    baseFrequency: 300,
                    octaves: 4
                }
            }
        ).connect(destination);
        const chordProgression = [
            ...this.min7ChordIntervals.map(i => [0, this.MIDI_NUM_NAMES[i + rootNote]]),
            ...this.maj7ChordIntervals.map(i => ['1:0:0', this.MIDI_NUM_NAMES[i + rootNote - 2]]),
            ...this.minChordIntervals.map(i => ['2:0:0', this.MIDI_NUM_NAMES[i + rootNote - 5]]),
            ...this.majChordIntervals.map(i => ['3:0:0', this.MIDI_NUM_NAMES[i + rootNote - 7]])
        ];
        this.harmonyPart = new Tone.Part((time, chord) => {
            this.harmonyInstrument.triggerAttackRelease(chord, '0:3:3', time);
        }, chordProgression ).start('2:0:0');
        this.harmonyPart.loop = true;
        this.harmonyPart.loopEnd = '4:0:0';







        const filter = new Tone.Filter(100, 'lowpass');
        const freeverb = new Tone.Freeverb({
            wet: 0.2,
            roomSize: 0.95,
            dampening: 100
        });
        this.kickInstrument = new Tone.MembraneSynth({
            volume: -1,
            envelope: {
                attack: 0.005,
                decay: 0.8,
                sustain: 0.1
            },
            octaves: 5
        });

        this.kickInstrument.chain(filter, freeverb, destination);

        this.kickPart = new Tone.Part((time, notes) => {
            this.kickInstrument.triggerAttackRelease(notes, '8n', time);
        }, [[0, 'D3']] ).start(0);
        this.kickPart.loop = true;
        this.kickPart.loopEnd = '0:2:0';







        var lowPass = new Tone.Filter({
            frequency: 1000,
        }).connect(destination);
    
        this.hiHatInstrument = new Tone.NoiseSynth({
            volume : -14,
            filter: {
                Q: 1
            },
            envelope: {
                attack: 0.01,
                decay: 0.15
            },
            filterEnvelope: {
                attack: 0.01,
                decay: 0.03,
                baseFrequency: 4000,
                octaves: -2.5,
                exponent: 4,
    
            }
        }).connect(lowPass);

        this.hiHatPart = new Tone.Part((time, notes) => {
            this.hiHatInstrument.triggerAttack(time);
        }, [
            '0:0:0',
            '0:1:0',
            '0:1:3',
            '0:1:2',
            '0:2:1',
            '0:3:0'
        ] ).start('4:0:0');
        this.hiHatPart.loop = true;
        this.hiHatPart.loopEnd = '1:0:0';

        var trapLowPass = new Tone.Filter({
            frequency: 200,
            type: 'lowpass'
        }).connect(destination);
        this.trapInstrument = new Tone.NoiseSynth({
            volume : -24,
            noise: {
                type: 'pink'
            }
        }).connect(trapLowPass).connect(destination);
        this.trapPart = new Tone.Part((time, notes) => {
            this.trapInstrument.triggerAttack(time);
        }, [
            '0:0:0',
            '0:0:1',
            '0:0:2',
            '0:0:3',
            '0:0:4',
            '0:2:0',
            '0:3:2',
        ] ).start('10:0:0');
        this.trapPart.loop = true;
        this.trapPart.loopEnd = '4:0:0';
        this.trapPart.playbackRate = 4;

        Tone.Transport.bpm.value = 60;
        Tone.Transport.stop();

        this.#initTweakpane();
    }

    onLeafGrow(ndx) {
    }

    onLeafWither() {
    }

    onPlantGrowStart() {
        this.melodyPattern.playbackRate = 2;
    } 
    
    onPlantGrowEnd() {
        this.melodyPattern.playbackRate = .5;
    }

    start() {
        setTimeout(() => Tone.Transport.start(), 500);
    }

    set kick(value) {
        this._kick = value;
        this.#updatePart(this.kickPart, this._kick);
    }

    get kick() {
        return this._kick;
    }

    set melody(value) {
        this._melody = value;
        this.#updatePart(this.melodyPattern, this._melody);
    }

    get melody() {
        return this._melody;
    }

    set harmony(value) {
        this._harmony = value;
        this.#updatePart(this.harmonyPart, this._harmony);
    }

    get harmony() {
        return this._harmony;
    }

    set hiHat(value) {
        this._hiHat = value;
        this.#updatePart(this.hiHatPart, this._hiHat);
    }

    get hiHat() {
        return this._hiHat;
    }

    set trap(value) {
        this._trap = value;
        this.#updatePart(this.trapPart, this._trap);
    }

    get trap() {
        return this._trap;
    }

    #updatePart(part, play) {
        if (play) 
            part.start(Tone.now());
        else 
            part.stop();
    }

    #initTweakpane() {
        if (this.pane) {
            const audioFolder = this.pane.addFolder({ title: 'audio' });

            const playBtn = audioFolder.addButton({ title: 'play' });
            playBtn.on('click', () =>this.start());

            const stopBtn = audioFolder.addButton({ title: 'stop' });
            stopBtn.on('click', () => Tone.Transport.stop());

            const volumeSlider = audioFolder.addBlade({
                view: 'slider',
                label: 'volume',
                min: -60,
                max: 0,
                value: Tone.getDestination().volume.value,
            });
            volumeSlider.on('change', e => Tone.getDestination().volume.value = e.value);

            audioFolder.addInput(this, 'kick');
            audioFolder.addInput(this, 'melody');
            audioFolder.addInput(this, 'harmony');
            audioFolder.addInput(this, 'hiHat');
            audioFolder.addInput(this, 'trap');
        }
    }

}