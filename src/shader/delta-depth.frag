#version 300 es

precision highp float;

uniform sampler2D u_colorTexture;
uniform sampler2D u_depthTexture;

out vec4 outColor;

void main() {
    vec2 uv = gl_FragCoord.xy / vec2(textureSize(u_colorTexture, 0));
    float plantDepth = texture(u_depthTexture, uv).r;
    float vesselDepth = gl_FragCoord.z;
    float delta = smoothstep(0.1, 0.3, plantDepth - vesselDepth);
    vec4 color = mix(texture(u_colorTexture, uv), vec4(1.), delta * 0.7);

    outColor = vec4(color.rgb, delta);
}
