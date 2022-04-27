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
    vec2 texelSize = 1. / vec2(textureSize(u_colorTexture, 0));
    vec2 uv = gl_FragCoord.xy * texelSize;

    vec3 pos = v_position;
    vec3 N = normalize(v_normal);
    vec3 VN = normalize(v_viewNormal);
    vec3 V = normalize(v_surfaceToView);
    vec3 L = normalize(vec3(0., .5, 4.));
    float NdL = max(0., dot(N, L));

    // calculate the reflection vector
    float NdV = max(0., dot(N, V));
    vec3 R = NdV * N * 2. - V;
    R = normalize(R);

    // calculate the half vector
    vec3 H = normalize(V + N);

    // specular shading
    float specular = pow(max(0., max(0., dot(H, L))), 100.) * .2;
    
    vec4 color = texture(u_colorTexture, uv);

    outColor = color * .7 + vec4(vec3(NdL * .1 + .9), 1) * 0.3 + specular;
}
