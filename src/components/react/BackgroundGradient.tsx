import { Canvas } from "@react-three/fiber";
import { Leva } from "leva";
import React from "react";
import { Vector3 } from "three";

import { cn } from "@/utils/cn";
import { generateGradientUniforms, GRADIENT_SPECS } from "@/utils/gradients";

import { GradientPlane } from "../r3f/GradientPlane";

interface Props extends React.PropsWithChildren {
  gradientCols?: string[];
  className?: string;
  numberOfItems: number;
}

export const BackgroundGradient = (props: Props) => {
  const { className, gradientCols, children } = props;

  const gradient =
    gradientCols && gradientCols?.length > 1
      ? generateGradientUniforms(gradientCols)
      : GRADIENT_SPECS["BLUE"].map((color) => new Vector3(...color));

  return (
    <div
      aria-label="Gradient Container"
      className={cn("relative h-fit w-full", className)}
    >
      <div
        aria-label="R3F Canvas Wrapper"
        className="z-1 absolute left-0 top-0 h-full w-full"
      >
        <Canvas>
          <GradientPlane gradient={gradient} />
        </Canvas>
      </div>
      <div
        aria-label="Content Wrapper"
        className={cn(className, "z-2 relative h-full")}
      >
        {children}
      </div>
      <Leva hidden={true} />
    </div>
  );
};
