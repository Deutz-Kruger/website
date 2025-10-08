declare module '@shaders/gradient_bg/gradient.frag' {
    namespace THREE {
        export type Vector3 = { x: number, y: number, z: number, isVector3: true };
        export type Color = { r: number, g: number, b: number, isColor: true };
    }

    const gradient: string;

    type Uniforms = {
        uTime: number,
        uScrollProgress: number,
        uColourPalette: [number, number, number, number, number, number, number, number, number, number, number, number] | Float32Array | [[number, number, number], [number, number, number], [number, number, number], [number, number, number]] | [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3] | [THREE.Color, THREE.Color, THREE.Color, THREE.Color],
        uUvScale: number,
        uUvDistortionIterations: number,
        uUvDistortionIntensity: number
    };

    export {
        gradient as default,
        gradient as glsl,
        gradient,
        Uniforms,
        Uniforms as GradientUniforms
    };
}