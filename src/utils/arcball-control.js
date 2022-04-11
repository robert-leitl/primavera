import { quat, vec3, vec2, mat3 } from 'gl-matrix';

export class ArcballControl {

    // the current rotation quaternion
    rotationQuat = quat.create();

    constructor(canvas, updateCallback) {
        this.canvas = canvas;
        this.updateCallback = updateCallback ? updateCallback : () => null;

        this.pointerDown = false;
        this.pointerDownPos = vec2.create();
        this.pointerPos = vec2.create();
        this.followPos = vec3.create();
        this.prevFollowPos = vec3.create();

        canvas.style.touchAction = 'none';

        canvas.addEventListener('pointerdown', e => {
            this.pointerDownPos = vec2.fromValues(e.clientX, e.clientY);
            this.followPos = vec3.fromValues(e.clientX, e.clientY, 0);
            this.pointerPos = vec2.fromValues(e.clientX, e.clientY);
            this.prevFollowPos = vec3.fromValues(e.clientX, e.clientY, 0);
            this.pointerDown = true;
        });
        canvas.addEventListener('pointerup', e => {
            this.pointerDown = false;
        });
        canvas.addEventListener('pointerleave', e => {
            this.pointerDown = false;
        });
        canvas.addEventListener('pointermove', e => {
            if (this.pointerDown) {
                this.pointerPos[0] = e.clientX;
                this.pointerPos[1] = e.clientY;
            }
        });
    }

    update(deltaTime) {
        const timeScale = 16 / (deltaTime + 0.01);

        if (this.pointerDown) {
            const speed = 0.2 * timeScale;
        } else {
            const decc = 0.96 / Math.max(.5 * timeScale, 1);
        }

        const damping = 10 * timeScale;
        this.followPos[0] += (this.pointerPos[0] - this.followPos[0]) / damping;
        this.followPos[1] += (this.pointerPos[1] - this.followPos[1]) / damping;

        const p = this.#project(this.followPos);
        const q = this.#project(this.prevFollowPos);
        const np = vec3.normalize(vec3.create(), p);
        const nq = vec3.normalize(vec3.create(), q);

        const axis = vec3.cross(vec3.create(), p, q);
        vec3.normalize(axis, axis);
        const d = Math.min(1, Math.max(-1, vec3.dot(np, nq)));
        const angle = Math.acos(d) * timeScale * 3;
        const r = quat.setAxisAngle(quat.create(), axis, angle);
        quat.multiply(this.rotationQuat, r, this.rotationQuat);
        quat.normalize(this.rotationQuat, this.rotationQuat);


        this.prevFollowPos = vec3.clone(this.followPos);
        this.updateCallback();
    }

    // https://www.xarg.org/2021/07/trackball-rotation-using-quaternions/
    #project(pos) {
        const r = 1; // arcball radius
        const w = this.canvas.clientWidth;
        const h = this.canvas.clientHeight;
        const s = Math.max(w, h) - 1;

        // map to -1 to 1
        const x = (2 * pos[0] - w - 1) / s;
        const y = (2 * pos[1] - h - 1) / s;
        let z = 0;
        const xySq = x * x + y * y;
        const rSq = r * r;

        if (xySq <= rSq / 2)
            z = Math.sqrt(rSq - xySq);
        else
            z = (rSq / 2) / Math.sqrt(xySq); // hyperbolical function

        return vec3.fromValues(-x, y, z);
    }
}