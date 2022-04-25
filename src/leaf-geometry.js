import { vec2, vec3 } from "gl-matrix";
import { CubicBezier } from "./utils/cubic-bezier";

export class LeafGeometry {

    #vertices = [];
    #indices = [];
    #normals = [];
    #uvs = [];

    #LEAF_LENGTH = 1 * 10;
    #LEAF_WIDTH = .3 * 25;
    #LEAF_BEND = 1 * 20;

    contourBezierPoints = {
        a0: [0, 0, 0],
        c0: [0, 0.4, 0],
        a1: [0, 1, -1],
        c1: [0, 0.4, .1]
    };

    constructor() {
        const LON_SEGMENTS = 8;
        const LAT_SEGMENTS = 12;

        for(let i = 0; i <= LAT_SEGMENTS; ++i) {
            const v = i / LAT_SEGMENTS;

            for(let j = 0; j <= LON_SEGMENTS; ++j) {
                const lonSegmentHalf = LON_SEGMENTS / 2;
                const u = (lonSegmentHalf - j) / lonSegmentHalf;

                // find the point on the leaf contour for the current lat and long position
                const curve = this.#getContourCurve(u);
                const t = curve.map(v);
                const contourPoint = curve.pointAt(t);
                const contourVelocity = vec3.normalize(vec3.create(), curve.velocityAt(t));

                // apply a slight curling on the y-axis to the leaf
                const curlFactor = Math.sqrt(2 - u * u);
                const x = -contourPoint[0];
                const y = contourPoint[1];
                const z = contourPoint[2] + (1 - curlFactor) * (1.5 * (1 - v * v * v));
                this.#vertices.push(...vec3.fromValues(x, y, z));

                // combine the curl and the z-bend of the curve to calculate the normals
                const curlNormal = vec3.normalize(vec3.create(), vec3.fromValues(-x, 0, -z));
                const zBendDelta = contourVelocity[2] / contourVelocity[1];
                const n = vec3.rotateX(vec3.create(), curlNormal, vec3.fromValues(0, 0, 0), Math.atan(zBendDelta));
                this.#normals.push(...n);

                this.#uvs.push(u, v);
            }
        }

        const indexOff = LON_SEGMENTS + 1;
        for(let i = 0; i < LAT_SEGMENTS; ++i) {
            for(let j = 0; j < LON_SEGMENTS; ++j) {
                this.#indices.push(
                    i * indexOff + j,
                    i * indexOff + j + 1,
                    (i + 1) * indexOff + j + 1
                );
                this.#indices.push(
                    (i + 1) * indexOff + j + 1,
                    (i + 1) * indexOff + j,
                    i * indexOff + j
                );
            }
        }

        this.vertices = new Float32Array(this.#vertices);
        this.normals = new Float32Array(this.#normals);
        this.uvs = new Float32Array(this.#uvs);
        this.indices = new Uint16Array(this.#indices);
    }

    get extent() {
        const a1 = [...this.contourBezierPoints.a1];
        a1[1] *= this.#LEAF_LENGTH;
        a1[2] *= this.#LEAF_BEND;
        return a1;
    }

    #getContourCurve(s) {
        const startWidth = 0.1 * this.#LEAF_WIDTH;
        const a0 = [...this.contourBezierPoints.a0];
        const c0 = [...this.contourBezierPoints.c0];
        const a1 = [...this.contourBezierPoints.a1];
        const c1 = [...this.contourBezierPoints.c1];

        a0[0] = startWidth * s;
        c0[0] = a0[0];
        c1[0] = this.#LEAF_WIDTH * s;

        c0[1] = c0[1] * this.#LEAF_LENGTH;
        c1[1] = c1[1] * this.#LEAF_LENGTH;
        a1[1] = a1[1] * this.#LEAF_LENGTH;
        a1[2] *= this.#LEAF_BEND;
        c1[2] *= this.#LEAF_BEND;

        const curve = new CubicBezier(a0, c0, c1, a1);

        return curve;
    }
}