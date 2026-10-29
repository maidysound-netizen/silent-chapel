// macOS가 exFAT/외장 드라이브에 만드는 '._*' 메타데이터 파일이 .next 캐시에 섞이면
// Turbopack이 캐시를 열지 못합니다("invalid digit found in string"). 빌드 전에 .next 안에서만 지웁니다.
import { readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

function clean(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const p = join(dir, name);
    if (name.startsWith("._")) {
      rmSync(p, { force: true, recursive: true });
      continue;
    }
    try {
      if (statSync(p).isDirectory()) clean(p);
    } catch {
      /* ignore */
    }
  }
}

clean(".next");
