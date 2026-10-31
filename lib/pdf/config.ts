// TODO(demo): 임시값. 데모용 PDF로 결과를 보고 조정한다.
// "글자 크기 대비" 값은 문서 본문 글자 크기에 곱해서 쓴다.

// 조각 사이에 공백을 넣을 가로 간격 (글자 크기 대비)
export const WORD_GAP_RATIO = 0.15;
// 한글 낱자 사이가 이보다 넓으면 균등 배분(산   쵸)으로 보고 붙인다 (글자 크기 대비, 양쪽 정렬 줄은 제외)
export const LETTER_SPACED_GAP_RATIO = 1.5;
// 같은 줄로 볼 세로 중심 차이 (글자 크기 대비)
export const ROW_CENTER_TOLERANCE = 0.5;

// 단 경계(세로 빈 띠)의 최소 너비 (글자 크기 대비)
export const GUTTER_MIN_RATIO = 1;
// 단 경계로 인정할 최소 행 수, 그리고 페이지 전체 행 대비 비율
export const GUTTER_MIN_ROWS = 3;
export const GUTTER_ROW_RATIO = 0.25;
// 단 경계 양쪽 글의 행당 글자 수 중간값이 이보다 적으면 단이 아니라 표·목록으로 본다
export const COLUMN_MIN_CHARS = 8;
// 전체 폭 문단의 마지막 줄로 볼 바로 위 행과의 최대 거리 (글자 크기 대비)
export const ROW_ATTACH_RATIO = 1.6;
// 이미지·도형이 페이지의 이 비율보다 넓으면 배경으로 보고 무시한다
export const BACKGROUND_IMAGE_RATIO = 0.5;
// 이 거리(pt) 안에 있는 도형끼리 한 그림으로 묶는다
export const FIGURE_MERGE_GAP = 6;
// 도형이 이만큼 모인 영역을 벡터 그림으로 보고 안의 글자를 지운다
export const FIGURE_MIN_SHAPES = 5;
// 가로나 세로가 이보다 얇은 도형(밑줄, 구분선)은 그림 판단에서 뺀다 (pt)
export const FIGURE_MIN_THICKNESS = 1.5;

// 줄 간격이 페이지 중간값의 이 배수를 넘으면 새 문단
export const PARAGRAPH_GAP_RATIO = 1.3;
// 글자 크기가 이 비율 이상 바뀌면 새 문단 (제목)
export const FONT_SIZE_CHANGE_RATIO = 0.15;
// 문장 끝으로 끝난 줄의 너비가 가장 긴 줄의 이 비율 미만이면 문단 끝
export const SHORT_LINE_RATIO = 0.8;
// 문장 부호가 없어도 이 비율 미만이면 문단 끝 (제목, 가운데 정렬 줄)
export const VERY_SHORT_LINE_RATIO = 0.6;
// 왼쪽 여백보다 글자 크기의 이 배수 이상 들여 쓰면 새 문단
export const INDENT_RATIO = 1;

// 위첨자로 볼 글자 크기 비율과 기준선에서 올라간 정도 (글자 크기 대비)
export const SUPERSCRIPT_SIZE_RATIO = 0.9;
export const SUPERSCRIPT_RISE_RATIO = 0.2;

// 줄 안에서 이보다 넓은 간격은 표의 칸 사이로 본다 (글자 크기 대비)
export const TABLE_GAP_RATIO = 2;
// 칸 간격이 있는 줄이 이만큼 이어지면 표로 보고 지운다
export const TABLE_MIN_ROWS = 2;
// 토큰 3개 이상 중 숫자가 이 비율 이상인 줄은 표의 행으로 본다
export const TABLE_NUMERIC_RATIO = 0.6;
// 표 바로 위아래 줄에 이보다 넓은 간격이 있으면 머리글 행으로 보고 함께 지운다 (글자 크기 대비)
export const TABLE_EDGE_GAP_RATIO = 1;
// 본문보다 이 비율 이상 작고, 단 너비의 이 비율보다 짧은 줄은 그림 안 글자로 보고 지운다
export const SMALL_FONT_RATIO = 0.85;
export const SHORT_LABEL_RATIO = 0.5;
// 이보다 짧은 "표 1 ..." 문단은 구두점이 없어도 캡션으로 본다
export const CAPTION_MAX_CHARS = 150;

// 한글 줄 경계 중 "두 조각을 붙인 어절이 문서에 있는" 비율이 이 이상이면 단어 중간 줄바꿈 문서로 본다
export const MID_WORD_BREAK_RATIO = 0.15;
// 줄바꿈 방식을 판단할 최소 한글 줄 경계 수. 이보다 적으면 단어 중간 줄바꿈 문서(편집기 기본값)로 본다
export const MIN_WRAP_EVIDENCE = 10;
// 줄 끝 조사·어미 비율이 "글자 단위 예상값 → 어절 단위 예상값" 사이 이 지점을 넘으면 어절 단위 줄바꿈으로 본다
export const WORD_WRAP_THRESHOLD = 0.6;

// 문장 중간 줄 중 오른쪽 끝이 글자 크기의 이 배수보다 덜 찬 줄이 이 비율 이상이면 어절 단위 줄바꿈 문서로 본다
export const RAGGED_RIGHT_RATIO = 1;
export const RAGGED_LINE_SHARE = 0.3;
export const RAGGED_MIN_LINES = 5;

// 이 비율 이상의 페이지 위·아래에 반복되는 줄은 머리말·꼬리말로 보고 지운다
export const RUNNING_LINE_PAGE_RATIO = 0.5;

// 이보다 짧은 블록은 다음 블록에 붙인다 (제목 등)
export const MIN_BLOCK_CHARS = 40;
// 이보다 긴 블록은 문장 경계에서 나눈다 (화면에서 3~5줄, 시선이 한 블록에 머무는 시간 기준)
export const MAX_BLOCK_CHARS = 250;
