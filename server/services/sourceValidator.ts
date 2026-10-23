import { URL } from 'url';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedUrl?: string;
  isStream: boolean;
}

const BLOCKED_HOSTNAMES = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'metadata.google.internal',
  '169.254.169.254',
  'instance-data',
];

export class SourceValidator {
  /**
   * SSRF & Protocol validation for administrator-provided URLs
   */
  public static validateSourceUrl(inputUrl: string): ValidationResult {
    if (!inputUrl || typeof inputUrl !== 'string') {
      return { isValid: false, error: 'آدرس منبع ویدیو نامعتبر یا خالی است.', isStream: false };
    }

    let parsed: URL;
    try {
      parsed = new URL(inputUrl.trim());
    } catch {
      return { isValid: false, error: 'فرمت آدرس URL نامعتبر است.', isStream: false };
    }

    // Allowed protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:' && parsed.protocol !== 'rtmp:') {
      return {
        isValid: false,
        error: `پروتکل ${parsed.protocol} مجاز نیست. فقط https، http و rtmp پشتیبانی می‌شوند.`,
        isStream: false,
      };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Check blocked hostnames
    if (BLOCKED_HOSTNAMES.includes(hostname) || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
      return {
        isValid: false,
        error: 'دسترسی به آدرس‌های لوکال یا شبکه خصوصی مسدود شده است (حفاظت SSRF).',
        isStream: false,
      };
    }

    // Check private IPv4 ranges (10.x, 192.168.x, 172.16-31.x)
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const ipMatch = hostname.match(ipv4Regex);
    if (ipMatch) {
      const octet1 = parseInt(ipMatch[1], 10);
      const octet2 = parseInt(ipMatch[2], 10);

      if (
        octet1 === 10 || // 10.0.0.0/8
        octet1 === 127 || // 127.0.0.0/8
        (octet1 === 172 && octet2 >= 16 && octet2 <= 31) || // 172.16.0.0/12
        (octet1 === 192 && octet2 === 168) || // 192.168.0.0/16
        (octet1 === 169 && octet2 === 254) // 169.254.0.0/16 link-local
      ) {
        return {
          isValid: false,
          error: 'دسترسی به محدوده‌های IP داخلی و شبکه خصوصی غیرمجاز است.',
          isStream: false,
        };
      }
    }

    const isHls = parsed.pathname.endsWith('.m3u8');
    const isMp4 = parsed.pathname.endsWith('.mp4');
    const isRtmp = parsed.protocol === 'rtmp:';

    return {
      isValid: true,
      sanitizedUrl: parsed.toString(),
      isStream: isHls || isRtmp,
    };
  }
}
