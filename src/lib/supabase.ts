import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || 'placeholder-key';

function isSecretKey(value: string) {
  return value.startsWith('sb_secret_') || value.startsWith('supabase_secret_');
}

export const isSupabaseConfigured =
  supabaseUrl !== 'https://placeholder.supabase.co' &&
  supabaseAnonKey !== 'placeholder-key' &&
  !isSecretKey(supabaseAnonKey);

function getSupabaseHost() {
  try {
    return new URL(supabaseUrl).host;
  } catch {
    return supabaseUrl || 'empty URL';
  }
}

export function getSupabaseConfigError(): string | null {
  if (!isSupabaseConfigured) {
    if (isSecretKey(supabaseAnonKey)) {
      return 'В NEXT_PUBLIC_SUPABASE_ANON_KEY вставлен secret key. Его нельзя использовать в браузере. Замените его на public anon/publishable key из Supabase Project Settings -> API.';
    }

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

  if (message.includes('Forbidden use of secret API key in browser')) {
    return 'В браузер попал secret API key. В NEXT_PUBLIC_SUPABASE_ANON_KEY должен быть public anon/publishable key, например sb_publishable_... или старый anon JWT eyJ..., но не sb_secret_...';
  }

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
