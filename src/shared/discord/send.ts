import 'server-only';

/**
 * Order notifications into a Discord channel, via an incoming webhook.
 *
 * Configured with `DISCORD_WEBHOOK_URL`. Unset means no notifications and no
 * error — same policy as SMTP, so a machine without the secret still runs the
 * whole checkout.
 *
 * Delivery failures are logged and swallowed. The order is already in the
 * database and the customer already has their confirmation; a Discord outage
 * must never turn that into a failed checkout.
 */

/**
 * The webhook URL is a bearer credential — anyone holding it can post into the
 * channel — and it is read from the environment, so a typo or a copy-paste
 * accident would otherwise make the server POST order details at an arbitrary
 * host. Only Discord's own webhook endpoints are accepted.
 */
const ALLOWED_PREFIXES = [
  'https://discord.com/api/webhooks/',
  'https://discordapp.com/api/webhooks/',
  'https://canary.discord.com/api/webhooks/',
  'https://ptb.discord.com/api/webhooks/',
];

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  /** Decimal RGB, e.g. 0x22c55e. */
  color?: number;
  fields?: DiscordEmbedField[];
  footer?: { text: string };
  timestamp?: string;
}

export interface DiscordMessage {
  content?: string;
  embeds?: DiscordEmbed[];
}

function webhookUrl(): string | null {
  const url = process.env.DISCORD_WEBHOOK_URL?.trim();
  if (!url) return null;

  if (!ALLOWED_PREFIXES.some((prefix) => url.startsWith(prefix))) {
    console.error(
      '[discord] DISCORD_WEBHOOK_URL is not a Discord webhook endpoint — refusing to send'
    );
    return null;
  }
  return url;
}

/** True when a webhook is configured, for callers that want to skip building a payload. */
export function isDiscordConfigured(): boolean {
  return webhookUrl() !== null;
}

async function post(url: string, message: DiscordMessage): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
    // Discord is fast or it is broken. Without a bound, a hung connection keeps
    // the serverless instance alive long after the response was sent.
    signal: AbortSignal.timeout(8_000),
  });
}

export async function sendDiscord(message: DiscordMessage): Promise<{ sent: boolean }> {
  const url = webhookUrl();
  if (!url) return { sent: false };

  try {
    let response = await post(url, message);

    // 30 messages/minute per channel. Nowhere near it at this volume, but a
    // burst of orders should queue rather than vanish, and Discord tells us
    // exactly how long to wait.
    if (response.status === 429) {
      const body = (await response.json().catch(() => ({}))) as { retry_after?: number };
      const waitMs = Math.min(Math.ceil((body.retry_after ?? 1) * 1000), 5_000);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      response = await post(url, message);
    }

    if (!response.ok) {
      console.error(`[discord] webhook rejected the message (${response.status})`);
      return { sent: false };
    }
    return { sent: true };
  } catch (error) {
    console.error('[discord] webhook delivery failed', error);
    return { sent: false };
  }
}
