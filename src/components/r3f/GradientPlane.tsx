import { ScreenQuad, shaderMaterial } from "@react-three/drei";
import { extend, useFrame } from "@react-three/fiber";
import fragmentShader from "@shaders/gradient_bg/gradient.frag";
import vertexShader from "@shaders/gradient_bg/gradient.vert";
import { useControls } from "leva";
import { useRef } from "react";
import { ShaderMaterial, Vector3 } from "three";

import { GRADIENT_SPECS, type GradientNames } from "@/utils/gradients";

type Uniforms = {
  uTime: number;
  uColourPalette: Vector3[];
  uUvScale: number;
  uUvDistortionIterations: number;
  uUvDistortionIntensity: number;
};

interface Props {
  gradientPreset: GradientNames;
}

const DEFAULT_COLOUR_PALETTE: Vector3[] = GRADIENT_SPECS["BLUE"].map(
  (color) => new Vector3(...color),
);

const INITIAL_UNIFORMS: Uniforms = {
  uTime: 0,
  uColourPalette: DEFAULT_COLOUR_PALETTE,
  uUvScale: 1,
  uUvDistortionIterations: 0,
  uUvDistortionIntensity: 0,
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

// TODO: enable passing of color
export const GradientPlane = ({ gradientPreset }: Props) => {
  console.log(gradientPreset);

  const gradientShader = useRef<ShaderMaterial & Partial<Uniforms>>(null);

  const {
    colourPalette,
    timeMultiplier,
    scale,
    distortionIterations,
    distortionIntensity,
  } = useConfig();

  useFrame(({ clock }) => {
    if (!gradientShader.current) return;
    gradientShader.current.uTime = clock.elapsedTime * timeMultiplier;
  });

  return (
    <ScreenQuad>
      <gradientShaderMaterial
        key={GradientShaderMaterial.key}
        ref={gradientShader}
        // Uniforms
        uTime={0}
        uColourPalette={colourPalette}
        uUvScale={scale}
        uUvDistortionIterations={distortionIterations}
        uUvDistortionIntensity={distortionIntensity}
      />
    </ScreenQuad>
  );
};

type Config = {
  colourPalette: Vector3[];
  timeMultiplier: number;
  scale: number;
  distortionIterations: number;
  distortionIntensity: number;
};

function useConfig(): Config {
  // Config for the shader
  const {
    paletteKey,
    timeMultiplier,
    scale,
    distortionIterations,
    distortionIntensity,
  } = useControls({
    paletteKey: {
      label: "Palette",
      value: "BLUE" as GradientNames,
      options: Object.keys(GRADIENT_SPECS),
    },
    timeMultiplier: {
      label: "Time Multiplier",
      value: 0.1,
      min: 0,
      max: 1,
      step: 0.05,
    },
    scale: {
      label: "Scale",
      value: 1,
      min: 0.1,
      max: 4,
      step: 0.1,
    },
    distortionIterations: {
      label: "Iterations",
      value: 6,
      min: 0,
      max: 14,
      step: 1,
    },
    distortionIntensity: {
      label: "Intensity",
      value: 0.3,
      min: 0,
      max: 1,
      step: 0.02,
      render: (get) => get("distortionIterations") > 0,
    },
  });

  const colourPaletteVec3 = GRADIENT_SPECS[paletteKey as GradientNames].map(
    (color) => new Vector3(...color),
  );

  return {
    colourPalette: colourPaletteVec3,
    timeMultiplier,
    scale,
    distortionIterations,
    distortionIntensity,
  };
}
