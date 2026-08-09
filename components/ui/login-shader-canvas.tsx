"use client";

import { useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { fragmentShader, vertexShader } from "@/components/ui/login-shader-source";
import type { LoginBackgroundPalette } from "@/lib/login-background-theme";

// Chậm hơn bản gốc (1.0) cho đỡ hút mắt khỏi phần đăng nhập.
const SPEED = 0.6;

function GradientPlane({ palette }: { palette: LoginBackgroundPalette }) {
  // Tạo một lần rồi cập nhật trong useFrame — đổi theme không phải dựng lại material.
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uColor1: { value: new THREE.Color(palette.color1) },
      uColor2: { value: new THREE.Color(palette.color2) },
      uFadeColor: { value: new THREE.Color(palette.fade) }
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useFrame((state) => {
    uniforms.uTime.value = state.clock.getElapsedTime() * SPEED;
    uniforms.uResolution.value.set(state.size.width, state.size.height);
    uniforms.uColor1.value.set(palette.color1);
    uniforms.uColor2.value.set(palette.color2);
    uniforms.uFadeColor.value.set(palette.fade);
  });

  return (
    <mesh scale={[2, 2, 1]}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}

export default function LoginShaderCanvas({
  palette
}: {
  palette: LoginBackgroundPalette;
}) {
  return (
    <Canvas
      camera={{ position: [0, 0, 1] }}
      dpr={[1, 1.5]}
      gl={{ antialias: false, alpha: true, powerPreference: "low-power" }}
    >
      <GradientPlane palette={palette} />
    </Canvas>
  );
}
