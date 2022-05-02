#version 300 es

precision highp float;

uniform sampler2D u_titleTexture;
uniform float u_frames;

in vec2 v_uv;

out vec4 outColor;

void main() {
    vec2 uv = vec2(v_uv.x - u_frames * 0.00025, v_uv.y);
    vec4 color = 1. - texture(u_titleTexture, uv * vec2(-4., 0.99));
    //color = mix(vec4(248. / 255., 248. / 255., 222. / 255., 1.), vec4(1.), color);
    color = mix(vec4(228. / 255., 238. / 255., 255. / 255., 1.), vec4(1.), color);
    //color = mix(vec4(55. / 255., 25. / 255., 22. / 255., 1.), vec4(1.), color);

    color = mix(color, vec4(1.), sin(v_uv.x * 9.5) * 0.5 + 0.5);

    outColor = color;
}
