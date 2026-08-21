// CubeNest Edge Function — GET/POST /functions/v1/config
// 랜딩이 쓰는 **UI 메타데이터 단일 출처**: 열린 스테이지 · 스테이지별 유형·서브 · 지원 등급.
//
// 왜 서버에서 주나: 랜딩(quiz/index.html)이 카드마다 levels 를 하드코딩하고 있어 서버 지원
//   등급과 계속 어긋났다(count 는 '상'을 팔지만 서버는 '중'까지 → 조용히 강등, heightmap·
//   facesMc 는 서버가 최상까지 지원하는데 랜딩이 숨김). 두 곳을 각자 고치는 구조를 끝낸다.
//
// IP 우려 없음: 여기서 나가는 것은 "어느 학년에 어떤 유형이 몇 등급으로 열리는가" 뿐이다.
//   문제 공간·정답 규칙(gen·gen-config 의 밴드·프리셋 값)은 내려보내지 않는다.
//   그래서 rate limit 도 걸지 않는다(정적 메타, 캐시 가능).
import { preflight, json } from "../_shared/cors.ts";
import { genConfig } from "../_shared/gen-modules.ts";

const TYPE_LABEL: Record<string, string> = {
  count: "개수 세기", volume: "부피 구하기", surface: "겉넓이 구하기",
  heightmap: "위에서 본 수 쓰기", facesMc: "위·앞·옆 모양 고르기", facesDraw: "위·앞·옆 그리기",
  minmax: "최대·최소", hidden: "안 보이는 나무", manip: "조작",
};

Deno.serve((req: Request) => {
  const pf = preflight(req); if (pf) return pf;

  const stages = genConfig.stages().map((s: any) => {
    const types: Record<string, any> = {};
    for (const t of genConfig.typesFor(s.id)) {
      const subs = genConfig.subsFor(t, s.id);
      types[t] = {
        label: TYPE_LABEL[t] ?? t,
        levels: genConfig.support(t, s.id),     // 실제 지원 등급 — 랜딩은 이것만 노출한다
        subs,                                   // null = 전 서브
        // 지면(worksheets 독립 생성)에서 성립하는가. 서브별로 갈리는 유형은 서브 단위로 준다.
        paper: subs ? subs.filter((sb: string) => genConfig.paperSafe(t, sb))
                    : (genConfig.paperSafe(t, null) ? true : false),
      };
    }
    return { id: s.id, grade: s.grade, age: s.age, dim: s.dim, note: s.note ?? null, types };
  });

  const r = json(req, {
    version: genConfig.VERSION,
    defaultStage: genConfig.DEFAULT_STAGE,      // 초6 — 스테이지를 안 고른 사용자가 있는 자리
    levels: genConfig.ORDER,
    stages,
  });
  r.headers.set("Cache-Control", "public, max-age=300");
  return r;
});
