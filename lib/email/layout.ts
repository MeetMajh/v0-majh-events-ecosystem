const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://majhevents.com"

export function emailLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MAJH Events</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="padding:0 0 24px 0;text-align:center;">
              <a href="${BASE_URL}" style="text-decoration:none;">
                <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.05em;">MAJH EVENTS</span>
              </a>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background-color:#141414;border-radius:12px;padding:40px;border:1px solid #222;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 0;text-align:center;">
              <p style="color:#555;font-size:12px;margin:0;">
                &copy; ${new Date().getFullYear()} MAJH Events &bull;
                <a href="${BASE_URL}/settings/notifications" style="color:#555;text-decoration:underline;">Notification Settings</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function primaryButton(text: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;background-color:#eab308;color:#000000;font-weight:600;font-size:14px;padding:12px 28px;border-radius:6px;text-decoration:none;margin-top:24px;">${text}</a>`
}

export function heading(text: string): string {
  return `<h1 style="color:#ffffff;font-size:22px;font-weight:700;margin:0 0 12px 0;">${text}</h1>`
}

export function body(text: string): string {
  return `<p style="color:#aaaaaa;font-size:15px;line-height:1.6;margin:0 0 16px 0;">${text}</p>`
}

export function divider(): string {
  return `<hr style="border:none;border-top:1px solid #222;margin:24px 0;" />`
}
