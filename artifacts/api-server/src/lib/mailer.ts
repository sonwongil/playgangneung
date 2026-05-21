import nodemailer from "nodemailer";
import axios from "axios";
import crypto from "crypto";

export interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface MailResult {
  ok: boolean;
  error?: string;
}

export interface SmsResult {
  ok: boolean;
  error?: string;
}

// ─── 이메일 ────────────────────────────────────────────────────────────────────

function createTransport() {
  const host = process.env["SMTP_HOST"];
  const port = Number(process.env["SMTP_PORT"] ?? "587");
  const user = process.env["SMTP_USER"];
  const pass = process.env["SMTP_PASS"];

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export function isMailConfigured(): boolean {
  return !!(process.env["SMTP_HOST"] && process.env["SMTP_USER"] && process.env["SMTP_PASS"]);
}

export async function sendMail(opts: MailOptions): Promise<MailResult> {
  const transport = createTransport();
  if (!transport) {
    return { ok: false, error: "이메일 설정이 없습니다 (SMTP_HOST, SMTP_USER, SMTP_PASS 환경변수 필요)" };
  }
  const from = process.env["SMTP_FROM"] ?? process.env["SMTP_USER"] ?? "no-reply@playgangneung.com";
  try {
    await transport.sendMail({ from, to: opts.to, subject: opts.subject, html: opts.html, text: opts.text });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "발송 실패";
    return { ok: false, error: msg };
  }
}

// ─── SMS (Coolsms REST API) ────────────────────────────────────────────────────
// 환경변수: SMS_API_KEY, SMS_API_SECRET, SMS_FROM (발신번호)

export function isSmsConfigured(): boolean {
  return !!(process.env["SMS_API_KEY"] && process.env["SMS_API_SECRET"] && process.env["SMS_FROM"]);
}

function coolsmsSignature(apiKey: string, apiSecret: string): { date: string; signature: string; salt: string } {
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(8).toString("hex");
  const hmac = crypto.createHmac("sha256", apiSecret);
  hmac.update(date + salt);
  const signature = hmac.digest("hex");
  return { date, signature, salt };
}

export async function sendSms(to: string, text: string): Promise<SmsResult> {
  const apiKey = process.env["SMS_API_KEY"];
  const apiSecret = process.env["SMS_API_SECRET"];
  const from = process.env["SMS_FROM"];

  if (!apiKey || !apiSecret || !from) {
    return { ok: false, error: "SMS 설정이 없습니다 (SMS_API_KEY, SMS_API_SECRET, SMS_FROM 환경변수 필요)" };
  }

  // 수신번호 정규화 (국내 010-xxxx-xxxx → 01012345678)
  const normalizedTo = to.replace(/[^0-9]/g, "");
  if (!normalizedTo || normalizedTo.length < 9) {
    return { ok: false, error: "유효하지 않은 전화번호입니다" };
  }

  const { date, signature, salt } = coolsmsSignature(apiKey, apiSecret);

  try {
    const response = await axios.post(
      "https://api.coolsms.co.kr/messages/v4/send",
      {
        message: {
          to: normalizedTo,
          from,
          text,
          type: "SMS",
        },
      },
      {
        headers: {
          Authorization: `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );
    if (response.data?.errorCode) {
      return { ok: false, error: `Coolsms 오류: ${response.data.errorCode} ${response.data.errorMessage ?? ""}`.trim() };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "SMS 발송 실패";
    return { ok: false, error: msg };
  }
}

// ─── 이메일 HTML 템플릿 ───────────────────────────────────────────────────────

export function buildReportEmailHtml(params: {
  businessName: string;
  title: string;
  reportUrl: string;
}): string {
  const { businessName, title, reportUrl } = params;
  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Apple SD Gothic Neo',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <tr><td style="background:#1e40af;padding:28px 36px">
          <div style="color:#ffffff;font-size:22px;font-weight:700">PLAY강릉</div>
          <div style="color:#93c5fd;font-size:13px;margin-top:4px">광고 성과 리포트</div>
        </td></tr>
        <tr><td style="padding:36px">
          <p style="margin:0 0 12px;color:#374151;font-size:15px">안녕하세요, <strong>${businessName}</strong> 담당자님.</p>
          <p style="margin:0 0 24px;color:#374151;font-size:15px">
            광고 <strong>「${title}」</strong>의 성과 리포트가 준비되었습니다.<br />
            아래 버튼을 클릭하면 실시간 광고 성과를 확인하실 수 있습니다.
          </p>
          <div style="text-align:center;margin:32px 0">
            <a href="${reportUrl}" target="_blank"
               style="display:inline-block;padding:14px 36px;background:#1e40af;color:#ffffff;border-radius:8px;font-size:15px;font-weight:600;text-decoration:none;letter-spacing:-0.3px">
              📊 성과 리포트 보기
            </a>
          </div>
          <p style="margin:0 0 6px;color:#6b7280;font-size:13px">또는 아래 링크를 브라우저에 직접 붙여넣기 하세요:</p>
          <p style="margin:0;color:#1e40af;font-size:12px;word-break:break-all">${reportUrl}</p>
        </td></tr>
        <tr><td style="padding:20px 36px;border-top:1px solid #f3f4f6;background:#f9fafb">
          <p style="margin:0;color:#9ca3af;font-size:12px">
            본 메일은 PLAY강릉 관리자가 발송한 자동 메일입니다.<br />
            문의사항은 PLAY강릉 담당자에게 연락해 주세요.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function buildPaymentReceiptHtml(params: {
  customerName: string;
  productName: string;
  amount: number;
  orderId: string;
  method: string | null;
  paidAt: string;
}): string {
  const { customerName, productName, amount, orderId, method, paidAt } = params;
  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Apple SD Gothic Neo',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <tr><td style="background:#1e40af;padding:28px 36px">
          <div style="color:#ffffff;font-size:22px;font-weight:700">PLAY강릉</div>
          <div style="color:#93c5fd;font-size:13px;margin-top:4px">광고 결제 영수증</div>
        </td></tr>
        <tr><td style="padding:36px">
          <p style="margin:0 0 8px;color:#374151;font-size:15px">안녕하세요, <strong>${customerName}</strong> 고객님.</p>
          <p style="margin:0 0 28px;color:#374151;font-size:15px">결제가 완료되었습니다. 아래 내역을 확인해 주세요.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
            <tr style="background:#f9fafb"><td style="padding:12px 16px;color:#6b7280;font-size:13px;width:120px">상품명</td><td style="padding:12px 16px;color:#111827;font-size:13px;font-weight:600">${productName}</td></tr>
            <tr style="border-top:1px solid #e5e7eb"><td style="padding:12px 16px;color:#6b7280;font-size:13px">결제금액</td><td style="padding:12px 16px;color:#1e40af;font-size:15px;font-weight:700">₩${amount.toLocaleString("ko-KR")}</td></tr>
            <tr style="border-top:1px solid #e5e7eb"><td style="padding:12px 16px;color:#6b7280;font-size:13px">결제수단</td><td style="padding:12px 16px;color:#111827;font-size:13px">${method ?? "카드"}</td></tr>
            <tr style="border-top:1px solid #e5e7eb"><td style="padding:12px 16px;color:#6b7280;font-size:13px">결제일시</td><td style="padding:12px 16px;color:#111827;font-size:13px">${paidAt}</td></tr>
            <tr style="border-top:1px solid #e5e7eb"><td style="padding:12px 16px;color:#6b7280;font-size:13px">주문번호</td><td style="padding:12px 16px;color:#9ca3af;font-size:11px;font-family:monospace">${orderId}</td></tr>
          </table>
          <p style="margin:24px 0 0;color:#6b7280;font-size:13px">담당자가 확인 후 광고 집행을 안내드립니다.<br />문의: PLAY강릉 운영팀</p>
        </td></tr>
        <tr><td style="padding:20px 36px;border-top:1px solid #f3f4f6;background:#f9fafb">
          <p style="margin:0;color:#9ca3af;font-size:12px">본 메일은 자동 발송된 결제 영수증입니다.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function buildPaymentReceiptSms(params: {
  customerName: string;
  productName: string;
  amount: number;
  orderId: string;
}): string {
  const { customerName, productName, amount, orderId } = params;
  return `[PLAY강릉] ${customerName}님 결제완료\n상품: ${productName}\n금액: ₩${amount.toLocaleString("ko-KR")}\n주문번호: ${orderId}`;
}

export function buildReportSmsText(params: {
  businessName: string;
  title: string;
  reportUrl: string;
}): string {
  const { businessName, title, reportUrl } = params;
  return `[PLAY강릉] ${businessName} 담당자님, 광고 「${title}」 성과 리포트: ${reportUrl}`;
}
