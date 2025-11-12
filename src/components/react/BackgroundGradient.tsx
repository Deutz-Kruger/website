import { Canvas } from "@react-three/fiber";
import React, { useMemo } from "react";
import { Vector3 } from "three";

import { cn } from "@/utils/cn";
import { generateGradientUniforms, GRADIENT_SPECS } from "@/utils/gradients";

import { GradientPlane } from "../r3f/GradientPlane";

interface Props extends React.PropsWithChildren {
  gradientCols?: string[];
  className?: string;
}

export const BackgroundGradient = (props: Props) => {
  const { className, gradientCols, children } = props;

  const gradient = useMemo(
    () =>
      gradientCols && gradientCols?.length > 1
        ? generateGradientUniforms(gradientCols)
        : GRADIENT_SPECS["BLUE"].map((color) => new Vector3(...color)),
    [gradientCols],
  );

  return (
    <div
      aria-label="Gradient Container"
      className={cn("relative h-fit w-full backdrop-blur-md", className)}
    >
      <div
        aria-label="R3F Canvas Wrapper"
        className="z-1 absolute left-0 top-0 h-full w-full"
      >
        <Canvas
          gl={{ powerPreference: "high-performance", antialias: false }}
          dpr={1}
        >
          <GradientPlane gradient={gradient} />
        </Canvas>
      </div>
      <div
        aria-label="Content Wrapper"
        className={cn(className, "z-2 relative h-full")}
      >
        {children}
      </div>
    </div>
  );
};
