import { vec3 } from "gl-matrix";

export class CubicBezier {
    
    #ARC_LENGTH_STEPS = 100;
    #arcLength = 0;
    #arcLengths = [];

    constructor(a0, c0, c1, a1) {
        this.a0 = a0;
        this.c0 = c0;
        this.c1 = c1;
        this.a1 = a1;

        // calculate the arc length steps
        let prev = this.pointAt(0);
        this.#arcLengths.push(0);
        for(let i = 1; i <= this.#ARC_LENGTH_STEPS; ++i) {
            const t = i / this.#ARC_LENGTH_STEPS;
            const p = this.pointAt(t);
            this.#arcLengths[i] = this.#arcLengths[i - 1] + (vec3.distance(prev, p));
            prev = p;
        }

        this.#arcLength = this.#arcLengths[this.#ARC_LENGTH_STEPS];
    }

    pointAt(t) {
        const t2 = t * t;
        const t3 = t2 * t;

        const p0 = -t3 + 3 * t2 - 3 * t + 1;
        const p1 = 3 * t3 - 6 * t2 + 3 * t;
        const p2 = -3 * t3 + 3 * t2;
        const p3 = t3;

        const v0 = vec3.scale(vec3.create(), this.a0, p0);
        const v1 = vec3.scale(vec3.create(), this.c0, p1);
        const v2 = vec3.scale(vec3.create(), this.c1, p2);
        const v3 = vec3.scale(vec3.create(), this.a1, p3);

        const v01 = vec3.add(vec3.create(), v0, v1);
        const v23 = vec3.add(vec3.create(), v2, v3);

        return vec3.add(vec3.create(), v01, v23);
    }

    velocityAt(t) {
        const t2 = t * t;

        const p0 = -3 * t2 + 6 * t - 3;
        const p1 = 9 * t2 - 12 * t + 3;
        const p2 = -9 * t2 + 6 * t;
        const p3 = 3 * t2;

        const v0 = vec3.scale(vec3.create(), this.a0, p0);
        const v1 = vec3.scale(vec3.create(), this.c0, p1);
        const v2 = vec3.scale(vec3.create(), this.c1, p2);
        const v3 = vec3.scale(vec3.create(), this.a1, p3);

        const v01 = vec3.add(vec3.create(), v0, v1);
        const v23 = vec3.add(vec3.create(), v2, v3);

        return vec3.add(vec3.create(), v01, v23);
    }

    map(u) {
        const targetLength = u * this.#arcLength;
        let high = this.#ARC_LENGTH_STEPS;
        let low = 0;
        let index = 0;

        while (low < high) {
            index = low + (((high - low) / 2) | 0);
            if (this.#arcLengths[index] < targetLength) {
                low = index + 1;
            } else {
                high = index;
            }
        }

        if (this.#arcLengths[index] > targetLength) {
            index--;
        }

        const lengthBefore = this.#arcLengths[index];
        if (lengthBefore === targetLength) {
            return index / this.#ARC_LENGTH_STEPS;
        } else {
            return (index + (targetLength - lengthBefore) / (this.#arcLengths[index + 1] - lengthBefore)) / this.#ARC_LENGTH_STEPS;
        }
    }
}