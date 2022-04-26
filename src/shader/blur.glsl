float getRadius(float depth) {
    return clamp(depth, 0.0, 1.);
}

void blur(
    in vec2 A,
    in vec2 direction,
    in float scale,
    in sampler2D inTexture,
    out vec4 outColor
) {
    const int KERNEL_SIZE = 6;
    float gaussian[KERNEL_SIZE];  
    gaussian[5] = 0.04153263993208;
    gaussian[4] = 0.06352050813141;
    gaussian[3] = 0.08822292796029;
    gaussian[2] = 0.11143948794984;
    gaussian[1] = 0.12815541114232;
    gaussian[0] = 0.13425804976814;

    vec4 resultColor = vec4(0.);
    float weightSum = 0.;

    // position of the current pixel
    vec2 texelSize = 1. / vec2(texSize(inTexture, 0));
    vec4 colorA = tex(inTexture, A);
    float depthA = colorA.a;
    float rA = getRadius(depthA);

    // scatter as you gather loop
    for(int i = -KERNEL_SIZE; i < KERNEL_SIZE; ++i) {
        vec2 B = A + direction * ((float(i) * scale) * texelSize);
        vec4 colorB = tex(inTexture, B);
        float depthB = colorB.a;
        float rB = getRadius(depthB);

        float blurWeight = gaussian[abs(i)];

        // only consider if B is in front of A
        float bNearerWeight = clamp(abs(rA) - abs(rB) + 1., 0., .5);
        float weight = bNearerWeight * blurWeight;
        weightSum += weight;
        resultColor.rgb += colorB.rgb * weight;
    }

    // apply total weights
    resultColor.rgb /= weightSum;
    resultColor.a = colorA.a;

    outColor = resultColor;
}

#pragma glslify: export(blur)