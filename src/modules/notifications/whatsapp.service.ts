import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface WhatsAppSendResult {
  ok: boolean;
  error?: string;
  permanent?: boolean;
}

export interface WhatsAppStatus {
  enabled: boolean;
  configured: boolean;
  baseUrl: string | null;
  sessionId: string | null;
  reachable: boolean;
  live: boolean;
  sessionState: string | null;
  detail: string | null;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(private readonly config: ConfigService) {}

  get enabled(): boolean {
    return this.config.get<string>('WHATSAPP_ENABLED') === 'true';
  }

  private get baseUrl(): string | null {
    return this.config.get<string>('WAHA_BASE_URL') ?? null;
  }

  private get apiKey(): string | null {
    return this.config.get<string>('WAHA_API_KEY') ?? null;
  }

  private get sessionId(): string | null {
    return this.config.get<string>('WAHA_SESSION_ID') ?? 'default';
  }

  get configured(): boolean {
    return Boolean(this.baseUrl && this.apiKey && this.sessionId);
  }

  private get timeoutMs(): number {
    return Number(
      this.config.get<string>('WAHA_TIMEOUT_MS') ?? 10_000,
    );
  }

  /**
   * Convert Lao phone number to WAHA chatId.
   *
   * Examples:
   * 2012345678
   * 02012345678
   * +856 20 12345678
   *
   * => 8562012345678@c.us
   */
  static toChatId(
    raw: string | null | undefined,
    defaultCountryCode = '856',
  ): string | null {
    if (!raw) return null;

    let digits = raw.replace(/\D/g, '');

    if (!digits) return null;

    // 00856...
    if (digits.startsWith('00')) {
      digits = digits.slice(2);
    }

    if (!digits.startsWith(defaultCountryCode)) {
      const national = digits.startsWith('0')
        ? digits.slice(1)
        : digits;

      digits = `${defaultCountryCode}${national}`;
    }

    if (digits.length < 10 || digits.length > 15) {
      return null;
    }

    return `${digits}@c.us`;
  }

  static toNumber(chatId: string): string {
    return chatId.replace('@c.us', '');
  }

  /**
   * Send text through WAHA.
   *
   * POST /api/sendText
   */
  async sendText(
    chatId: string,
    text: string,
  ): Promise<WhatsAppSendResult> {
    if (!this.enabled) {
      return {
        ok: false,
        error: 'WhatsApp ປິດການນຳໃຊ້',
        permanent: true,
      };
    }

    if (!this.configured) {
      return {
        ok: false,
        error: 'ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ WAHA',
        permanent: true,
      };
    }

    const url =
      `${this.baseUrl!.replace(/\/$/, '')}/api/sendText`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Api-Key': this.apiKey!,
        },
        body: JSON.stringify({
          session: this.sessionId,
          chatId,
          text,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (response.ok) {
        return { ok: true };
      }

      const body = await response.text().catch(() => '');

      const detail =
        `HTTP ${response.status}` +
        (body ? ` — ${body.slice(0, 300)}` : '');

      // Retry:
      // 429 Too Many Requests
      // 5xx Server errors
      const permanent =
        response.status >= 400 &&
        response.status < 500 &&
        response.status !== 429;

      this.logger.warn(
        `WAHA send failed: ${detail}`,
      );

      return {
        ok: false,
        error: detail,
        permanent,
      };
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : String(error);

      this.logger.warn(
        `WAHA send error: ${detail}`,
      );

      return {
        ok: false,
        error: detail,
        permanent: false,
      };
    }
  }

  /**
   * GET /api/sessions/{session}
   */
  async status(): Promise<WhatsAppStatus> {
    const base: WhatsAppStatus = {
      enabled: this.enabled,
      configured: this.configured,
      baseUrl: this.baseUrl,
      sessionId: this.sessionId,
      reachable: false,
      live: false,
      sessionState: null,
      detail: null,
    };

    if (!this.enabled) {
      return {
        ...base,
        detail: 'WHATSAPP_ENABLED ບໍ່ໄດ້ເປີດ',
      };
    }

    if (!this.configured) {
      return {
        ...base,
        detail:
          'ຂາດ WAHA_BASE_URL, WAHA_API_KEY ຫຼື WAHA_SESSION_ID',
      };
    }

    const url =
      `${this.baseUrl!.replace(/\/$/, '')}` +
      `/api/sessions/${this.sessionId}`;

    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'X-Api-Key': this.apiKey!,
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');

        return {
          ...base,
          reachable: true,
          detail:
            `HTTP ${response.status}` +
            (body ? ` — ${body.slice(0, 200)}` : ''),
        };
      }

      const payload = (await response.json().catch(() => null)) as
        | {
            status?: string;
            name?: string;
            me?: {
              id?: string;
              pushName?: string;
            };
          }
        | null;

      const state = payload?.status ?? null;

      return {
        ...base,
        reachable: true,

        // WAHA uses WORKING when session is ready.
        live: state === 'WORKING',

        sessionState: state,

        detail: describeSessionState(state),
      };
    } catch (error) {
      return {
        ...base,
        detail:
          error instanceof Error
            ? error.message
            : String(error),
      };
    }
  }
}

function describeSessionState(
  state: string | null | undefined,
): string {
  switch (state) {
    case 'WORKING':
      return 'ພ້ອມສົ່ງ — WhatsApp session ເຊື່ອມຕໍ່ແລ້ວ';

    case 'SCAN_QR_CODE':
      return 'ຕ້ອງສະແກນ QR ດ້ວຍ WhatsApp';

    case 'STARTING':
      return 'ກຳລັງເລີ່ມ WhatsApp session...';

    case 'STOPPED':
      return 'WhatsApp session ຢຸດເຮັດວຽກ';

    case 'FAILED':
      return 'WhatsApp session ລົ້ມເຫຼວ — ຕ້ອງ restart ຫຼື login ໃໝ່';

    case 'PASSKEY_REQUIRED':
      return 'WhatsApp ຕ້ອງການ Passkey';

    case 'PASSKEY_CONFIRMATION_REQUIRED':
      return 'WhatsApp ຕ້ອງການຢືນຢັນ Passkey';

    default:
      return state
        ? `session: ${state}`
        : 'ບໍ່ຮູ້ສະຖານະ session';
  }
}