import { vec3 } from "gl-matrix";

export class VesselGeometry {

    height = 20;
    radius = 10;
    bevelRadius = 2;
    radiusSegments = 8;
    bevelSegments = 0;

    #halfHeight;
    #innerRadius;
    #radiusStepAngle;
    #vertices = [];
    #indices = [];
    #normals = [];

    constructor(
        
    ) {
        this.#halfHeight = this.height / 2;
        this.#innerRadius = this.radius - this.bevelRadius;
        this.#radiusStepAngle = (2 * Math.PI) / this.radiusSegments;

        this.#generateCap(true);
        this.#generateCap(false);

        this.vertices = new Float32Array(this.#vertices);
        this.normals = new Float32Array(this.#normals);
        this.indices = new Uint16Array(this.#indices);
    }

    #generateCap(isTop = true) {
        const y = isTop ? this.#halfHeight : -this.#halfHeight;
        const capNorm = vec3.fromValues(0, Math.sign(y), 0);
        const centerVertex = vec3.fromValues(0, y, 0);
        const centerIndex = (this.#vertices.push(...centerVertex) / 3) - 1;
        this.#normals.push(...capNorm);
        for(let i = 0; i < this.radiusSegments; ++i) {
            const a = i * this.#radiusStepAngle;
            const x = this.#innerRadius * Math.cos(a);
            const z = this.#innerRadius * Math.sin(a);
            this.#vertices.push(...vec3.fromValues(x, centerVertex[1], z));
            this.#normals.push(...capNorm);

            if (!isTop)
                this.#indices.push(centerIndex, centerIndex + i + 1, centerIndex + (i + 1) % this.radiusSegments + 1);
            else
                this.#indices.push(centerIndex, centerIndex + (i + 1) % this.radiusSegments + 1, centerIndex + i + 1);
        }
    }
}