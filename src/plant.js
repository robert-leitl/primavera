import { mat4, vec2, vec3 } from "gl-matrix";
import { LeafGeometry } from "./leaf-geometry";
import { GeometryHelper } from "./utils/geometry-helper";
import { createAndSetupTexture, createProgram, makeBuffer, makeVertexArray } from "./utils/webgl-utils";

import leafVertShaderSource from './shader/leaf.vert';
import leafFragShaderSource from './shader/leaf.frag';
import { CubicBezier } from "./utils/cubic-bezier";
import { perlin } from "./utils/perlin";
import { easing } from "./utils/easing";

export class Plant {

    #STEM_SEGMENTS = 18;
    #LEAVES_PER_SEGMENT = 2;
    #LEAF_COUNT = this.#STEM_SEGMENTS * this.#LEAVES_PER_SEGMENT;

    leafInstances;

    constructor(
        context,
        vesselHeight,
        vesselRadius,
        vesselBevelRadius,
        animationDoneCallback = null
    ) {
        this.context = context;
        this.vesselHeight = vesselHeight;
        this.vesselRadius = vesselRadius;
        this.vesselBevelRadius = vesselBevelRadius;
        this.animationDoneCallback = animationDoneCallback;
        this.modelMatrix = mat4.translate(mat4.create(), mat4.create(), vec3.fromValues(0, -this.vesselHeight / 2, 0));

        /** @type {WebGLRenderingContext} */
        const gl = this.context;

        // setup programs
        this.leafProgram = createProgram(gl, [leafVertShaderSource, leafFragShaderSource], null, { a_position: 0, a_normal: 1, a_uv: 2 });

        // find the locations
        this.leafLocations = {
            a_position: gl.getAttribLocation(this.leafProgram, 'a_position'),
            a_normal: gl.getAttribLocation(this.leafProgram, 'a_normal'),
            a_uv: gl.getAttribLocation(this.leafProgram, 'a_uv'),
            a_instanceMatrix: gl.getAttribLocation(this.leafProgram, 'a_instanceMatrix'),
            u_worldMatrix: gl.getUniformLocation(this.leafProgram, 'u_worldMatrix'),
            u_viewMatrix: gl.getUniformLocation(this.leafProgram, 'u_viewMatrix'),
            u_projectionMatrix: gl.getUniformLocation(this.leafProgram, 'u_projectionMatrix'),
            u_worldInverseTransposeMatrix: gl.getUniformLocation(this.leafProgram, 'u_worldInverseTransposeMatrix'),
            u_cameraPosition: gl.getUniformLocation(this.leafProgram, 'u_cameraPosition'),
            u_gradientTexture: gl.getUniformLocation(this.leafProgram, 'u_gradientTexture')
        };

        // create leaf VAO
        this.leafGeometry = new LeafGeometry();

        this.leafBuffers = {
            position: makeBuffer(gl, this.leafGeometry.vertices, gl.STATIC_DRAW),
            normal: makeBuffer(gl, this.leafGeometry.normals, gl.STATIC_DRAW),
            uv: makeBuffer(gl, this.leafGeometry.uvs, gl.STATIC_DRAW),
            numElem: this.leafGeometry.indices.length
        };
        this.leafVAO = makeVertexArray(gl, [
            [this.leafBuffers.position, this.leafLocations.a_position, 3],
            [this.leafBuffers.normal, this.leafLocations.a_normal, 3],
            [this.leafBuffers.uv, this.leafLocations.a_uv, 2]
        ], this.leafGeometry.indices);

        // create leaf color gradient texture
        this.leafGradientTexture = createAndSetupTexture(gl, gl.LINEAR, gl.LINEAR, gl.MIRRORED_REPEAT, gl.MIRRORED_REPEAT);
        const data = new Uint8Array([
            221, 255, 185,
            134, 224, 69,
            114, 214, 80,
            134, 224, 69,
            134, 224, 69,
            211, 245, 144,
            225, 255, 174
        ]);
        gl.bindTexture(gl.TEXTURE_2D, this.leafGradientTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 7, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, data);

        this.#initLeafInstances();
    }

    generate(frames) {
        this.#generateStem();
        this.#generateLeaves(frames);
    }

    update(frames) {
        this.#updateLeaves(frames);
    }

    render(uniforms, drawGuides = false) {
        // center the plant vertically around the origin
        const modelMatrix = mat4.multiply(mat4.create(), uniforms.worldMatrix, this.modelMatrix);

        if (drawGuides) {
            this.geometryHelper.render(
                modelMatrix,
                uniforms.viewMatrix,
                uniforms.projectionMatrix,
                this.stemVAO,
                this.stemBuffers.numElem
            );
        }

        this.#renderLeaves(uniforms, modelMatrix);
    }

    #initLeafInstances() {
        /** @type {WebGLRenderingContext} */
        const gl = this.context;

        // init the leaf instances
        this.leafInstances = {
            matricesArray: new Float32Array(this.#LEAF_COUNT * 16),
            matrices: [],
            bindMatrices: [],
            buffer: gl.createBuffer(),
            animationParams: []
        }
        const numInstances = this.#LEAF_COUNT;
        for(let i = 0; i < numInstances; ++i) {
            const instanceMatrixArray = new Float32Array(this.leafInstances.matricesArray.buffer, i * 16 * 4, 16);
            instanceMatrixArray.set(mat4.create());
            this.leafInstances.matrices.push(instanceMatrixArray);
            this.leafInstances.bindMatrices.push(mat4.create());
        }

        gl.bindVertexArray(this.leafVAO);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.leafInstances.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.leafInstances.matricesArray.byteLength, gl.DYNAMIC_DRAW);
        const mat4AttribSlotCount = 4;
        const bytesPerMatrix = 16 * 4;
        for(let j = 0; j < mat4AttribSlotCount; ++j) {
            const loc = this.leafLocations.a_instanceMatrix + j;
            gl.enableVertexAttribArray(loc);
            gl.vertexAttribPointer(
                loc,
                4,
                gl.FLOAT,
                false,
                bytesPerMatrix, // stride, num bytes to advance to get to next set of values
                j * 4 * 4 // one row = 4 values each 4 bytes
            );
            gl.vertexAttribDivisor(loc, 1); // it sets this attribute to only advance to the next value once per instance
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindVertexArray(null);
    }

    #generateStem() {
        const h2 = this.vesselHeight / 2;
        let randAngle = Math.random() * 2 * Math.PI;
        // create the two anchor points at the bottom and top of the vessel
        const r1 = Math.random() * (this.vesselRadius - this.vesselBevelRadius);
        const a1 = vec3.fromValues(r1 * Math.cos(randAngle), 0, r1 * Math.sin(randAngle));
        randAngle = Math.random() * 2 * Math.PI;
        const a2 = vec3.fromValues(r1 * Math.cos(randAngle), this.vesselHeight, r1 * Math.sin(randAngle));

        // create the control points
        const capOffset = this.vesselBevelRadius * 0.1; // offset to the cap (top and bottom) of the vessel
        randAngle = Math.random() * 2 * Math.PI;
        let randHeight = Math.random() * (h2 - capOffset) + capOffset;
        const r2 = Math.random() * this.vesselRadius;
        const c1 = vec3.fromValues(r2 * Math.cos(randAngle), randHeight, r2 * Math.sin(randAngle));
        randAngle = Math.random() * 2 * Math.PI;
        randHeight = Math.random() * (h2 - capOffset) + h2;
        const r3 = Math.random() * this.vesselRadius;
        const c2 = vec3.fromValues(r3 * Math.cos(randAngle), randHeight, r3 * Math.sin(randAngle));

         /** @type {WebGLRenderingContext} */
         const gl = this.context;

        this.stemVertices = [];
        this.stemCurve = new CubicBezier(a1, c1, c2, a2);
        for(let i = 0; i <= this.#STEM_SEGMENTS; ++i) {
            const t = i / this.#STEM_SEGMENTS;
            this.stemVertices.push(...this.stemCurve.pointAt(this.stemCurve.map(t)));
        }

        this.stemVerticesData = new Float32Array(this.stemVertices);
        if (!this.stemVAO) {
            this.stemBuffers = { 
                position: makeBuffer(gl, this.stemVerticesData, gl.DYNAMIC_DRAW),
                numElem: this.stemVertices.length / 3
            };
            this.geometryHelper = new GeometryHelper(gl);
            this.stemVAO = makeVertexArray(gl, [
                [this.stemBuffers.position, this.geometryHelper.locations.a_position, 3]
            ]);
        } else {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.stemBuffers.position);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.stemVerticesData);
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
        }
    }

    #generateLeaves(frames) {
        /** @type {WebGLRenderingContext} */
        const gl = this.context;

        this.averageLeafDuration = 300; // frames
        this.leafStaggerDelay = 2.5;
        this.totalDuration = 0;

        const upRotation = mat4.rotateX(mat4.create(), mat4.create(), -Math.PI / 2);
        const numInstances = this.#LEAF_COUNT;
        const maxOffset = (this.vesselHeight / numInstances) * 0.015;
        const up = vec3.fromValues(0, 0, 1);
        const leafExtent = this.leafGeometry.extent;
        const extentLength = vec3.length(leafExtent);

        for(let i = 0; i < numInstances; ++i) {
            const t = i / (numInstances * 1.2) + 0.03;
            const bindMatrix = mat4.create();
            const matrix = mat4.create();
            const tOff = Math.random() * maxOffset - maxOffset / 2;

            // move the leaf to the point on the stem curve
            const mt = this.stemCurve.map(t + tOff);
            const p = this.stemCurve.pointAt(mt);
            mat4.translate(matrix, bindMatrix, p);

            // align the leaf tangentially to the stem curve
            const tangent = vec3.normalize(vec3.create(), this.stemCurve.velocityAt(mt));
            vec3.rotateY(up, up, vec3.create(), Math.random() * Math.PI * 2 - Math.PI);
            const rotation = mat4.targetTo(mat4.create(), vec3.create(), tangent, up);
            mat4.multiply(rotation, rotation, upRotation);
            mat4.multiply(matrix, matrix, rotation);

            // apply the matrix to the leaf extent vector
            const leafTipMatrix = mat4.multiply(mat4.create(), this.modelMatrix, matrix);
            const leafTip = vec3.transformMat4(vec3.create(), leafExtent, leafTipMatrix);
            const leafStart = vec3.transformMat4(vec3.create(), vec3.create(), leafTipMatrix);

            // ray march the vessel sdf to find the extimated max leaf extent point
            const rayDirection = vec3.normalize(vec3.create(), vec3.subtract(vec3.create(), leafTip, leafStart));
            const ray = vec3.clone(leafStart);
            for(let n = 0; n < 4; ++n) {
                const sd = -this.#getVesselSD(ray);
                vec3.add(ray, ray, vec3.scale(vec3.create(), rayDirection, sd));
            }
            
            // scale the leaf to the bounds of the vessel
            const boundLeafTipDir = vec3.subtract(vec3.create(), ray, leafStart);
            const scale = Math.min(1.2, vec3.length(boundLeafTipDir) / extentLength);
            mat4.scale(matrix, matrix, [scale, scale, scale]);

            // store the matrix as the leafs bind position
            this.leafInstances.bindMatrices[i] = matrix;

            // store the animation params
            const duration = Math.max(this.averageLeafDuration * 0.75, this.averageLeafDuration * scale);
            this.leafInstances.animationParams[i] = {
                duration
            };

            this.totalDuration = Math.max(this.totalDuration, duration + this.leafStaggerDelay * i);
        }

        // reset the growth animation
        this.startFrame = frames;
    }

    #updateLeaves(frames) {
        /** @type {WebGLRenderingContext} */
        const gl = this.context;

        const numInstances = this.#LEAF_COUNT;
        const progress = Math.min(this.totalDuration, frames - this.startFrame);
        const enterTransitionDuration = 0.2;
        const leaveTransitionDuration = 0.2;
        const jitterStrength = 0.5;
        
        for(let i = 0; i < numInstances; ++i) {
            const leafDuration = this.leafInstances.animationParams[i].duration;
            const off = i * this.leafStaggerDelay;
            // the t value (0...1) fro the whole animation of this leaf
            let t = Math.min(leafDuration, Math.max(0, progress - off) ) / leafDuration;

            // the scale t value (0...1): goes from 0 to 1 and then back from 1 to 0
            let scale = t;

            if (t <= enterTransitionDuration) {
                scale /= enterTransitionDuration;
            } else if (t > (1 - leaveTransitionDuration)) {
                scale = 1 - (t - (1 - leaveTransitionDuration)) / leaveTransitionDuration;
            } else {
                scale = 1;
            }
            scale = easing.easeOutCubic(scale);

            // timelapse jitter
            const size = (1 - scale*scale) * 0.8 + 0.2;  // jitter strength factor
            const freq = 10 * scale*scale*0.5 + 1;    // the jitter frequency factor
            const jitter = perlin.get(t * freq, t * freq) * jitterStrength * size;

            const bindMatrix = this.leafInstances.bindMatrices[i];
            const matrix = mat4.fromScaling(mat4.create(), vec3.fromValues(scale, scale, scale));
            mat4.rotateX(matrix, matrix, jitter);
            mat4.multiply(matrix, bindMatrix, matrix);
            

            // apply the matrix to the instance matrix
            mat4.copy(this.leafInstances.matrices[i], matrix);
        }

        // upload the instance matrix buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.leafInstances.buffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.leafInstances.matricesArray);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        // notify on animation done
        if (progress >= this.totalDuration && this.animationDoneCallback) {
            this.animationDoneCallback();
        }
    }

    #renderLeaves(uniforms, modelMatrix) {
        /** @type {WebGLRenderingContext} */
        const gl = this.context;

        gl.useProgram(this.leafProgram);

        gl.bindVertexArray(this.leafVAO);
        gl.uniformMatrix4fv(this.leafLocations.u_viewMatrix, false, uniforms.viewMatrix);
        gl.uniformMatrix4fv(this.leafLocations.u_projectionMatrix, false, uniforms.projectionMatrix);
        gl.uniform3f(this.leafLocations.u_cameraPosition, uniforms.cameraMatrix[12], uniforms.cameraMatrix[14], uniforms.cameraMatrix[14]);
        gl.uniformMatrix4fv(this.leafLocations.u_worldMatrix, false, modelMatrix);
        gl.uniformMatrix4fv(this.leafLocations.u_worldInverseTransposeMatrix, false, uniforms.worldInverseTransposeMatrix);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.leafGradientTexture);
        gl.uniform1i(this.leafProgram.u_gradientTexture, 0);
        gl.drawElementsInstanced(
            gl.TRIANGLES,
            this.leafBuffers.numElem,
            gl.UNSIGNED_SHORT,
            0,
            this.#LEAF_COUNT
        );

        // draw the back side of the leaf with inverted normals
        gl.cullFace(gl.FRONT);
        const worldInverseTransposeMatrix = mat4.scale(
            mat4.create(),
            uniforms.worldInverseTransposeMatrix,
            vec3.fromValues(-1, -1, -1));
        gl.uniformMatrix4fv(this.leafLocations.u_worldInverseTransposeMatrix, false, worldInverseTransposeMatrix);
        gl.drawElementsInstanced(
            gl.TRIANGLES,
            this.leafBuffers.numElem,
            gl.UNSIGNED_SHORT,
            0,
            this.#LEAF_COUNT
        );

        gl.cullFace(gl.BACK);
    }

    #getVesselSD(p) {
        const padding = 0.93;
        return this.#sdRoundedCylinder(p, this.vesselRadius * padding, this.vesselBevelRadius * padding, (this.vesselHeight / 2) * padding)
    }

    // https://iquilezles.org/articles/distfunctions/
    #sdRoundedCylinder( p, ra, rb, h ) {
        const d = vec2.fromValues( 
            vec2.length(vec2.fromValues(p[0], p[2])) - ra + rb, 
            Math.abs(p[1]) - h + rb
        );
        return Math.min(Math.max(d[0],d[1]), 0.0) + vec2.length(vec2.fromValues(Math.max(d[0], 0.0), Math.max(d[1], 0.0))) - rb;
    }
}