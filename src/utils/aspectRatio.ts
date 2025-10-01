export interface AspectRatio {
  width: number;
  height: number;
}

export const getGCD = (numA: number, numB: number): number => {
  if (numB === 0) {
    return numA;
  }
  return getGCD(numB, numA % numB);
};

export const getAspectRatio = (width: number, height: number): AspectRatio => {
  const gcd = getGCD(width, height);
  return {
    width: width / gcd,
    height: height / gcd,
  };
};

export const getAspectPercantage = (width: number, height: number): number => {
  const aspectRatio = getAspectRatio(width, height);
  return (aspectRatio.height / aspectRatio.width) * 100;
};
