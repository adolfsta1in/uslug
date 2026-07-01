'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Новое свидетельство' },
    { href: '/registry', label: 'Реестр' },
  ];

  return (
    <header className="bg-slate-950 text-white shadow-md no-print">
      <div className="mx-auto max-w-[1600px] px-6">
        <div className="flex items-center justify-between py-3">
          <h1 className="text-lg font-bold">Тоҷикстандарт · Шаҳодатнома</h1>
          <nav className="flex gap-1">
            {links.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  pathname === link.href ? 'bg-white/18 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
