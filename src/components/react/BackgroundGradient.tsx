import { Canvas } from "@react-three/fiber";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Vector3 } from "three";

import { cn } from "@/utils/cn";
import { generateGradientUniforms, GRADIENT_SPECS } from "@/utils/gradients";

import { GradientPlane } from "../r3f/GradientPlane";

interface Props extends React.PropsWithChildren {
  gradientCols?: string[];
  className?: string;
}

const GradientCanvas = ({ gradient }: { gradient: Vector3[] }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Observe visibility to pause rendering when off-screen
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsVisible(entry.isIntersecting);
        });
      },
      { threshold: 0.1 },
    );

    if (canvasRef.current) {
      observer.observe(canvasRef.current);
    }

    return () => {
      observer.disconnect();

      // Force WebGL context cleanup
      if (canvasRef.current) {
        const gl =
          canvasRef.current.getContext("webgl2") ||
          canvasRef.current.getContext("webgl") ||
          canvasRef.current.getContext("experimental-webgl");
        if (gl && "getExtension" in gl) {
          const loseContext = gl.getExtension("WEBGL_lose_context");
          if (loseContext) {
            loseContext.loseContext();
          }
        }
      }
    };
  }, []);

  return (
    <Canvas
      ref={canvasRef}
      gl={{
        powerPreference: "high-performance",
        antialias: false,
        preserveDrawingBuffer: false,
      }}
      dpr={
        typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 2) : 1
      }
      // Only render when visible
      frameloop={isVisible ? "always" : "never"}
      // Reduce frame rate to save power
      performance={{ min: 0.5 }}
    >
      <GradientPlane gradient={gradient} />
    </Canvas>
  );
};

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
        className="absolute left-0 top-0 h-full w-full"
      >
        {/*{
          <Canvas
            gl={{ powerPreference: "high-performance", antialias: false }}
            dpr={1}
          >
            <GradientPlane gradient={gradient} />
          </Canvas>
        }*/}
        <GradientCanvas gradient={gradient} />
      </div>
      <div
        aria-label="Content Wrapper"
        className={cn(className, "relative h-full")}
      >
        {children}
      </div>
    </div>
  );
};
