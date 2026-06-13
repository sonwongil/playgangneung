---
name: git 차단 시 보고 원칙
description: git commit/push가 차단됐을 때 우회 금지 및 보고 후 승인 대기 절차
---

## 규칙

`git commit` 또는 `git push`가 Replit sandbox에 의해 차단되면:

1. **어떤 우회도 하지 않는다** — Python 스크립트, Node.js child_process, `.git/index.lock` 강제 삭제, 임시 shell 스크립트 등 일체 금지.
2. **즉시 아래 7가지 상태를 보고한다.**
3. **사용자 승인을 받은 후에만 다음 조치를 진행한다.**

## 보고 항목 (모두 read-only)

```bash
git --no-optional-locks status
git --no-optional-locks branch --show-current
git --no-optional-locks log --oneline -5
git --no-optional-locks remote -v
ls .git/index.lock 2>/dev/null && echo "LOCK EXISTS" || echo "no lock"
```

- 변경 파일 목록 (status 결과 기반)
- 차단된 정확한 에러 메시지 전문

**Why:** 사용자가 git 히스토리·상태를 직접 관리하는 프로젝트이므로, agent가 무단으로 git 객체를 조작하면 히스토리 오염·충돌 위험이 있다.

**How to apply:** git write 작업(add/commit/push/reset 등) 실패 시 항상 이 절차를 먼저 실행. 성공한 경우에는 불필요.
