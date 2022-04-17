import { vec3 } from "gl-matrix";

export function cubicBezier(a1, c1, a2, c2, t) {
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

export function cubicBezierVelocity(a1, c1, a2, c2, t) {
    const t2 = t * t;

    const p0 = -3 * t2 + 6 * t - 3;
    const p1 = 9 * t2 - 12 * t + 3;
    const p2 = -9 * t2 + 6 * t;
    const p3 = 3 * t2;

    const v0 = vec3.scale(vec3.create(), a1, p0);
    const v1 = vec3.scale(vec3.create(), c1, p1);
    const v2 = vec3.scale(vec3.create(), c2, p2);
    const v3 = vec3.scale(vec3.create(), a2, p3);

    const v01 = vec3.add(vec3.create(), v0, v1);
    const v23 = vec3.add(vec3.create(), v2, v3);

    return vec3.add(vec3.create(), v01, v23);
}