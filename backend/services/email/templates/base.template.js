/**
 * HTML & Plain Text Base Email Layouts
 */

/**
 * Strips HTML tags and entities to create clean plain text
 * @param {string} html
 * @returns {string}
 */
export function htmlToPlainText(html) {
  if (!html) return "";
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, "\n\n$1\n" + "=".repeat(30) + "\n")
    .replace(/<p[^>]*>(.*?)<\/p>/gi, "\n$1\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>(.*?)<\/li>/gi, "  * $1\n")
    .replace(/<a\b[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Returns color hex corresponding to notification status
 * @param {string} status
 * @returns {{ bg: string, text: string, badgeBg: string, badgeText: string }}
 */
function getStatusTheme(status) {
  switch (status?.toLowerCase()) {
    case "approved":
    case "confirmed":
      return { bg: "#059669", text: "#ffffff", badgeBg: "#d1fae5", badgeText: "#065f46" };
    case "needs_correction":
    case "warning":
      return { bg: "#d97706", text: "#ffffff", badgeBg: "#fef3c7", badgeText: "#92400e" };
    case "rejected":
    case "cancelled":
      return { bg: "#dc2626", text: "#ffffff", badgeBg: "#fee2e2", badgeText: "#991b1b" };
    case "pending":
    case "resubmitted":
    default:
      return { bg: "#4f46e5", text: "#ffffff", badgeBg: "#e0e7ff", badgeText: "#3730a3" };
  }
}

/**
 * Wraps content in standard responsive email container with branding
 * @param {Object} options
 * @param {string} options.title - Email heading
 * @param {string} options.contentHtml - Main body HTML
 * @param {string} [options.statusBadge] - Status text for badge
 * @param {string} [options.statusType] - Status type for styling
 * @param {string} [options.actionUrl] - Primary CTA button URL
 * @param {string} [options.actionText] - Primary CTA button label
 * @param {string} [options.clubName] - Club name
 * @param {string} [options.eventName] - Event name
 * @returns {string} Fully rendered HTML email
 */
export function renderEmailTemplate({
  title,
  contentHtml,
  statusBadge,
  statusType = "default",
  actionUrl,
  actionText,
  clubName = "Zephyr Events",
  eventName,
}) {
  const theme = getStatusTheme(statusType);
  const year = new Date().getFullYear();

  const badgeHtml = statusBadge
    ? `<span style="display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; background-color: ${theme.badgeBg}; color: ${theme.badgeText}; margin-bottom: 16px;">${statusBadge}</span>`
    : "";

  const actionButtonHtml = actionUrl && actionText
    ? `
      <div style="margin: 32px 0 24px 0; text-align: center;">
        <a href="${actionUrl}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; font-weight: 600; font-size: 14px; line-height: 1.5; padding: 12px 24px; text-decoration: none; border-radius: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">${actionText}</a>
        <p style="font-size: 12px; color: #6b7280; margin-top: 8px;">If the button doesn't work, copy and paste this link in your browser:<br/><a href="${actionUrl}" style="color: #4f46e5; word-break: break-all;">${actionUrl}</a></p>
      </div>
    `
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1f2937;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f3f4f6; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);">
          <!-- Header -->
          <tr>
            <td style="background-color: #111827; padding: 24px 32px; border-bottom: 3px solid #4f46e5;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <h2 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.025em;">${clubName}</h2>
                    ${eventName ? `<p style="margin: 4px 0 0 0; color: #9ca3af; font-size: 13px;">${eventName}</p>` : ""}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px;">
              ${badgeHtml}
              <h1 style="margin: 0 0 16px 0; color: #111827; font-size: 22px; font-weight: 700; line-height: 1.3;">${title}</h1>
              <div style="color: #374151; font-size: 15px; line-height: 1.6;">
                ${contentHtml}
              </div>
              ${actionButtonHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 32px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px; line-height: 1.5;">
              <p style="margin: 0 0 4px 0;">This is an automated notification from <strong>${clubName}</strong> via Zephyr PR Tracker.</p>
              <p style="margin: 0;">&copy; ${year} ${clubName}. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export default { renderEmailTemplate, htmlToPlainText };