varying vec2 vUv;
uniform sampler2D uLottieTexture;
uniform float uTime;
uniform vec2 uMouse;

void main(){

float frequency = 50.0;
float amplitude = 0.04;
float speed = 0.05 * uMouse.x;


float distortion= sin(vUv.y*frequency+(uTime * 5.)*speed)*amplitude;
vec2 distortedPos = vec2(vUv.x, vUv.y+distortion);

vec4 color=texture2D(uLottieTexture, distortedPos);

gl_FragColor=color;
}

