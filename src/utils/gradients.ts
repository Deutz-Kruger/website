import { type CosGradientSpec, cosineGradient } from "@thi.ng/color";

/**
 * Defines the available gradient names.
 */
export type GradientNames = "RED" | "BLUE";

/**
 * A record of cosine gradient specifications, indexed by `GradientNames`.
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
 * An object containing functions to generate cosine gradients for each defined `GradientNames`.
 */
export const COS_GRADIENT = {
  RED: (numColors: number = 256) =>
    cosineGradient(numColors, GRADIENT_SPECS.RED),
  BLUE: (numColors: number = 256) =>
    cosineGradient(numColors, GRADIENT_SPECS.BLUE),
};
