#version 300 es

precision highp float;

uniform mat4 u_inversProjectionMatrix;
uniform sampler2D u_colorTexture;
uniform sampler2D u_depthTexture;

in vec3 v_position;

out vec4 outColor;

#pragma glslify: reconstruct = require('./reconstruct-position.glsl')

void main() {
    vec2 uv = gl_FragCoord.xy / vec2(textureSize(u_colorTexture, 0));
    float vesselRadius = 20.;
    float cameraDistance = 100.;

    float plantDepth = texture(u_depthTexture, uv).r;
    vec3 plantPosition = reconstruct(uv, plantDepth, u_inversProjectionMatrix);
    // get the normalized plant z position
    float plantNormZ = (cameraDistance + vesselRadius + plantPosition.z) / (2. * vesselRadius);
    // get the normalized vessel z position
    float vesselNormZ = (cameraDistance + vesselRadius + v_position.z) / (2. * vesselRadius);
    float deltaBlur = smoothstep(0.15, 0.4, vesselNormZ - plantNormZ);
    float deltaFog = smoothstep(0.0, 1.1, vesselNormZ - plantNormZ);
    vec4 color = mix(texture(u_colorTexture, uv), vec4(1.), deltaFog);

    outColor = vec4(color.rgb, deltaBlur);
}
