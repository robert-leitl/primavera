export class LeafGeometry {

    #vertices = [];
    #indices = [];
    #normals = [];
    #uvs = [];

    constructor() {

        this.#vertices.push(
            0, 10, 0,
            10, 0, 0,
            0, 0, 0
        );

        this.#normals.push(
            0, 0, 1,
            0, 0, 1,
            0, 0, 1
        );

        this.#uvs.push(
            0, 0,
            1, 0,
            1, 1,
        );

        this.#indices.push(
            0, 2, 1
        );

        this.vertices = new Float32Array(this.#vertices);
        this.normals = new Float32Array(this.#normals);
        this.uvs = new Float32Array(this.#uvs);
        this.indices = new Uint16Array(this.#indices);
    }
}