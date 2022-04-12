import { mat4, vec3 } from "gl-matrix";
import { GeometryHelper } from "./utils/geometry-helper";
import { makeBuffer, makeVertexArray } from "./utils/webgl-utils";

export class Plant {

    constructor(
        parent,
        vesselHeight,
        vesselRadius,
        vesselBevelRadius
    ) {
        this.parent = parent;
        this.gl = parent.gl;
        this.vesselHeight = vesselHeight;
        this.vesselRadius = vesselRadius;
        this.vesselBevelRadius = vesselBevelRadius;
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
        const capOffset = this.vesselBevelRadius * 0.1;
        randAngle = Math.random() * 2 * Math.PI;
        let randHeight = Math.random() * (h2 - capOffset) + capOffset;
        const r2 = Math.random() * this.vesselRadius;
        const c1 = vec3.fromValues(r2 * Math.cos(randAngle), randHeight, r2 * Math.sin(randAngle));
        randAngle = Math.random() * 2 * Math.PI;
        randHeight = Math.random() * (h2 - capOffset) + h2;
        const r3 = Math.random() * this.vesselRadius;
        const c2 = vec3.fromValues(r3 * Math.cos(randAngle), randHeight, r3 * Math.sin(randAngle));

        const stemVertices = [];
        for(let t=0; t<=1; t+=0.05) {
            stemVertices.push(...this.#cubicBezier(a1, c1, a2, c2, t));
        }
        this.stemVerticesData = new Float32Array(stemVertices);

        if (!this.stemVAO) {
            this.stemBuffers = { 
                position: makeBuffer(this.gl, this.stemVerticesData, this.gl.DYNAMIC_DRAW),
                numElem: stemVertices.length / 3
            };
            this.geometryHelper = new GeometryHelper(this.gl);
            this.stemVAO = makeVertexArray(this.gl, [
                [this.stemBuffers.position, this.geometryHelper.locations.a_position, 3]
            ]);
        } else {
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.stemBuffers.position);
            this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, this.stemVerticesData);
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
        }
    }

    update() {

    }

    render() {
        this.geometryHelper.render(
            mat4.translate(mat4.create(), this.parent.drawUniforms.u_worldMatrix, vec3.fromValues(0, -this.vesselHeight / 2, 0)),
            this.parent.drawUniforms.u_viewMatrix,
            this.parent.drawUniforms.u_projectionMatrix,
            this.stemVAO,
            this.stemBuffers.numElem
        );
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

    #cubicBezier(a1, c1, a2, c2, t) {
        const t2 = t * t;
        const t3 = t2 * t;

        const p0 = -t3 + 3 * t2 - 3 * t + 1;
        const p1 = 3 * t3 - 6 * t2 + 3 * t;
        const p2 = -3 * t3 + 3 * t2;
        const p3 = t3;

        const v0 = vec3.scale(vec3.create(), a1, p0);
        const v1 = vec3.scale(vec3.create(), c1, p1);
        const v2 = vec3.scale(vec3.create(), c2, p2);
        const v3 = vec3.scale(vec3.create(), a2, p3);

        const v01 = vec3.add(vec3.create(), v0, v1);
        const v23 = vec3.add(vec3.create(), v2, v3);

        return vec3.add(vec3.create(), v01, v23);
    }
}