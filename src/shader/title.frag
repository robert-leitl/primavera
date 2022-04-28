#version 300 es

precision highp float;

uniform sampler2D u_titleTexture;
uniform float u_frames;

in vec2 v_uv;

out vec4 outColor;

void main() {
    vec4 color = 1. - texture(u_titleTexture, v_uv * vec2(-5., 0.99));
    color = mix(vec4(248. / 255., 248. / 255., 212. / 255., 1.), vec4(1.), color);

    outColor = color;
}
