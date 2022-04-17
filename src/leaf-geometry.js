import { vec3 } from "gl-matrix";

export class LeafGeometry {

    #vertices = [];
    #indices = [];
    #normals = [];
    #uvs = [];

    constructor() {

        const LEAF_LENGTH = 1 * 20;
        const LEAF_WIDTH = 0.4 * 20;
        const LON_SEGMENTS = 4;
        const LAT_SEGMENTS = 8;
        const latSegmentWidth = LEAF_LENGTH / LAT_SEGMENTS;
        const lonSegmentWidth = LEAF_WIDTH / LON_SEGMENTS;
        const lonOffset = LEAF_WIDTH / 2;

        for(let i = 0; i <= LAT_SEGMENTS; ++i) {
            const lat = latSegmentWidth * i;
            const latParam = i / LAT_SEGMENTS;

            for(let j = 0; j <= LON_SEGMENTS; ++j) {
                const lon = lonSegmentWidth * j;
                const lonSegmentHalf = LON_SEGMENTS / 2;
                const lonParam = (lonSegmentHalf - j) / lonSegmentHalf;

                // find the point on the leaf contour for the current lat and long position
                const contourPoint = this.#getContourPoint(latParam, lonParam);

                const v = vec3.fromValues(lon - lonOffset, lat, 0);
                this.#vertices.push(...v);

                const n = vec3.fromValues(0, 0, 1);
                this.#normals.push(...n);

                this.#uvs.push(lon / LON_SEGMENTS, lat / LAT_SEGMENTS);
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

    #getContourPoint(t, s) {

    }
}