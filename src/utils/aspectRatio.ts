/**
 * Represents the simplified aspect ratio of an element.
 */
export interface AspectRatio {
  width: number;
  height: number;
}

/**
 * Calculates the greatest common divisor (GCD) of two numbers.
 * This is a helper function used to simplify fractions, which in turn
 * helps in simplifying aspect ratios.
 *
 * @param numA - The first number.
 * @param numB - The second number.
 * @returns The greatest common divisor of `numA` and `numB`.
 *
 */
export const getGCD = (numA: number, numB: number): number => {
  if (numB === 0) {
    return numA;
  }
  return getGCD(numB, numA % numB);
};

/**
 * Calculates the aspect ratio of given width and height, simplifying it to its lowest terms.
 * For example, a 1920x1080 resolution would result in an aspect ratio of { width: 16, height: 9 }.
 *
 * @param width - The width of the element.
 * @param height - The height of the element.
 * @returns An object containing the simplified width and height of the aspect ratio.
 *
 */
export const getAspectRatio = (width: number, height: number): AspectRatio => {
  const gcd = getGCD(width, height);
  return {
    width: width / gcd,
    height: height / gcd,
  };
};

/**
 * Calculates the aspect ratio as a percentage, useful for the `padding-bottom` CSS trick
 * to maintain aspect ratio for responsive elements.
 *
 * @param width - The width of the element.
 * @param height - The height of the element.
 * @returns The aspect ratio as a percentage (e.g., 56.25 for 16:9).
 *
 */
export const getAspectPercantage = (width: number, height: number): number => {
  const aspectRatio = getAspectRatio(width, height);
  return (aspectRatio.height / aspectRatio.width) * 100;
};
