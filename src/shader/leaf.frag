#version 300 es

precision highp float;

uniform float u_frames;
uniform sampler2D u_gradientTexture;

in vec3 v_position;
in vec3 v_normal;
in vec3 v_viewNormal;
in vec2 v_uv;
in vec3 v_surfaceToView;
in vec3 v_viewPosition;

out vec4 outColor;

#define PI 3.1415926535

void main() {
    vec3 pos = v_position;
    vec3 N = normalize(v_normal);
    vec3 VN = normalize(v_viewNormal);
    vec3 V = normalize(v_surfaceToView);
    vec3 L = normalize(vec3(0., .5, 4.));
    float NdL = max(0., dot(N, L));

    // the albedo term from the leaf gradient with some distortion
    vec2 uv = vec2(v_uv.y, v_uv.x);
    // apply line texture
    uv.x += sin(v_uv.x * PI * 5.) * 0.5;
    vec4 albedo = texture(u_gradientTexture, uv);
    // darken the edges
    albedo *= min(1., 1. - pow(uv.y, 2.) * 0.1 + uv.x * 0.1);

    // the diffuse term
    float diffuse = (NdL * NdL * NdL) * 0.1 + .95;

    outColor = albedo * diffuse;
}
