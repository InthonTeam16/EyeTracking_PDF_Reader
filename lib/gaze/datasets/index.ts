import type { GazeSample } from "@/lib/gaze/ridgeRegression";
import set01 from "./set-01.json";
import set02 from "./set-02.json";
import set03 from "./set-03.json";
import set04 from "./set-04.json";
import set05 from "./set-05.json";
import set06 from "./set-06.json";
import set07 from "./set-07.json";
import set08 from "./set-08.json";
import set09 from "./set-09.json";
import set10 from "./set-10.json";

// /lab/gaze/datasets에서 업로드 없이 비교할 수 있는 세트. 서로 중복된 샘플은 뺐다.
// TODO(demo): 쓸 데이터를 정하면 페이지와 함께 지운다.
export const BUILT_IN_SETS: { name: string; samples: GazeSample[] }[] = [
  { name: "set-01", samples: set01 },
  { name: "set-02", samples: set02 },
  { name: "set-03", samples: set03 },
  { name: "set-04", samples: set04 },
  { name: "set-05", samples: set05 },
  { name: "set-06", samples: set06 },
  { name: "set-07", samples: set07 },
  { name: "set-08", samples: set08 },
  { name: "set-09", samples: set09 },
  { name: "set-10", samples: set10 },
];

// 세트를 하나씩 빼고 잰 오차가 낮고, 고개 의존이 심한 세트가 없는 조합.
export const DEFAULT_SET_NAMES = ["set-04", "set-05", "set-06", "set-08"];
