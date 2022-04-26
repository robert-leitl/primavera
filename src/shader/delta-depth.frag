#version 300 es

precision highp float;

uniform sampler2D u_colorTexture;
uniform sampler2D u_depthTexture;

out vec4 outColor;

void main() {
    vec2 uv = gl_FragCoord.xy / vec2(textureSize(u_colorTexture, 0));

    //outColor = texture(u_depthTexture, uv);
    outColor = vec4(1., 0., 0., 1.);
}
