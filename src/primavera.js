import { mat3, mat4, quat, vec2, vec3 } from 'gl-matrix';
import { createAndSetupTexture, createFramebuffer, createProgram, makeBuffer, makeVertexArray, resizeCanvasToDisplaySize, setFramebuffer } from './utils/webgl-utils';
import { ArcballControl } from './utils/arcball-control';
import { VesselGeometry } from './vessel-geometry';
import { Plant } from './plant';

import vesselVertShaderSource from './shader/vessel.vert';
import vesselFragShaderSource from './shader/vessel.frag';
import deltaDepthVertShaderSource from './shader/delta-depth.vert';
import deltaDepthFragShaderSource from './shader/delta-depth.frag';
import blurVertShaderSource from './shader/blur.vert';
import blurFragShaderSource from './shader/blur.frag';
import titleVertShaderSource from './shader/title.vert';
import titleFragShaderSource from './shader/title.frag';
import { AudioEffects } from './audio-effects';

export class Primavera {
    oninit;

    #time = 0;
    #frames = 0;
    #deltaTime = 0;
    #isDestroyed = false;

    camera = {
        matrix: mat4.create(),
        near: 60,
        far: 155,
        distance: 100,
        orbit: quat.create(),
        position: vec3.create(),
        rotation: vec3.create(),
        up: vec3.fromValues(0, 1, 0)
    };

    animate = false;

    plantSettings = {
        showGuides: false
    }

    constructor(canvas, pane, oninit = null) {
        this.canvas = canvas;
        this.pane = pane;
        this.oninit = oninit;
    }

    start() {
        this.#init();
        this.animate = true;
        this.audioEffects.start();
    }

    resize() {
        const gl = this.gl;

        const needsResize = resizeCanvasToDisplaySize(gl.canvas);
        
        if (needsResize) {
            gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
            this.#resizeTextures(gl);
        }

        this.blurScale = gl.canvas.clientHeight / 500;
        
        this.#updateProjectionMatrix(gl);
    }

    run(time = 0) {
        if(this.fpsGraph) this.fpsGraph.begin();

        this.#deltaTime = Math.min(32, time - this.#time);
        this.#time = time;

        if (this.animate)
            this.#frames += this.#deltaTime / 16;

        if (this.#isDestroyed) return;

        this.control.update(this.#deltaTime);
        mat4.fromQuat(this.drawUniforms.worldMatrix, this.control.rotationQuat);

        // update the world inverse transpose
        mat4.invert(this.drawUniforms.worldInverseTransposeMatrix, this.drawUniforms.worldMatrix);
        mat4.transpose(this.drawUniforms.worldInverseTransposeMatrix, this.drawUniforms.worldInverseTransposeMatrix);

        // update the invers projection matrix
        mat4.invert(this.drawUniforms.inversProjectionMatrix, this.drawUniforms.projectionMatrix);

        this.plant.update(this.#frames);

        this.#render();

        if(this.fpsGraph) this.fpsGraph.end();

        requestAnimationFrame((t) => this.run(t));
    }

    #render() {
        /** @type {WebGLRenderingContext} */
        const gl = this.gl;

        // draw plant and title ribbon color and depth
        setFramebuffer(gl, this.plantFBO, this.drawBufferSize[0], this.drawBufferSize[1]);
        gl.clearColor(1, 1, 1, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        //this.#renderTitleRibbon();
        this.plant.render(this.drawUniforms, this.plantSettings.showGuides);
        setFramebuffer(gl, null, this.drawBufferSize[0], this.drawBufferSize[1]);

        // draw the delta depth texture
        setFramebuffer(gl, this.deltaDepthFBO, this.drawBufferSize[0], this.drawBufferSize[1]);
        gl.useProgram(this.deltaDepthProgram);
        gl.clearColor(1, 1, 1, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.plantColorTexture);
        gl.uniform1i(this.deltaDepthLocations.u_colorTexture, 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.plantDepthTexture);
        gl.uniform1i(this.deltaDepthLocations.u_depthTexture, 1);
        gl.uniformMatrix4fv(this.deltaDepthLocations.u_viewMatrix, false, this.drawUniforms.viewMatrix);
        gl.uniformMatrix4fv(this.deltaDepthLocations.u_projectionMatrix, false, this.drawUniforms.projectionMatrix);
        gl.uniformMatrix4fv(this.deltaDepthLocations.u_inversProjectionMatrix, false, this.drawUniforms.inversProjectionMatrix);
        gl.uniformMatrix4fv(this.deltaDepthLocations.u_worldMatrix, false, this.drawUniforms.worldMatrix);
        gl.bindVertexArray(this.vesselVAO);
        gl.drawElements(gl.TRIANGLES, this.vesselBuffers.numElem, gl.UNSIGNED_SHORT, 0);
        setFramebuffer(gl, null, this.drawBufferSize[0], this.drawBufferSize[1]);

        // horizontal blur pass
        setFramebuffer(gl, this.hBlurFBO, this.drawBufferSize[0], this.drawBufferSize[1]);
        this.#blurPass(this.deltaDepthColorTexture);
        setFramebuffer(gl, null, this.drawBufferSize[0], this.drawBufferSize[1]);

        // vertical blur pass
        setFramebuffer(gl, this.vBlurFBO, this.drawBufferSize[0], this.drawBufferSize[1]);
        this.#blurPass(this.hBlurTexture, true);
        setFramebuffer(gl, null, this.drawBufferSize[0], this.drawBufferSize[1]);

        // final composition pass with the vessel front surface
        gl.clearColor(1, 1, 1, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        this.#renderTitleRibbon();
        this.#renderVessel(false);
    }

    destroy() {
        this.#isDestroyed = true;
    }

    #blurPass(inTexture, vertical = false) {
        /** @type {WebGLRenderingContext} */
        const gl = this.gl;

        gl.useProgram(this.blurProgram);
        gl.clearColor(1, 1, 1, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, inTexture);
        gl.uniform1i(this.blurLocations.u_colorTexture, 0);
        if (vertical)
            gl.uniform2f(this.blurLocations.u_direction, 0, 1);
        else
            gl.uniform2f(this.blurLocations.u_direction, 1, 0);

        gl.uniform1f(this.blurLocations.u_scale, this.blurScale);
        gl.bindVertexArray(this.quadVAO);
        gl.drawArrays(gl.TRIANGLES, 0, this.quadBuffers.numElem);
    }

    #renderVessel(backSide, depthOnly = false) {
        /** @type {WebGLRenderingContext} */
        const gl = this.gl;

        gl.useProgram(this.vesselProgram);

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

        if (!depthOnly) {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.vBlurTexture);
            gl.uniform1i(this.vesselLocations.u_colorTexture, 0);
        }

        gl.uniformMatrix4fv(this.vesselLocations.u_viewMatrix, false, this.drawUniforms.viewMatrix);
        gl.uniformMatrix4fv(this.vesselLocations.u_projectionMatrix, false, this.drawUniforms.projectionMatrix);
        gl.uniform3f(this.vesselLocations.u_cameraPosition, this.camera.position[0], this.camera.position[1], this.camera.position[2]);
        gl.uniformMatrix4fv(this.vesselLocations.u_worldMatrix, false, this.drawUniforms.worldMatrix);
        gl.uniformMatrix4fv(this.vesselLocations.u_worldInverseTransposeMatrix, false, worldInverseTransposeMatrix);
        gl.bindVertexArray(this.vesselVAO);
        gl.drawElements(gl.TRIANGLES, this.vesselBuffers.numElem, gl.UNSIGNED_SHORT, 0);

        gl.cullFace(gl.BACK);
    }

    #renderTitleRibbon() {
        /** @type {WebGLRenderingContext} */
        const gl = this.gl;

        gl.useProgram(this.titleProgram);

        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.titleTexture);
        gl.uniform1i(this.titleLocations.u_titleTexture, 0);
        gl.uniformMatrix4fv(this.titleLocations.u_viewMatrix, false, this.drawUniforms.viewMatrix);
        gl.uniformMatrix4fv(this.titleLocations.u_projectionMatrix, false, this.drawUniforms.projectionMatrix);
        gl.uniformMatrix4fv(this.titleLocations.u_worldMatrix, false, mat4.create());
        gl.uniform1f(this.titleLocations.u_frames, this.#frames);
        gl.bindVertexArray(this.titleRibbonVAO);
        gl.drawElements(gl.TRIANGLES, this.titleRibbonBuffers.numElem, gl.UNSIGNED_SHORT, 0);
    }

    #init() {
        this.gl = this.canvas.getContext('webgl2', { antialias: false, alpha: false });

        /** @type {WebGLRenderingContext} */
        const gl = this.gl;

        if (!gl) {
            throw new Error('No WebGL 2 context!')
        }

        if (!gl.getExtension("EXT_color_buffer_float")) {
            console.error("FLOAT color buffer not available");
            document.body.innerHTML = "This example requires EXT_color_buffer_float which is unavailable on this system."
        }

        ///////////////////////////////////  PROGRAM SETUP

        // setup programs
        this.deltaDepthProgram = createProgram(gl, [deltaDepthVertShaderSource, deltaDepthFragShaderSource], null, { a_position: 0 });
        this.blurProgram = createProgram(gl, [blurVertShaderSource, blurFragShaderSource], null, { a_position: 0 });
        this.vesselProgram = createProgram(gl, [vesselVertShaderSource, vesselFragShaderSource], null, { a_position: 0, a_normal: 1, a_uv: 2 });
        this.titleProgram = createProgram(gl, [titleVertShaderSource, titleFragShaderSource], null, { a_position: 0, a_uv: 1 });

        // find the locations
        this.deltaDepthLocations = {
            a_position: gl.getAttribLocation(this.deltaDepthProgram, 'a_position'),
            u_worldMatrix: gl.getUniformLocation(this.deltaDepthProgram, 'u_worldMatrix'),
            u_viewMatrix: gl.getUniformLocation(this.deltaDepthProgram, 'u_viewMatrix'),
            u_projectionMatrix: gl.getUniformLocation(this.deltaDepthProgram, 'u_projectionMatrix'),
            u_inversProjectionMatrix: gl.getUniformLocation(this.deltaDepthProgram, 'u_inversProjectionMatrix'),
            u_colorTexture: gl.getUniformLocation(this.deltaDepthProgram, 'u_colorTexture'),
            u_depthTexture: gl.getUniformLocation(this.deltaDepthProgram, 'u_depthTexture')
        };
        this.blurLocations = {
            a_position: gl.getAttribLocation(this.blurProgram, 'a_position'),
            u_colorTexture: gl.getUniformLocation(this.blurProgram, 'u_colorTexture'),
            u_scale: gl.getUniformLocation(this.blurProgram, 'u_scale'),
            u_direction: gl.getUniformLocation(this.blurProgram, 'u_direction')
        };
        this.vesselLocations = {
            a_position: gl.getAttribLocation(this.vesselProgram, 'a_position'),
            a_normal: gl.getAttribLocation(this.vesselProgram, 'a_normal'),
            a_uv: gl.getAttribLocation(this.vesselProgram, 'a_uv'),
            u_worldMatrix: gl.getUniformLocation(this.vesselProgram, 'u_worldMatrix'),
            u_viewMatrix: gl.getUniformLocation(this.vesselProgram, 'u_viewMatrix'),
            u_projectionMatrix: gl.getUniformLocation(this.vesselProgram, 'u_projectionMatrix'),
            u_worldInverseTransposeMatrix: gl.getUniformLocation(this.vesselProgram, 'u_worldInverseTransposeMatrix'),
            u_cameraPosition: gl.getUniformLocation(this.vesselProgram, 'u_cameraPosition'),
            u_colorTexture: gl.getUniformLocation(this.vesselProgram, 'u_colorTexture')
        };
        this.titleLocations = {
            a_position: gl.getAttribLocation(this.titleProgram, 'a_position'),
            a_uv: gl.getAttribLocation(this.titleProgram, 'a_uv'),
            u_worldMatrix: gl.getUniformLocation(this.titleProgram, 'u_worldMatrix'),
            u_viewMatrix: gl.getUniformLocation(this.titleProgram, 'u_viewMatrix'),
            u_projectionMatrix: gl.getUniformLocation(this.titleProgram, 'u_projectionMatrix'),
            u_titleTexture: gl.getUniformLocation(this.titleProgram, 'u_titleTexture'),
            u_frames: gl.getUniformLocation(this.titleProgram, 'u_frames')
        };
        
        // setup uniforms
        this.drawUniforms = {
            worldMatrix: mat4.create(),
            viewMatrix: mat4.create(),
            cameraMatrix: mat4.create(),
            projectionMatrix: mat4.create(),
            inversProjectionMatrix: mat4.create(),
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
            [this.vesselBuffers.position, this.vesselLocations.a_position, 3],
            [this.vesselBuffers.normal, this.vesselLocations.a_normal, 3]
        ], this.vesselGeometry.indices);

        // create quad VAO
        const quadPositions = [-1, -1, 3, -1, -1, 3];
        this.quadBuffers = {
            position: makeBuffer(gl, new Float32Array(quadPositions), gl.STATIC_DRAW),
            numElem: quadPositions.length / 2
        };
        this.quadVAO = makeVertexArray(gl, [[this.quadBuffers.position, 0, 2]]);

        // create the plant
        this.plant = new Plant(
            gl,
            this.VESSEL_HEIGHT, 
            this.VESSEL_RADIUS, 
            this.VESSEL_BEVEL_RADIUS,
            () => this.plant.generate(this.#frames)
        );
        this.plant.generate(this.#frames);

        // create the title ribbon
        this.titleRibbonGeometry = this.#createTitleRibbonGeometry(50, 8, 60, 1);
        this.titleRibbonBuffers = {
            position: makeBuffer(gl, new Float32Array(this.titleRibbonGeometry.vertices), gl.STATIC_DRAW),
            uv: makeBuffer(gl, new Float32Array(this.titleRibbonGeometry.uvs), gl.STATIC_DRAW),
            numElem: this.titleRibbonGeometry.count
        };
        this.titleRibbonVAO = makeVertexArray(gl, [
            [this.titleRibbonBuffers.position, this.titleLocations.a_position, 3],
            [this.titleRibbonBuffers.uv, this.titleLocations.a_uv, 2]
        ], this.titleRibbonGeometry.indices);

        /////////////////////////////////// FRAMEBUFFER SETUP

        // initial client dimensions
        const clientSize = vec2.fromValues(gl.canvas.clientWidth, gl.canvas.clientHeight);
        this.drawBufferSize = vec2.clone(clientSize);

        // init the plant framebuffer and its textures
        this.plantColorTexture = this.#initFBOTexture(gl, gl.RGBA, clientSize, gl.LINEAR, gl.LINEAR, gl.REPEAT, gl.REPEAT);
        this.plantDepthTexture = this.#initFBOTexture(gl, gl.DEPTH_COMPONENT32F, clientSize, gl.NEAREST, gl.NEAREST, gl.REPEAT, gl.REPEAT);
        this.plantFBO = createFramebuffer(gl, [this.plantColorTexture], this.plantDepthTexture);

        // init plant + vessel delta depth framebuffer and its textures (contains the CoC within the alpha channel)
        this.deltaDepthColorTexture = this.#initFBOTexture(gl, gl.RGBA, clientSize, gl.LINEAR, gl.LINEAR, gl.REPEAT, gl.REPEAT);
        this.deltaDepthFBO = createFramebuffer(gl, [this.deltaDepthColorTexture]);

        // init the blur framebuffer and textures
        this.hBlurTexture = this.#initFBOTexture(gl, gl.RGBA, clientSize, gl.LINEAR, gl.LINEAR, gl.REPEAT, gl.REPEAT);
        this.vBlurTexture = this.#initFBOTexture(gl, gl.RGBA, clientSize, gl.LINEAR, gl.LINEAR, gl.REPEAT, gl.REPEAT);
        this.hBlurFBO = createFramebuffer(gl, [this.hBlurTexture]);
        this.vBlurFBO = createFramebuffer(gl, [this.vBlurTexture]);

        // init the pointer rotate control
        this.control = new ArcballControl(this.canvas);

        this.resize();

        this.#createTitleImageTexture();

        //this.#initEnvMap();
        this.camera.position[2] = this.camera.distance;
        this.#updateCameraMatrix();
        this.#updateProjectionMatrix(gl);

        this.initTweakpane();

        this.audioEffects = new AudioEffects(this.pane);
        this.plant.onLeafGrow = (leafIndex) => this.audioEffects.onLeafGrow(leafIndex);
        this.plant.onPlantGrowStart = () => this.audioEffects.onPlantGrowStart();
        this.plant.onPlantGrowEnd = () => this.audioEffects.onPlantGrowEnd();

        if (this.oninit) this.oninit(this);
    }

    #initFBOTexture(gl, format, size, minFilter, magFilter, wrapS, wrapT) {
        const texture = createAndSetupTexture(gl, minFilter, magFilter, wrapS, wrapT);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        
        if (format === gl.RGBA)
            gl.texImage2D(gl.TEXTURE_2D, 0, format, size[0], size[1], 0, format, gl.UNSIGNED_BYTE, null);
        else if (format === gl.DEPTH_COMPONENT32F) 
            gl.texImage2D(gl.TEXTURE_2D, 0, format, size[0], size[1], 0, gl.DEPTH_COMPONENT, gl.FLOAT, null);
        else if(format === gl.RGBA16F)
            gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16F, size[0], size[1]);

        gl.bindTexture(gl.TEXTURE_2D, null);
        return texture;
    }

    #createTitleImageTexture() {
        /** @type {WebGLRenderingContext} */
        const gl = this.gl;

        this.titleTexture = createAndSetupTexture(gl, gl.LINEAR, gl.LINEAR, gl.REPEAT, gl.REPEAT);
        this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);
        this.gl.pixelStorei(this.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);

        const img = new Image();
        img.width = 2000;
        img.addEventListener('load', () => {
            gl.bindTexture(gl.TEXTURE_2D, this.titleTexture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
            gl.bindTexture(gl.TEXTURE_2D, null);
        });
        img.src = new URL('./assets/title.svg', import.meta.url);
    }

    #resizeTextures(gl) {
        const clientSize = vec2.fromValues(gl.canvas.clientWidth, gl.canvas.clientHeight);
        this.drawBufferSize = vec2.clone(clientSize);
        
        this.#resizeTexture(gl, this.plantColorTexture, gl.RGBA, clientSize);
        this.#resizeTexture(gl, this.plantDepthTexture, gl.DEPTH_COMPONENT32F, clientSize);
        this.#resizeTexture(gl, this.deltaDepthColorTexture, gl.RGBA, clientSize);
        this.#resizeTexture(gl, this.hBlurTexture, gl.RGBA, clientSize);
        this.#resizeTexture(gl, this.vBlurTexture, gl.RGBA, clientSize);

        // reset bindings
        gl.bindRenderbuffer(gl.RENDERBUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    #resizeTexture(gl, texture, format, size) {
        gl.bindTexture(gl.TEXTURE_2D, texture);

        if (format === gl.RGBA) 
            gl.texImage2D(gl.TEXTURE_2D, 0, format, size[0], size[1], 0, format, gl.UNSIGNED_BYTE, null);
        else if (format === gl.DEPTH_COMPONENT32F) 
            gl.texImage2D(gl.TEXTURE_2D, 0, format, size[0], size[1], 0, gl.DEPTH_COMPONENT, gl.FLOAT, null);

        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    #createTitleRibbonGeometry(r, h, rSegments, hSegments) {
        const dAlpha = (2 * Math.PI) / rSegments;
        const dy = h / hSegments;
        const count = rSegments * hSegments * 6;
        const vertices = [];
        const normals = [];
        const uvs = [];
        const indices = [];
        const wOff = rSegments + 1;
        const sy = -h / 2;

        for(let iy = 0; iy <= hSegments; ++iy) {
            for(let ix = 0; ix <= rSegments; ++ix) {
                let p = {
                    x: r * Math.sin(dAlpha * ix),
                    y: sy + dy * iy,
                    z: r * Math.cos(dAlpha * ix)
                };
                let n = {x: 0, y: 0, z: 1};

                vertices.push(p.x, p.y, p.z);
                normals.push(n.x, n.y, n.z);
                uvs.push(ix / rSegments, iy / hSegments);
            }
        }

        for(let iy = 0; iy < hSegments; ++iy) {
            for(let ix = 0; ix < rSegments; ++ix) {
                indices.push(
                    iy * wOff + ix,
                    (iy + 1) * wOff + ix + 1,
                    iy * wOff + ix + 1
                );
                indices.push(
                    (iy + 1) * wOff + ix + 1,
                    iy * wOff + ix,
                    (iy + 1) * wOff + ix
                );
            }
        }

        return {
            vertices,
            normals,
            uvs,
            indices,
            count
        };
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

    initTweakpane() {
        if (this.pane) {
            const maxFar = 200;

            this.fpsGraph = this.pane.addBlade({
                view: 'fpsgraph',
                label: 'fps',
                lineCount: 1,
                maxValue: 120,
                minValue: 0
            });

            this.pane.addInput(this, 'animate', { label: 'animate' });

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

            //const plantFolder = this.pane.addFolder({ title: 'Plant' });
            /*const plantGenerateBtn = plantFolder.addButton({ title: 'generate' });
            plantGenerateBtn.on('click', () => this.plant.generate(this.#frames));*/
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
