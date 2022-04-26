#version 300 es

precision highp float;

uniform sampler2D u_colorTexture;
uniform float u_frames;

in vec3 v_position;
in vec3 v_normal;
in vec3 v_viewNormal;
in vec2 v_uv;
in vec3 v_surfaceToView;
in vec3 v_viewPosition;

out vec4 outColor;

#define PI 3.1415926535

void main() {
    vec2 uv = gl_FragCoord.xy / vec2(textureSize(u_colorTexture, 0));
    vec4 color = texture(u_colorTexture, uv);

    vec3 pos = v_position;
    vec3 N = normalize(v_normal);
    vec3 VN = normalize(v_viewNormal);
    vec3 V = normalize(v_surfaceToView);
    vec3 L = normalize(vec3(0., 1., 0.));
    float NdL = max(0., dot(N, L));

    outColor = color * .6 + vec4(vec3(NdL * .1 + .9), 1) * 0.4;
}
