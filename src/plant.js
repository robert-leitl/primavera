import { mat4, vec3 } from "gl-matrix";
import { LeafGeometry } from "./leaf-geometry";
import { GeometryHelper } from "./utils/geometry-helper";
import { createProgram, makeBuffer, makeVertexArray } from "./utils/webgl-utils";

import leafVertShaderSource from './shader/leaf.vert';
import leafFragShaderSource from './shader/leaf.frag';
import { CubicBezier } from "./utils/cubic-bezier";

export class Plant {

    #STEM_SEGMENTS = 10;
    #LEAVES_PER_SEGMENT = 2;
    #LEAF_COUNT = this.#STEM_SEGMENTS * this.#LEAVES_PER_SEGMENT;

    leafInstances;

    constructor(
        context,
        vesselHeight,
        vesselRadius,
        vesselBevelRadius
    ) {
        this.context = context;
        this.vesselHeight = vesselHeight;
        this.vesselRadius = vesselRadius;
        this.vesselBevelRadius = vesselBevelRadius;

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
            u_cameraPosition: gl.getUniformLocation(this.leafProgram, 'u_cameraPosition')
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

        this.#initLeafInstances();
    }

    generate() {
        this.#generateStem();
        this.#generateLeafs();
    }

    update() {

    }

    render(uniforms, drawGuides = false) {
        // center the plant vertically around the origin
        const modelMatrix = mat4.translate(mat4.create(), uniforms.worldMatrix, vec3.fromValues(0, -this.vesselHeight / 2, 0));

        if (drawGuides) {
            this.geometryHelper.render(
                modelMatrix,
                uniforms.viewMatrix,
                uniforms.projectionMatrix,
                this.stemVAO,
                this.stemBuffers.numElem
            );
        }

        this.#renderLeafs(uniforms, modelMatrix);
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
            scales: []
        }
        const numInstances = this.#LEAF_COUNT;
        for(let i = 0; i < numInstances; ++i) {
            const instanceMatrixArray = new Float32Array(this.leafInstances.matricesArray.buffer, i * 16 * 4, 16);
            const bindMatrix = mat4.create();
            instanceMatrixArray.set(bindMatrix);
            this.leafInstances.matrices.push(instanceMatrixArray);
            this.leafInstances.bindMatrices.push(bindMatrix);
            this.leafInstances.scales.push(Math.random() * 0.4 + 0.6);
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
        const capOffset = this.vesselBevelRadius * 0.2;
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

    #generateLeafs() {
        /** @type {WebGLRenderingContext} */
        const gl = this.context;

        const upRotation = mat4.rotateX(mat4.create(), mat4.create(), -Math.PI / 2);
        const numInstances = this.#LEAF_COUNT;
        const maxOffset = (this.vesselHeight / numInstances) * 0.01;
        const up = vec3.fromValues(0, 0, 1);
        for(let i = 0; i < numInstances; ++i) {
            const t = i / (numInstances * 1.25) + 0.05;
            const bindMatrix = this.leafInstances.bindMatrices[i];
            const matrix = this.leafInstances.matrices[i];
            const scale = this.leafInstances.scales[i];
            const tOff = Math.random() * maxOffset - maxOffset / 2;

            const mt = this.stemCurve.map(t + tOff);
            const p = this.stemCurve.pointAt(mt);
            mat4.translate(matrix, bindMatrix, p);

            const tangent = vec3.normalize(vec3.create(), this.stemCurve.velocityAt(mt));
            vec3.rotateY(up, up, vec3.create(), Math.random() * Math.PI * 2 - Math.PI);
            const rotation = mat4.targetTo(mat4.create(), vec3.create(), tangent, up);
            mat4.multiply(rotation, rotation, upRotation);
            mat4.multiply(matrix, matrix, rotation);
            mat4.scale(matrix, matrix, [scale, scale, scale])
        }

        // upload the instance matrix buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.leafInstances.buffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.leafInstances.matricesArray);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    #renderLeafs(uniforms, modelMatrix) {
        /** @type {WebGLRenderingContext} */
        const gl = this.context;

        gl.useProgram(this.leafProgram);

        gl.disable(gl.CULL_FACE);
 
        gl.bindVertexArray(this.leafVAO);
        gl.uniformMatrix4fv(this.leafLocations.u_viewMatrix, false, uniforms.viewMatrix);
        gl.uniformMatrix4fv(this.leafLocations.u_projectionMatrix, false, uniforms.projectionMatrix);
        gl.uniform3f(this.leafLocations.u_cameraPosition, uniforms.cameraMatrix[12], uniforms.cameraMatrix[14], uniforms.cameraMatrix[14]);
        gl.uniformMatrix4fv(this.leafLocations.u_worldMatrix, false, modelMatrix);
        gl.uniformMatrix4fv(this.leafLocations.u_worldInverseTransposeMatrix, false, uniforms.worldInverseTransposeMatrix);
        gl.drawElementsInstanced(
            gl.TRIANGLES,
            this.leafBuffers.numElem,
            gl.UNSIGNED_SHORT,
            0,
            this.#LEAF_COUNT
        )

        gl.enable(gl.CULL_FACE);
    }

    #getVesselRadiusAtHeight(h) {
        const vh = this.vesselHeight;
        const ir = this.vesselRadius - this.vesselBevelRadius;
        const r = this.vesselBevelRadius;

        if (h < r) {
            return ir + Math.sqrt(r * r - (r - h) * (r - h));
        } else if (h > vh - r) {
            return ir + Math.sqrt(r * r - (h - vh + r) * (h - vh + r));
        }

        return this.vesselRadius;
    }
}