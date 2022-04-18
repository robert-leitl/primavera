import { mat4, vec3 } from "gl-matrix";
import { LeafGeometry } from "./leaf-geometry";
import { GeometryHelper } from "./utils/geometry-helper";
import { createProgram, makeBuffer, makeVertexArray } from "./utils/webgl-utils";

import leafVertShaderSource from './shader/leaf.vert';
import leafFragShaderSource from './shader/leaf.frag';
import { CubicBezier } from "./utils/cubic-bezier";

export class Plant {

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
            u_worldMatrix: gl.getUniformLocation(this.leafProgram, 'u_worldMatrix'),
            u_viewMatrix: gl.getUniformLocation(this.leafProgram, 'u_viewMatrix'),
            u_projectionMatrix: gl.getUniformLocation(this.leafProgram, 'u_projectionMatrix'),
            u_worldInverseTransposeMatrix: gl.getUniformLocation(this.leafProgram, 'u_worldInverseTransposeMatrix'),
            u_cameraPosition: gl.getUniformLocation(this.leafProgram, 'u_cameraPosition')
        };

        // create leaf VAO
        this.leafGeometry = new LeafGeometry();
        console.log(this.leafGeometry);

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
    }

    generate() {
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

        const stemVertices = [];
        const curve = new CubicBezier(a1, c1, c2, a2);
        for(let t=0; t<=1; t+=0.05) {
            stemVertices.push(...curve.pointAt(curve.map(t)));
        }
        this.stemVerticesData = new Float32Array(stemVertices);

        if (!this.stemVAO) {
            this.stemBuffers = { 
                position: makeBuffer(gl, this.stemVerticesData, gl.DYNAMIC_DRAW),
                numElem: stemVertices.length / 3
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

    update() {

    }

    render(uniforms) {
        // center the plant vertically around the origin
        const modelMatrix = mat4.translate(mat4.create(), uniforms.worldMatrix, vec3.fromValues(0, -this.vesselHeight / 2, 0));

        this.geometryHelper.render(
            modelMatrix,
            uniforms.viewMatrix,
            uniforms.projectionMatrix,
            this.stemVAO,
            this.stemBuffers.numElem
        );

        this.#renderLeafs(uniforms);
    }

    #renderLeafs(uniforms) {
         /** @type {WebGLRenderingContext} */
         const gl = this.context;

         gl.useProgram(this.leafProgram);
 
         gl.disable(gl.CULL_FACE);
         gl.enable(gl.DEPTH_TEST);
 
         gl.uniformMatrix4fv(this.leafLocations.u_viewMatrix, false, uniforms.viewMatrix);
         gl.uniformMatrix4fv(this.leafLocations.u_projectionMatrix, false, uniforms.projectionMatrix);
         gl.uniform3f(this.leafLocations.u_cameraPosition, uniforms.cameraMatrix[12], uniforms.cameraMatrix[14], uniforms.cameraMatrix[14]);
         gl.uniformMatrix4fv(this.leafLocations.u_worldMatrix, false, uniforms.worldMatrix);
         gl.uniformMatrix4fv(this.leafLocations.u_worldInverseTransposeMatrix, false, uniforms.worldInverseTransposeMatrix);
         gl.bindVertexArray(this.leafVAO);
         gl.drawElements(gl.TRIANGLES, this.leafBuffers.numElem, gl.UNSIGNED_SHORT, 0);

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