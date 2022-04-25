import { mat3, mat4, quat, vec2, vec3 } from 'gl-matrix';
import { OrbitControl } from './utils/orbit-control';
import { createAndSetupTexture, createFramebuffer, createProgram, makeBuffer, makeVertexArray, resizeCanvasToDisplaySize, setFramebuffer } from './utils/webgl-utils';

import colorVertShaderSource from './shader/color.vert';
import colorFragShaderSource from './shader/color.frag';
import { ArcballControl } from './utils/arcball-control';
import { VesselGeometry } from './vessel-geometry';
import { Plant } from './plant';

export class Primavera {
    oninit;

    #time = 0;
    #frames = 0;
    #deltaTime = 0;
    #isDestroyed = false;

    camera = {
        matrix: mat4.create(),
        near: 90,
        far: 150,
        distance: 120,
        orbit: quat.create(),
        position: vec3.create(),
        rotation: vec3.create(),
        up: vec3.fromValues(0, 1, 0)
    };

    plantSettings = {
        showGuides: true
    }

    constructor(canvas, pane, oninit = null) {
        this.canvas = canvas;
        this.pane = pane;
        this.oninit = oninit;

        this.#init();
    }

    resize() {
        const gl = this.gl;

        const needsResize = resizeCanvasToDisplaySize(gl.canvas);
        
        if (needsResize) {
            gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
            this.#resizeTextures(gl);
        }
        
        this.#updateProjectionMatrix(gl);
    }

    run(time = 0) {
        this.fpsGraph.begin();

        this.#deltaTime = Math.min(32, time - this.#time);
        this.#time = time;
        this.#frames += this.#deltaTime / 16;

        if (this.#isDestroyed) return;

        this.control.update(this.#deltaTime);
        mat4.fromQuat(this.drawUniforms.worldMatrix, this.control.rotationQuat);

        // update the world inverse transpose
        mat4.invert(this.drawUniforms.worldInverseTransposeMatrix, this.drawUniforms.worldMatrix);
        mat4.transpose(this.drawUniforms.worldInverseTransposeMatrix, this.drawUniforms.worldInverseTransposeMatrix);

        this.plant.update(this.#frames);

        this.#render();

        this.fpsGraph.end();

        requestAnimationFrame((t) => this.run(t));
    }

    #render() {
        /** @type {WebGLRenderingContext} */
        const gl = this.gl;

        gl.clearColor(1, 1, 1, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        //this.#drawVessel(true);

        this.plant.render(this.drawUniforms, this.plantSettings.showGuides);

        this.#drawVessel(false);
    }

    destroy() {
        this.#isDestroyed = true;
    }

    #drawVessel(backSide) {
        /** @type {WebGLRenderingContext} */
        const gl = this.gl;

        gl.useProgram(this.colorProgram);

        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);

        let worldInverseTransposeMatrix = this.drawUniforms.worldInverseTransposeMatrix;

        if (backSide) {
            gl.cullFace(gl.FRONT);

            // flip the normals to draw the inside of the vessel
            worldInverseTransposeMatrix = mat4.scale(
                mat4.create(),
                this.drawUniforms.worldInverseTransposeMatrix,
                vec3.fromValues(-1, -1, -1));
        }

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        gl.uniformMatrix4fv(this.colorLocations.u_viewMatrix, false, this.drawUniforms.viewMatrix);
        gl.uniformMatrix4fv(this.colorLocations.u_projectionMatrix, false, this.drawUniforms.projectionMatrix);
        gl.uniform3f(this.colorLocations.u_cameraPosition, this.camera.position[0], this.camera.position[1], this.camera.position[2]);
        gl.uniformMatrix4fv(this.colorLocations.u_worldMatrix, false, this.drawUniforms.worldMatrix);
        gl.uniformMatrix4fv(this.colorLocations.u_worldInverseTransposeMatrix, false, worldInverseTransposeMatrix);
        gl.bindVertexArray(this.vesselVAO);
        gl.drawElements(gl.TRIANGLES, this.vesselBuffers.numElem, gl.UNSIGNED_SHORT, 0);

        gl.disable(gl.BLEND);
        gl.cullFace(gl.BACK);
    }

    #init() {
        this.gl = this.canvas.getContext('webgl2', { antialias: false, alpha: false });

        /** @type {WebGLRenderingContext} */
        const gl = this.gl;

        if (!gl) {
            throw new Error('No WebGL 2 context!')
        }

        ///////////////////////////////////  PROGRAM SETUP

        // setup programs
        this.colorProgram = createProgram(gl, [colorVertShaderSource, colorFragShaderSource], null, { a_position: 0, a_normal: 1, a_uv: 2 });

        // find the locations
        this.colorLocations = {
            a_position: gl.getAttribLocation(this.colorProgram, 'a_position'),
            a_normal: gl.getAttribLocation(this.colorProgram, 'a_normal'),
            a_uv: gl.getAttribLocation(this.colorProgram, 'a_uv'),
            u_worldMatrix: gl.getUniformLocation(this.colorProgram, 'u_worldMatrix'),
            u_viewMatrix: gl.getUniformLocation(this.colorProgram, 'u_viewMatrix'),
            u_projectionMatrix: gl.getUniformLocation(this.colorProgram, 'u_projectionMatrix'),
            u_worldInverseTransposeMatrix: gl.getUniformLocation(this.colorProgram, 'u_worldInverseTransposeMatrix'),
            u_cameraPosition: gl.getUniformLocation(this.colorProgram, 'u_cameraPosition')
        };
        
        // setup uniforms
        this.drawUniforms = {
            worldMatrix: mat4.create(),
            viewMatrix: mat4.create(),
            cameraMatrix: mat4.create(),
            projectionMatrix: mat4.create(),
            worldInverseTransposeMatrix: mat4.create()
        };

        /////////////////////////////////// GEOMETRY / MESH SETUP

        // create vessel VAO
        this.VESSEL_HEIGHT = 50;
        this.VESSEL_RADIUS = 20;
        this.VESSEL_BEVEL_RADIUS = 13;
        this.vesselGeometry = new VesselGeometry(this.VESSEL_HEIGHT, this.VESSEL_RADIUS, this.VESSEL_BEVEL_RADIUS);

        this.vesselBuffers = { 
            position: makeBuffer(gl, this.vesselGeometry.vertices, gl.STATIC_DRAW),
            normal: makeBuffer(gl, this.vesselGeometry.normals, gl.STATIC_DRAW),
            numElem: this.vesselGeometry.indices.length
        };
        this.vesselVAO = makeVertexArray(gl, [
            [this.vesselBuffers.position, this.colorLocations.a_position, 3],
            [this.vesselBuffers.normal, this.colorLocations.a_normal, 3]
        ], this.vesselGeometry.indices);

        // create the plant
        this.plant = new Plant(
            gl,
            this.VESSEL_HEIGHT, 
            this.VESSEL_RADIUS, 
            this.VESSEL_BEVEL_RADIUS,
            () => this.plant.generate(this.#frames)
        );
        this.plant.generate(this.#frames);

        /////////////////////////////////// FRAMEBUFFER SETUP

        // initial client dimensions
        const clientSize = vec2.fromValues(gl.canvas.clientWidth, gl.canvas.clientHeight);
        this.particleFBOSize = vec2.clone(clientSize);

        this.particleTexture = createAndSetupTexture(gl, gl.LINEAR, gl.LINEAR, gl.REPEAT, gl.REPEAT);
        gl.bindTexture(gl.TEXTURE_2D, this.particleTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.particleFBOSize[0], this.particleFBOSize[1], 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        this.particleFBO = createFramebuffer(gl, [this.particleTexture]);

        // init the pointer rotate control
        this.control = new ArcballControl(this.canvas);

        this.resize();

        //this.#initEnvMap();
        this.camera.position[2] = this.camera.distance;
        this.#updateCameraMatrix();
        this.#updateProjectionMatrix(gl);

        //this.#initOrbitControls();
        this.#initTweakpane();

        if (this.oninit) this.oninit(this);
    }

    #initEnvMap() {
        /** @type {WebGLRenderingContext} */
        const gl = this.gl;

        /*this.envMapTexture = createAndSetupTexture(gl, gl.LINEAR, gl.LINEAR, gl.MIRRORED_REPEAT, gl.MIRRORED_REPEAT);
        gl.bindTexture(gl.TEXTURE_2D, this.envMapTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 100, 500, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

        const img = new Image();
        img.src = new URL('./assets/studio024.jpg', import.meta.url);
        img.addEventListener('load', () => {
            gl.bindTexture(gl.TEXTURE_2D, this.envMapTexture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 100, 500, 0, gl.RGBA, gl.UNSIGNED_BYTE, img);
        });*/
    }

    #initOrbitControls() {
        this.control = new OrbitControl(this.canvas, this.camera, () => this.#updateCameraMatrix());
    }

    #resizeTextures(gl) {
        const clientSize = vec2.fromValues(gl.canvas.clientWidth, gl.canvas.clientHeight);
        this.particleFBOSize = vec2.clone(clientSize);
        
        // resize particle texture
        /*gl.bindTexture(gl.TEXTURE_2D, this.particleTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.particleFBOSize[0], this.particleFBOSize[1], 0, gl.RGBA, gl.UNSIGNED_BYTE, null);*/

        // reset bindings
        gl.bindRenderbuffer(gl.RENDERBUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    #updateCameraMatrix() {
        mat4.targetTo(this.camera.matrix, this.camera.position, [0, 0, 0], this.camera.up);
        mat4.invert(this.drawUniforms.viewMatrix, this.camera.matrix);
        mat4.copy(this.drawUniforms.cameraMatrix, this.camera.matrix);
    }

    #updateProjectionMatrix(gl) {
        const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
        mat4.perspective(this.drawUniforms.projectionMatrix, Math.PI / 4, aspect, this.camera.near, this.camera.far);
    }

    #initTweakpane() {
        if (this.pane) {
            const maxFar = 200;

            this.fpsGraph = this.pane.addBlade({
                view: 'fpsgraph',
                label: 'fps',
                lineCount: 1,
                maxValue: 120,
                minValue: 0
            });

            const cameraFolder = this.pane.addFolder({ title: 'Camera' });
            this.#createTweakpaneSlider(cameraFolder, this.camera, 'near', 'near', 1, maxFar, null, () => this.#updateProjectionMatrix(this.gl));
            this.#createTweakpaneSlider(cameraFolder, this.camera, 'far', 'far', 1, maxFar, null, () => this.#updateProjectionMatrix(this.gl));

            /*const particlesFolder = this.pane.addFolder({ title: 'Particles' });
            this.#createTweakpaneSlider(particlesFolder, this.particles.settings, 'velocity', 'velocity', 0, 10, null);
            this.#createTweakpaneSlider(particlesFolder, this.particles.settings, 'curl', 'curl', 0, 10, null);
            this.#createTweakpaneSlider(particlesFolder, this.particles.settings, 'noise', 'noise', 0, 10, null);

            const refractionFolder = this.pane.addFolder({ title: 'Refraction' });
            this.#createTweakpaneSlider(refractionFolder, this.refractionSettings, 'strength', 'strength', 0, 1, null);
            this.#createTweakpaneSlider(refractionFolder, this.refractionSettings, 'dispersion', 'dispersion', 0, 10, null);*/

            const plantFolder = this.pane.addFolder({ title: 'Plant' });
            plantFolder.addInput(this.plantSettings, 'showGuides', { label: 'guides' });
            const plantGenerateBtn = plantFolder.addButton({ title: 'generate' });
            plantGenerateBtn.on('click', () => this.plant.generate(this.#frames));
        }
    }

    #createTweakpaneSlider(folder, obj, propName, label, min, max, stepSize = null, callback) {
        const slider = folder.addBlade({
            view: 'slider',
            label,
            min,
            max,
            step: stepSize,
            value: obj[propName],
        });
        slider.on('change', e => {
            obj[propName] = e.value;
            if(callback) callback();
        });
    }
}
