import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Service Worker 등록은 vite-plugin-pwa의 injectRegister: 'auto' 가 처리합니다.
// 빌드된 index.html에 registerSW.js 스크립트가 자동 주입되어:
//   - 새 SW 감지 시 skipWaiting → clientsClaim → 자동 reload
// 수동 등록 코드를 여기에 두지 마세요 (이중 등록 방지).

createRoot(document.getElementById("root")!).render(<App />);
