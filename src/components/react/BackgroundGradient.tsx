import { COS_GRADIENT, type GradientNames } from "@/utils/gradients";

export const BackgroundGradient = ({
  gradientCol,
}: {
  gradientCol: GradientNames;
}) => {
  const gradient = COS_GRADIENT[gradientCol]();
  console.log(gradient);
  return <div></div>;
};
