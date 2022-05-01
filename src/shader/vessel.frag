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

    // calculate the half vector
    vec3 H = normalize(V + N);

    // specular term
    float specular = pow(max(0., max(0., dot(H, L))), 100.) * .6;

    // diffuse term
    float diffuse = NdL * .3 + .7;

    // edge darkening term
    float edge = min(1., pow(min(1., NdL + 0.5), 3.) + 0.6);

    // ambient light color
    vec4 ambient = vec4(0.9, 0.9, 1., 1.);
    
    vec4 innerColor = texture(u_colorTexture, uv);

    vec4 vesselColor = ambient * diffuse + vec4(specular) * 1.5;
    vesselColor *= edge;

    outColor = innerColor * 0.9 + vesselColor * 0.1 + vec4(N.zyx, 1.) * 0.02;
}
