#pragma glslify: noise = require('glsl-noise/simplex/3d')

// Time and scroll uniforms
uniform float uTime;
uniform float uScrollProgress;

// Color palette uniforms
uniform vec3 uColourPalette[4];

// Distortion uniforms
uniform float uUvScale;
uniform float uUvDistortionIterations;
uniform float uUvDistortionIntensity;

// NEW: Blur control uniforms
uniform float uBlurRadius; // How far to sample (in UV space, e.g., 0.01)
uniform float uBlurStrength; // 0 = sharp, 1 = fully blurred

varying vec2 vUv;

// Color palette function (unchanged)
// http://dev.thi.ng/gradients/
vec3 cosineGradientColour(in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d) {
  return clamp(a + b * cos(6.28318 * (c * t + d)), 0.0, 1.0);
}

/**
 * HELPER FUNCTION: Get the gradient color at a specific UV coordinate
 * This encapsulates all your existing gradient logic in one place
 *
 * Why? This lets us call the same gradient calculation from multiple places
 * (both for the sharp version and for each blur sample)
 */
vec3 getGradientColor(vec2 uv) {
  // Apply scroll offset
  uv.y -= uScrollProgress;

  // Apply scale
  uv *= uUvScale;

  // Apply iterative UV distortion based on noise
  // Note: We're using the loop variable correctly now
  for (float i = 0.0; i < uUvDistortionIterations; i++) {
    uv += noise(vec3(uv - i * 0.025, uTime + i * 32.)) * uUvDistortionIntensity;
  }

  // Sample noise to get our gradient position
  float colourInput = noise(vec3(uv, sin(uTime))) * 0.5 + 0.5;

  // Map through cosine gradient using our color palette
  return cosineGradientColour(
    colourInput,
    uColourPalette[0],
    uColourPalette[1],
    uColourPalette[2],
    uColourPalette[3]
  );
}

/**
 * BLUR FUNCTION: Sample the gradient at multiple nearby points and average
 *
 * How it works:
 * - We sample in a "plus" pattern (center + 4 cardinal directions)
 * - This is called a "5-tap box blur" - simple but effective
 * - Each sample is offset by `radius` in UV space
 *
 * Why this pattern?
 * - It's fast (only 5 samples)
 * - It's visually smooth for gradients
 * - It's easy to understand and modify
 */
vec3 getBlurredGradientColor(vec2 uv, float radius) {
  // vec3 colorSum = vec3(0.0);

  vec3 colorSum = getGradientColor(uv);
  colorSum += getGradientColor(uv + vec2(radius, 0.0));
  colorSum += getGradientColor(uv - vec2(radius, 0.0));
  return colorSum / 3.0; // 3 samples instead of 5

  // Sample pattern: center + 4 cardinal directions
  // Think of this as a "+" shape centered on our pixel

  // Center sample (weight = 1)
  colorSum += getGradientColor(uv);

  // Right sample
  colorSum += getGradientColor(uv + vec2(radius, 0.0));

  // Left sample
  colorSum += getGradientColor(uv - vec2(radius, 0.0));

  // Top sample
  colorSum += getGradientColor(uv + vec2(0.0, radius));

  // Bottom sample
  colorSum += getGradientColor(uv - vec2(0.0, radius));

  // Average all 5 samples
  return colorSum / 5.0;

  // Alternative: For stronger blur, you could add diagonal samples:
  // colorSum += getGradientColor(uv + vec2(radius, radius) * 0.707);
  // colorSum += getGradientColor(uv + vec2(-radius, radius) * 0.707);
  // colorSum += getGradientColor(uv + vec2(radius, -radius) * 0.707);
  // colorSum += getGradientColor(uv + vec2(-radius, -radius) * 0.707);
  // return colorSum / 9.0;
}

void main() {
  // Get the sharp (original) color
  vec3 sharpColor = getGradientColor(vUv);

  // Get the blurred color
  // Only calculate if we actually need it (optimization)
  vec3 blurredColor = sharpColor;
  if (uBlurStrength > 0.0 && uBlurRadius > 0.0) {
    blurredColor = getBlurredGradientColor(vUv, uBlurRadius);
  }

  // Blend between sharp and blurred based on strength
  // uBlurStrength = 0: fully sharp
  // uBlurStrength = 1: fully blurred
  // uBlurStrength = 0.5: 50/50 mix
  vec3 finalColor = mix(sharpColor, blurredColor, uBlurStrength);

  gl_FragColor = vec4(finalColor, 1.0);
}
