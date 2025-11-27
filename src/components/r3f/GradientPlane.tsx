import { ScreenQuad, shaderMaterial } from "@react-three/drei";
import { extend, useFrame } from "@react-three/fiber";
import fragmentShader from "@shaders/gradient_bg/gradient.frag";
import vertexShader from "@shaders/gradient_bg/gradient.vert";
import { useEffect, useRef } from "react";
import { ShaderMaterial, Vector3 } from "three";

import { GRADIENT_SPECS } from "@/utils/gradients";

type Uniforms = {
  uTime: number;
  uColourPalette: Vector3[];
  uUvScale: number;
  uUvDistortionIterations: number;
  uUvDistortionIntensity: number;
  // NEW: Blur uniforms
  uBlurRadius: number;
  uBlurStrength: number;
};

interface Props {
  gradient: Vector3[];
}

const DEFAULT_COLOUR_PALETTE: Vector3[] = GRADIENT_SPECS["BLUE"].map(
  (color) => new Vector3(...color),
);

const INITIAL_UNIFORMS: Uniforms = {
  uTime: 0,
  uColourPalette: DEFAULT_COLOUR_PALETTE,
  uUvScale: 0.8,
  uUvDistortionIterations: 2,
  uUvDistortionIntensity: 0.2,
  uBlurRadius: 0.005,
  uBlurStrength: 0.15,
};

const GradientShaderMaterial = shaderMaterial(
  INITIAL_UNIFORMS,
  vertexShader,
  fragmentShader,
);

extend({ GradientShaderMaterial });

declare module "@react-three/fiber" {
  interface ThreeElements {
    gradientShaderMaterial: React.ComponentProps<"shaderMaterial"> &
      Partial<Uniforms>;
  }
}

export const GradientPlane = ({ gradient }: Props) => {
  const gradientShader = useRef<ShaderMaterial & Partial<Uniforms>>(null);
  const frameCount = useRef(0);

  useFrame(({ clock }) => {
    if (!gradientShader.current) return;
    frameCount.current++;

    if (frameCount.current % 2 === 0 && gradientShader.current) {
      gradientShader.current.uTime = clock.elapsedTime * 0.03;
    }
  });

  useEffect(() => {
    return () => {
      // Dispose shader material on unmount
      if (gradientShader.current) {
        try {
          gradientShader.current.dispose();
        } catch (e) {
          console.warn("Error disposing shader material:", e);
        }
      }
    };
  }, []);

  return (
    <ScreenQuad>
      <gradientShaderMaterial
        ref={gradientShader}
        uTime={0}
        uColourPalette={gradient}
        uUvScale={0.8}
        uUvDistortionIterations={2}
        uUvDistortionIntensity={0.2}
        uBlurRadius={0.005}
        uBlurStrength={0.15}
      />
    </ScreenQuad>
  );
};
