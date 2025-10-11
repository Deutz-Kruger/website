import { Canvas } from "@react-three/fiber";
import { Leva } from "leva";
import React from "react";
import { Vector3 } from "three";

import { cn } from "@/utils/cn";
import { generateGradientUniforms, GRADIENT_SPECS } from "@/utils/gradients";

import { GradientPlane } from "../r3f/GradientPlane";
import styles from "./BackgroundGradient.module.css";

interface BaseProps extends React.PropsWithChildren {
  gradientCols?: string[];
  className?: string;
}

interface ImagesProps extends BaseProps {
  contentType: "images";
  images: {
    image: string;
    alt: string;
  }[];
}

interface VideoProps extends BaseProps {
  contentType: "video";
  video: string;
}

type Props = ImagesProps | VideoProps;

export const BackgroundGradient = (props: Props) => {
  const { className, gradientCols, children, contentType } = props;

  const gradient =
    gradientCols && gradientCols?.length > 1
      ? generateGradientUniforms(gradientCols)
      : GRADIENT_SPECS["BLUE"].map((color) => new Vector3(...color));

  const numberOfItems = contentType === "images" ? props.images.length : 1;

  const gridStyle = {
    "--sm-grid-cols": Math.min(numberOfItems, 2),
    "--md-grid-cols": Math.min(numberOfItems, 4),
  } as React.CSSProperties;

  return (
    <div
      aria-label="Gradient Container"
      className={cn("relative w-full", className)}
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
        style={gridStyle}
        aria-label="Content Wrapper"
        className={cn(className, "z-2 relative h-full", styles.dynamicGrid)}
      >
        {children}
      </div>
      <Leva hidden={true} />
    </div>
  );
};
