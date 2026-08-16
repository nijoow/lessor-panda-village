import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 실행 터미널이 상위 폴더에 있어도 모듈을 이 프로젝트 안에서 해석한다.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
