import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || 'placeholder-key';

export const isSupabaseConfigured =
  supabaseUrl !== 'https://placeholder.supabase.co' &&
  supabaseAnonKey !== 'placeholder-key';

function getSupabaseHost() {
  try {
    return new URL(supabaseUrl).host;
  } catch {
    return supabaseUrl || 'empty URL';
  }
}

export function getSupabaseConfigError(): string | null {
  if (!isSupabaseConfigured) {
    return 'Supabase не настроен. Добавьте NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY в .env.local или в Environment Variables на Vercel.';
  }

  try {
    const url = new URL(supabaseUrl);
    if (url.protocol !== 'https:') {
      return 'NEXT_PUBLIC_SUPABASE_URL должен начинаться с https://. Сейчас указан: ' + supabaseUrl;
    }
  } catch {
    return 'NEXT_PUBLIC_SUPABASE_URL имеет неверный формат. Пример: https://xxxxx.supabase.co';
  }

  return null;
}

export function describeSupabaseError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String((error as { message?: unknown }).message)
        : String(error || 'unknown error');

  if (message.includes('Failed to fetch') || message.includes('fetch failed')) {
    return [
      'Не удалось подключиться к Supabase.',
      'Проверьте NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY, перезапустите dev-сервер или redeploy на Vercel.',
      'Текущий Supabase host: ' + getSupabaseHost(),
    ].join(' ');
  }

  return message;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
