import { vec3 } from "gl-matrix";

export class VesselGeometry {

    height = 50;
    radius = 20
    bevelRadius = 13;
    radiusSegments = 32;
    bevelSegments = 8;

    #halfHeight;
    #innerRadius;
    #radiusStepAngle;
    #bevelStepAngle;
    #bevelNormalAngleOffset;
    #bevelNormalStepAngle;
    #vertices = [];
    #indices = [];
    #normals = [];

    constructor(
        height = 50,
        radius = 20,
        bevelRadius = 13,
        radiusSegments = 32,
        bevelSegments = 8,
        normalBendFactor = 1.5
    ) {
        this.height = height;
        this.radius = radius;
        this.bevelRadius = bevelRadius;
        history.radiusSegments = radiusSegments;
        this.bevelSegments = bevelSegments;
        this.normalBendFactor = normalBendFactor;

        this.#halfHeight = this.height / 2;
        this.#innerRadius = this.radius - this.bevelRadius;
        this.#radiusStepAngle = (2 * Math.PI) / this.radiusSegments;
        this.#bevelStepAngle = (Math.PI * .5) / (this.bevelSegments + 1);
        this.#bevelNormalAngleOffset = this.#bevelStepAngle * this.normalBendFactor;
        this.#bevelNormalStepAngle = (Math.PI * .5 - 2 * this.#bevelNormalAngleOffset) / (this.bevelSegments + 1);

        this.#generateCap(true);
        this.#generateBevel(true);
        this.#generateCap(false);
        this.#generateBevel(false);
        this.#generateTorso();


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

            const bna = Math.PI * 0.5 - this.#bevelNormalAngleOffset;
            const bny = Math.sin(bna);
            const bnx = Math.cos(bna) * Math.cos(a);
            const bnz = Math.cos(bna) * Math.sin(a);
            const bnv = vec3.fromValues(bnx, isTop ? bny : -bny, bnz);
            const n = vec3.normalize(vec3.create(), bnv);
            this.#normals.push(...n);

            if (!isTop)
                this.#indices.push(centerIndex, centerIndex + i + 1, centerIndex + (i + 1) % this.radiusSegments + 1);
            else
                this.#indices.push(centerIndex, centerIndex + (i + 1) % this.radiusSegments + 1, centerIndex + i + 1);
        }
    }

    #generateBevel(isTop = true) {
        const startNdx = this.#vertices.length / 3;
        const bevelVertexCount = (this.bevelSegments + 2) * this.radiusSegments;
        const y = isTop ? this.#halfHeight - this.bevelRadius : this.bevelRadius - this.#halfHeight;
        let ndx = 0;
        for(let i = 0; i < this.radiusSegments; ++i) {
            const a = i * this.#radiusStepAngle;
            const x = this.#innerRadius * Math.cos(a);
            const z = this.#innerRadius * Math.sin(a);
            const o = vec3.fromValues(x, y, z);
           
            for(let j = 0; j <= (this.bevelSegments + 1); ++j) {
                const ba = (Math.PI * 0.5) - j * this.#bevelStepAngle;
                const by = this.bevelRadius * Math.sin(ba);
                const bx = (this.bevelRadius * Math.cos(ba)) * Math.cos(a);
                const bz = (this.bevelRadius * Math.cos(ba)) * Math.sin(a);
                const bv = vec3.fromValues(bx, isTop ? by : -by, bz);

                const v = vec3.add(vec3.create(), o, bv);
                this.#vertices.push(...v);

                const bna = (Math.PI * 0.5 - this.#bevelNormalAngleOffset) - (j * this.#bevelNormalStepAngle);
                const bny = this.bevelRadius * Math.sin(bna);
                const bnx = (this.bevelRadius * Math.cos(bna)) * Math.cos(a);
                const bnz = (this.bevelRadius * Math.cos(bna)) * Math.sin(a);
                const bnv = vec3.fromValues(bnx, isTop ? bny : -bny, bnz);
                const n = vec3.normalize(vec3.create(), bnv);
                this.#normals.push(...n);

                if (j <= this.bevelSegments) {
                    const nextBevelNdx = (ndx + (this.bevelSegments + 2)) % bevelVertexCount;
                    if (isTop) {
                        this.#indices.push(
                            startNdx + ndx,
                            startNdx + nextBevelNdx,
                            startNdx + nextBevelNdx + 1
                        );
                        this.#indices.push(
                            startNdx + ndx,
                            startNdx + nextBevelNdx + 1,
                            startNdx + ndx + 1
                        );
                    } else {
                        this.#indices.push(
                            startNdx + ndx,
                            startNdx + nextBevelNdx + 1,
                            startNdx + nextBevelNdx
                        );
                        this.#indices.push(
                            startNdx + ndx,
                            startNdx + ndx + 1,
                            startNdx + nextBevelNdx + 1
                        );
                    }
                }

                ndx++;
            }
        }
    }

    #generateTorso() {
        const startNdx = this.#vertices.length / 3;
        let ndx = 0;
        for(let i = 0; i < this.radiusSegments; ++i) {
            const a = i * this.#radiusStepAngle;
            const x = this.radius * Math.cos(a);
            const z = this.radius * Math.sin(a);

            const v1 = vec3.fromValues(x, this.#halfHeight - this.bevelRadius, z);
            const v2 = vec3.fromValues(x, this.bevelRadius - this.#halfHeight, z);

            const bna = this.#bevelNormalAngleOffset;
            const bny = Math.sin(bna);
            const bnx = Math.cos(bna) * Math.cos(a);
            const bnz = Math.cos(bna) * Math.sin(a);
            const bnv1 = vec3.fromValues(bnx, bny, bnz);
            const bnv2 = vec3.fromValues(bnx, -bny, bnz);
            const n1 = vec3.normalize(vec3.create(), bnv1);
            const n2 = vec3.normalize(vec3.create(), bnv2);

            const n = vec3.normalize(vec3.create(), vec3.fromValues(x, 0, z));

            this.#vertices.push(...v1);
            this.#vertices.push(...v2);
            this.#normals.push(...n1);
            this.#normals.push(...n2);

            const nextSegNdx = (ndx + 2) % (this.radiusSegments * 2);
            this.#indices.push(
                startNdx + ndx, 
                startNdx + nextSegNdx, 
                startNdx + nextSegNdx + 1
            );
            this.#indices.push(
                startNdx + ndx, 
                startNdx + nextSegNdx + 1, 
                startNdx + ndx + 1
            );

            ndx += 2;
        }
    }
}