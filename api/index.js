const axios = require('axios');

export default async function handler(req, res) {
  // ---------- CACHE DISABLE ----------
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // ---------- TOKEN CHECK ----------
  const { token } = req.query;
  if (!token) {
    return res.status(400).json({ site: "Moon US Nums", error: "Missing token" });
  }

  // ---------- TARGET URL ----------
  const timestamp = Date.now();
  const target = `https://apinums.com/apinumsofficial/smsapi/poll.php?token=${token}&_=${timestamp}`;

  // ---------- RETRY HELPER ----------
  const fetchWithRetry = async (url, options, retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await axios.get(url, options);
        return response;
      } catch (error) {
        const isNetworkError =
          error.code === 'ECONNRESET' ||
          error.code === 'ETIMEDOUT' ||
          error.code === 'ECONNABORTED' ||
          error.code === 'ENOTFOUND' ||
          error.code === 'EAI_AGAIN';

        if (isNetworkError && i < retries - 1) {
          console.log(`[Retry ${i + 1}/${retries}] ${error.code} on ${url}`);
          await new Promise(res => setTimeout(res, 500));
          continue;
        }
        throw error;
      }
    }
  };

  // ---------- FETCH FROM UPSTREAM ----------
  try {
    const response = await fetchWithRetry(target, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Mobile Safari/537.36",
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Referer": `https://apinums.com/apinumsofficial/smsapi/getsms.php?token=${token}`,
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "X-Requested-With": "XMLHttpRequest",
      },
      timeout: 10000,
      transformResponse: [(data) => data],
      validateStatus: () => true,
    });

    let raw = response.data;
    if (typeof raw !== 'string') raw = JSON.stringify(raw);

    // ---------- PARSE JSON ----------
    let data = null;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { data = JSON.parse(jsonMatch[0]); } catch (e2) {}
      }
    }

    if (!data) {
      return res.status(200).json({
        site: "Moon US Nums",
        status: "waiting",
        debug: "Invalid upstream JSON",
        raw_preview: raw.substring(0, 200),
      });
    }

    // ---------- EXTRACT CODE ----------
    let code = data.code || data.otp_code || (data.codes && data.codes[0]);
    const isWaiting = !code || code === "waiting" || code === "";

    // ---------- DETECT BROWSER vs SCRIPT ----------
    const acceptHeader = req.headers.accept || '';
    const isBrowser = acceptHeader.includes('text/html') && !req.query.format;
    const forceHtml = req.query.format === 'html';
    const forceJson = req.query.format === 'json';

    // ============ HTML OUTPUT (Browser) ============
    if ((isBrowser || forceHtml) && !forceJson) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');

      const displayContent = isWaiting
        ? `<div class="status-badge waiting-badge">
             <span class="dot-pulse"></span>
             Waiting for OTP
           </div>
           <div class="otp-placeholder">- - - - - -</div>
           <div class="info-text">Listening for incoming messages...</div>
           <div class="progress-bar"><div class="progress-fill"></div></div>`
        : `<div class="status-badge success-badge">
             <span class="dot-check">✓</span>
             Code Received
           </div>
           <div class="otp-code">${code}</div>
           <div class="info-text">Copy this code and use it quickly</div>
           <div class="progress-bar"><div class="progress-fill success"></div></div>`;

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Moon US Nums - OTP</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Outfit', -apple-system, sans-serif;
      background: #09090b;
      color: white;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
      position: relative;
      overflow: hidden;
    }
    .glow-1, .glow-2 {
      position: absolute;
      width: 400px;
      height: 400px;
      border-radius: 50%;
      filter: blur(100px);
      opacity: 0.15;
      z-index: 0;
    }
    .glow-1 { background: #22c55e; top: -100px; right: -100px; }
    .glow-2 { background: #3b82f6; bottom: -100px; left: -100px; }
    .box {
      background: rgba(20, 20, 25, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 48px 40px;
      border-radius: 32px;
      text-align: center;
      box-shadow: 0 40px 100px -20px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.03) inset;
      backdrop-filter: blur(24px);
      max-width: 440px;
      width: 100%;
      position: relative;
      z-index: 1;
      animation: slideUp 0.6s ease-out;
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(30px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .brand-logo {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 36px;
      padding: 12px 24px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 100px;
      font-size: 14px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 2px;
    }
    .brand-logo .moon-icon {
      font-size: 20px;
      animation: floatMoon 3s ease-in-out infinite;
    }
    @keyframes floatMoon {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-3px); }
    }
    .brand-logo .brand-name {
      background: linear-gradient(135deg, #e2e8f0, #94a3b8);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 8px 18px;
      border-radius: 100px;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 30px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .waiting-badge {
      background: rgba(245, 158, 11, 0.1);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.2);
    }
    .success-badge {
      background: rgba(34, 197, 94, 0.1);
      color: #4ade80;
      border: 1px solid rgba(34, 197, 94, 0.2);
    }
    .dot-pulse {
      display: inline-block;
      width: 8px;
      height: 8px;
      background: #fbbf24;
      border-radius: 50%;
      box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.7);
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.7); }
      70% { box-shadow: 0 0 0 10px rgba(251, 191, 36, 0); }
      100% { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0); }
    }
    .dot-check {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      background: #4ade80;
      color: #09090b;
      border-radius: 50%;
      font-size: 12px;
      font-weight: 900;
    }
    .otp-code {
      font-size: 58px;
      font-weight: 900;
      color: #4ade80;
      letter-spacing: 12px;
      margin: 15px 0;
      text-shadow: 0 0 40px rgba(74, 222, 128, 0.4);
      font-family: 'Courier New', monospace;
      animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      padding-left: 12px;
    }
    @keyframes popIn {
      0% { transform: scale(0.7); opacity: 0; }
      100% { transform: scale(1); opacity: 1; }
    }
    .otp-placeholder {
      font-size: 42px;
      font-weight: 700;
      color: rgba(148, 163, 184, 0.2);
      letter-spacing: 8px;
      margin: 15px 0;
      font-family: 'Courier New', monospace;
    }
    .info-text {
      color: #64748b;
      font-size: 14px;
      margin-bottom: 24px;
      font-weight: 500;
    }
    .progress-bar {
      height: 3px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 100px;
      overflow: hidden;
      margin-bottom: 32px;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #f59e0b, #fbbf24);
      border-radius: 100px;
      width: 30%;
      animation: loading 5s ease-in-out infinite;
    }
    .progress-fill.success {
      background: linear-gradient(90deg, #22c55e, #4ade80);
      width: 100%;
      animation: none;
    }
    @keyframes loading {
      0% { width: 5%; }
      50% { width: 85%; }
      100% { width: 5%; }
    }
    .refresh-btn {
      display: block;
      width: 100%;
      padding: 14px;
      margin-bottom: 16px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #e2e8f0;
      border-radius: 14px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: 0.3s;
      font-family: inherit;
    }
    .refresh-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      transform: translateY(-1px);
    }
    .refresh-btn:active { transform: translateY(0); }
    .divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), transparent);
      margin: 0 0 24px 0;
    }
    .site-link {
      display: inline-flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      background: linear-gradient(135deg, #1d4ed8, #3b82f6);
      color: white;
      text-decoration: none;
      border-radius: 16px;
      font-weight: 700;
      font-size: 15px;
      transition: all 0.3s ease;
      box-shadow: 0 10px 30px -10px rgba(59, 130, 246, 0.4);
      width: 100%;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .site-link:hover {
      transform: translateY(-2px);
      box-shadow: 0 15px 40px -10px rgba(59, 130, 246, 0.6);
      background: linear-gradient(135deg, #1e40af, #2563eb);
    }
    .site-link .arrow {
      transition: transform 0.3s ease;
      font-size: 18px;
    }
    .site-link:hover .arrow { transform: translateX(5px); }
    .footer-text {
      color: #334155;
      font-size: 11px;
      margin-top: 24px;
      font-weight: 500;
      letter-spacing: 0.5px;
    }
    @media (max-width: 480px) {
      .box { padding: 36px 24px; border-radius: 24px; }
      .otp-code { font-size: 46px; letter-spacing: 8px; }
      .otp-placeholder { font-size: 32px; letter-spacing: 6px; }
    }
  </style>
</head>
<body>
  <div class="glow-1"></div>
  <div class="glow-2"></div>
  <div class="box">
    <div class="brand-logo">
      <span class="moon-icon">🌙</span>
      <span class="brand-name">Moon US Nums</span>
    </div>
    ${displayContent}
    <button class="refresh-btn" onclick="location.reload()">🔄 Check for New OTP</button>
    <div class="divider"></div>
    <a href="https://moon-us-nums.free.nf/" target="_blank" class="site-link">
      <span>🌐 Visit Our Website</span>
      <span class="arrow">→</span>
    </a>
    <div class="footer-text">Powered by Moon US Nums</div>
  </div>
</body>
</html>`;
      return res.status(200).send(html);
    }

    // ============ JSON OUTPUT (Scripts/Bots) ============
    if (isWaiting) {
      return res.status(200).json({
        site: "Moon US Nums",
        website: "https://moon-us-nums.free.nf/",
        status: "waiting",
        message: "⏳ Waiting for OTP...",
        active: data.active === true,
      });
    }

    return res.status(200).json({
      site: "Moon US Nums",
      website: "https://moon-us-nums.free.nf/",
      status: "success",
      code: code,
    });

  } catch (error) {
    // ---------- ERROR HANDLING ----------
    let errorMsg = 'Unknown error';
    if (error.response) {
      errorMsg = `Upstream Error: ${error.response.status}`;
    } else if (error.code) {
      errorMsg = `Fetch Error: ${error.code} - ${error.message}`;
    } else {
      errorMsg = `Fetch Error: ${error.message}`;
    }
    return res.status(500).json({
      site: "Moon US Nums",
      error: errorMsg,
    });
  }
}
