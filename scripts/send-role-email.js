const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

async function main() {
  const { data, error } = await resend.emails.send({
    from: "MAJH Events <events@majhevents.com>",
    to: "zacharysmall246@gmail.com",
    subject: "You've been assigned the Manager role on MAJH Events",
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Manager Role Assigned</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#111111;border-radius:8px;overflow:hidden;border:1px solid #1f1f1f;">

          <!-- Header -->
          <tr>
            <td style="background-color:#eab308;padding:32px 40px;">
              <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#000000;">MAJH EVENTS</p>
              <h1 style="margin:8px 0 0;font-size:26px;font-weight:800;color:#000000;line-height:1.2;">Manager Role Assigned</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 20px;font-size:16px;color:#d4d4d4;line-height:1.6;">
                Hey Zachary,
              </p>
              <p style="margin:0 0 20px;font-size:16px;color:#d4d4d4;line-height:1.6;">
                You have been assigned the <strong style="color:#eab308;">Manager</strong> role on MAJH Events. This gives you elevated access across the platform to help run tournaments and operations.
              </p>

              <!-- Role capabilities -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a1a;border-radius:6px;border:1px solid #2a2a2a;margin:0 0 28px;">
                <tr>
                  <td style="padding:24px 28px;">
                    <p style="margin:0 0 16px;font-size:13px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#eab308;">What you can do as Manager</p>
                    <table cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="padding:7px 0;border-bottom:1px solid #222222;">
                          <span style="font-size:14px;color:#a3a3a3;">Tournaments</span>
                          <span style="float:right;font-size:14px;color:#d4d4d4;">Create, edit, and manage all tournaments</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:7px 0;border-bottom:1px solid #222222;">
                          <span style="font-size:14px;color:#a3a3a3;">Players</span>
                          <span style="float:right;font-size:14px;color:#d4d4d4;">Register, remove, and manage participants</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:7px 0;border-bottom:1px solid #222222;">
                          <span style="font-size:14px;color:#a3a3a3;">Finance</span>
                          <span style="float:right;font-size:14px;color:#d4d4d4;">View ledger, payouts, and financial reports</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:7px 0;border-bottom:1px solid #222222;">
                          <span style="font-size:14px;color:#a3a3a3;">Disputes</span>
                          <span style="float:right;font-size:14px;color:#d4d4d4;">Review and resolve player disputes</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:7px 0;border-bottom:1px solid #222222;">
                          <span style="font-size:14px;color:#a3a3a3;">Announcements</span>
                          <span style="float:right;font-size:14px;color:#d4d4d4;">Post platform-wide and tournament announcements</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:7px 0;">
                          <span style="font-size:14px;color:#a3a3a3;">Streaming</span>
                          <span style="float:right;font-size:14px;color:#d4d4d4;">Manage stream sources and feature matches</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 28px;font-size:15px;color:#737373;line-height:1.6;">
                If you have any questions about your access or responsibilities, reach out directly to the platform owner.
              </p>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#eab308;border-radius:6px;">
                    <a href="https://majhevents.com/dashboard" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:700;color:#000000;text-decoration:none;letter-spacing:0.5px;">Go to Dashboard</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #1f1f1f;">
              <p style="margin:0;font-size:12px;color:#525252;line-height:1.5;">
                This is an automated message from MAJH Events. If you believe this was sent in error, please contact support.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
  });

  if (error) {
    console.error("Failed to send:", error);
    process.exit(1);
  }

  console.log("Sent successfully. Resend ID:", data.id);
}

main();
