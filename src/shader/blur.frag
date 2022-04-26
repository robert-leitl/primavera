#version 300 es

precision highp float;

uniform sampler2D u_colorTexture;
uniform float u_scale;
uniform vec2 u_direction;

out vec4 blurColor;

#pragma glslify: blur = require('./blur.glsl', tex=texture, texSize=textureSize)

void main() {
    vec2 uv = gl_FragCoord.xy / vec2(textureSize(u_colorTexture, 0));

    /*blur(
        uv,
        u_direction,
        u_scale,
        u_colorTexture,
        blurColor
    );*/

    blurColor = texture(u_colorTexture, uv);
}