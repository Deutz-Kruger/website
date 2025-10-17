import {
  type CosGradientSpec,
  cosineGradient,
  type LCH,
  lch,
  type SRGB,
  srgb,
} from "@thi.ng/color";
import { clamp } from "@thi.ng/math";
import { Vector3 } from "three";

/**
 * Defines the available gradient names.
 * Only used as fallback.
 */
export type GradientNames = "RED" | "BLUE";

/**
 * A record of cosine gradient specifications, indexed by `GradientNames`.
 * Only used as fallback.
 */
export const GRADIENT_SPECS: Record<GradientNames, CosGradientSpec> = {
  RED: [
    [3.138, 0.63, 0.008, 1.0],
    [0.048, -0.512, -0.152, 1.0],
    [1.0, 1.0, 1.0, 1.0],
    [0.398, 0.333, 0.667, 1.0],
  ],
  BLUE: [
    [-0.122, 0.488, 0.868, 1.0],
    [-1.112, -0.602, -0.492, 1.0],
    [1.0, 1.0, 1.0, 1.0],
    [0.398, 0.333, 0.667, 1.0],
  ],
};

/**
 * @deprecated
 * An object containing functions to generate cosine gradients for each defined `GradientNames`.
 */
export const COS_GRADIENT = {
  RED: (numColors: number = 256) =>
    cosineGradient(numColors, GRADIENT_SPECS.RED),
  BLUE: (numColors: number = 256) =>
    cosineGradient(numColors, GRADIENT_SPECS.BLUE),
};

/**
 * @description: Accepts an array of hex color strings and returns a gradient uniform, to be processed by a fragment shader
 */
export const generateGradientUniforms = (hexColors: string[]) => {
  // Generate lighter and darker variations
  const allVariations = hexColors.flatMap((color) => {
    const baseLCH = lch(srgb(color));
    return generateVariation(baseLCH);
  });

  allVariations.sort((a, b) => {
    const lightnessA = (a.r + a.g + a.b) / 3;
    const lightnessB = (b.r + b.g + b.b) / 3;
    return lightnessA - lightnessB;
  });

  const darkestCol = allVariations[0];
  const lightestCol = allVariations[allVariations.length - 1];

  // Compute cosine coefficients
  const coeffs = cosineCoefficients(darkestCol, lightestCol);

  // Map coefficients to Vector3
  const aVec = new Vector3(...coeffs.a);
  const bVec = new Vector3(...coeffs.b);
  const cVec = new Vector3(...coeffs.c);
  const dVec = new Vector3(...coeffs.d);

  // Return the coefficients as an array of Vector3
  return [aVec, bVec, cVec, dVec];
};

const generateVariation = (col: LCH) => {
  const variations = [-0.4, -0.2, 0.2, 0.4].map((delta) => {
    const lchColor = col.copy();
    lchColor.l = clamp(col.l + delta, 0, 1);
    return srgb(lchColor);
  });
  return variations;
};

const cosineCoefficients = (col1: SRGB, col2: SRGB) => {
  const amp = [
    0.5 * (col1.r - col2.r),
    0.5 * (col1.g - col2.g),
    0.5 * (col1.b - col2.b),
  ];
  const offset = [col1.r - amp[0], col1.g - amp[1], col1.b - amp[2]];
  const freq = [-0.5, -0.5, -0.5];
  const phase = [0.0, 0.0, 0.0];
  return { a: offset, b: amp, c: freq, d: phase };
};
