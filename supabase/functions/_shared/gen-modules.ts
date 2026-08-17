// CubeNest Edge Functions — core·gen·config 이식 산출물
// 서버 전용 복사본(cubenest-core.js·cubenest-gen.js)에 ESM named export를 추가해 값 import.
//   - 부수효과 import + globalThis 의존을 제거 → 번들 포함 보장·부팅 크래시 방지.
//   - 원본 IIFE는 파일 상단에서 실행되어 globalThis.CubeNest를 채우고, 하단 export가 이를 노출.
//   - 브라우저용 원본은 assets/js/의 것을 그대로 사용(이 복사본과 무관).

import { core } from "./cubenest-core.js";          // 값 import (번들 포함 보장)
import { genConfig } from "./cubenest-gen-config.js"; // gen보다 먼저(genSession이 참조)
import { hidden } from "./cubenest-hidden.js";        // gen보다 먼저(genProblem hidden 분기가 참조)
import { iso } from "./cubenest-iso.js";              // 겨냥도 SVG(은닉 유형 제시물을 서버가 그린다)
import { gen } from "./cubenest-gen.js";
export { core, gen, genConfig, hidden, iso };

// gen-config: 공개 json 폐지 → 서버 상수(단일 출처).
export const GEN_CONFIG = {
  version: "0.2.0",
  levels: {
    "하":   { gx: 3, gz: 3, maxH: 2, fMin: 3, fMax: 4,  nMin: 4,  nMax: 6,  edge: 1 },
    "중":   { gx: 3, gz: 3, maxH: 3, fMin: 4, fMax: 5,  nMin: 6,  nMax: 9,  edge: 1 },
    "상":   { gx: 4, gz: 4, maxH: 3, fMin: 5, fMax: 7,  nMin: 9,  nMax: 14, edge: 2 },
    "최상": { gx: 5, gz: 5, maxH: 5, fMin: 9, fMax: 14, nMin: 18, nMax: 30, edge: 2 },
  },
};
