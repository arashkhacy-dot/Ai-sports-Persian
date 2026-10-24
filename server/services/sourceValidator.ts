import { URL } from 'url';
import path from 'path';
import fs from 'fs';

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

  /**
   * Safe local media path validation protecting against directory traversal
   * and verifying that files reside strictly within permitted data/upload directories
   */
  public static validateLocalMediaPath(inputPath: string): { isValid: boolean; sanitizedPath?: string; error?: string } {
    if (!inputPath || typeof inputPath !== 'string') {
      return { isValid: false, error: 'مسیر فایل مشخص نشده است.' };
    }

    const trimmed = inputPath.trim();
    if (trimmed.includes('\0')) {
      return { isValid: false, error: 'مسیر شامل کاراکترهای غیرمجاز است.' };
    }

    // Resolve path against working directory
    const resolved = path.isAbsolute(trimmed)
      ? path.normalize(trimmed)
      : path.resolve(process.cwd(), trimmed);

    // Allowed directory roots
    const allowedRoots = [
      path.resolve(process.cwd(), 'data'),
      path.resolve(process.cwd(), 'public'),
      '/tmp',
    ];

    const isInsideAllowedRoot = allowedRoots.some(
      (root) => resolved === root || resolved.startsWith(root + path.sep)
    );

    if (!isInsideAllowedRoot) {
      return {
        isValid: false,
        error: 'دسترسی به مسیرهای خارج از دایرکتوری مجاز داده‌ها مسدود گردید.',
      };
    }

    // Allowed multimedia extensions
    const ext = path.extname(resolved).toLowerCase();
    const allowedExtensions = ['.mp4', '.m4v', '.mov', '.mkv', '.ts', '.wav', '.m3u8'];
    if (!allowedExtensions.includes(ext)) {
      return {
        isValid: false,
        error: `پسوند ${ext} غیرمجاز است. تنها فرمت‌های چندرسانه‌ای مجاز هستند.`,
      };
    }

    return { isValid: true, sanitizedPath: resolved };
  }
}
