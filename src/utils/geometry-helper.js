
import helperVertShaderSource from '../shader/helper.vert';
import helperFragShaderSource from '../shader/helper.frag';
import { createProgram } from './webgl-utils';

export class GeometryHelper {
    constructor(gl) {
        /** @type {WebGLRenderingContext} */
        this.gl = gl;

        // setup programs
        this.program = createProgram(gl, [helperVertShaderSource, helperFragShaderSource], null, { a_position: 0 });

        // find the locations
        this.locations = {
            a_position: gl.getAttribLocation(this.program, 'a_position'),
            u_worldMatrix: gl.getUniformLocation(this.program, 'u_worldMatrix'),
            u_viewMatrix: gl.getUniformLocation(this.program, 'u_viewMatrix'),
            u_projectionMatrix: gl.getUniformLocation(this.program, 'u_projectionMatrix')
        };
    }

    render(
        worldMatrix, 
        viewMatrix, 
        projectionMatrix, 
        vao, 
        numElem
    ) {
        /** @type {WebGLRenderingContext} */
        const gl = this.gl;

        // draw capsule
        gl.useProgram(this.program);
        gl.disable(gl.CULL_FACE);
        gl.disable(gl.DEPTH_TEST);
        gl.uniformMatrix4fv(this.locations.u_worldMatrix, false, worldMatrix);
        gl.uniformMatrix4fv(this.locations.u_viewMatrix, false, viewMatrix);
        gl.uniformMatrix4fv(this.locations.u_projectionMatrix, false, projectionMatrix);
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.LINE_STRIP, 0, numElem);

        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);
    }
}