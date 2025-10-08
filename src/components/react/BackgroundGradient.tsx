import { Canvas } from "@react-three/fiber";

import { cn } from "@/utils/cn";
import { type GradientNames } from "@/utils/gradients";

import { GradientPlane } from "../r3f/GradientPlane";

interface Props extends React.PropsWithChildren {
  gradientCol: GradientNames;
  className?: string;
}

export const BackgroundGradient = ({
  gradientCol,
  className,
  children,
}: Props) => {
  return (
    <div
      aria-label="Gradient Container"
      className={cn("relative h-full w-full", className)}
    >
      <div
        aria-label="R3F Canvas Wrapper"
        className="z-1 absolute left-0 top-0 h-full w-full"
      >
        <Canvas>
          <GradientPlane gradientPreset={gradientCol} />
        </Canvas>
      </div>
      <div
        aria-label="Content Wrapper"
        className="z-2 relative flex h-full items-center justify-between"
      >
        {children}
      </div>
    </div>
  );
};
