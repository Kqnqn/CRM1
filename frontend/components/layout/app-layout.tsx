'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Home,
  Users,
  Building2,
  Contact,
  Target,
  CheckSquare,
  BarChart3,
  Settings,
  Search,
  Grid3x3,
  LogOut,
  User,
  FileText,
  Wrench,
  Menu,
  Globe,
} from 'lucide-react';
import { NotificationsBell } from '@/components/shared/notifications-bell';
import { LanguageProvider, useLanguage } from '@/lib/i18n/language-context';

interface AppLayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { nameKey: 'nav.home', href: '/app', icon: Home },
  { nameKey: 'nav.leads', href: '/app/leads', icon: Users },
  { nameKey: 'nav.accounts', href: '/app/accounts', icon: Building2 },
  { nameKey: 'nav.contacts', href: '/app/contacts', icon: Contact },
  { nameKey: 'nav.opportunities', href: '/app/opportunities', icon: Target },
  { nameKey: 'nav.activities', href: '/app/activities', icon: CheckSquare },
  { nameKey: 'nav.services', href: '/app/services', icon: Wrench },
  { nameKey: 'nav.reports', href: '/app/reports', icon: BarChart3 },
  { nameKey: 'nav.files', href: '/app/files', icon: FileText },
];

function InnerAppLayout({ children }: AppLayoutProps) {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { t, language, setLanguage } = useLanguage();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/app/search?q=${encodeURIComponent(searchQuery)}`);
      setIsMobileOpen(false);
    }
  };

  const NavContent = () => (
    <>
      <div className="h-16 flex items-center px-6 border-b border-gray-200">
        <Link href="/app" className="flex items-center space-x-2" onClick={() => setIsMobileOpen(false)}>
          <Grid3x3 className="h-6 w-6 text-blue-600" />
          <span className="text-xl font-semibold text-gray-900">CRM</span>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/app' && pathname?.startsWith(item.href));

          return (
            <Link
              key={item.nameKey}
              href={item.href}
              onClick={() => setIsMobileOpen(false)}
              className={`flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-50'
                }`}
            >
              <item.icon className="h-5 w-5" />
              <span>{t(item.nameKey)}</span>
            </Link>
          );
        })}
      </nav>

      {profile?.role === 'ADMIN' && (
        <div className="px-3 py-4 border-t border-gray-200">
          <Link
            href="/app/admin/users"
            onClick={() => setIsMobileOpen(false)}
            className="flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Settings className="h-5 w-5" />
            <span>{t('nav.admin')}</span>
          </Link>
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex h-screen">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex w-60 bg-white border-r border-gray-200 flex-col">
          <NavContent />
        </aside>

        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6">
            <div className="flex items-center flex-1 gap-4">
              {/* Mobile Menu Trigger */}
              <div className="md:hidden">
                <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="-ml-2">
                      <Menu className="h-6 w-6" />
                      <span className="sr-only">Toggle menu</span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="p-0 w-64 bg-white">
                    <NavContent />
                  </SheetContent>
                </Sheet>
              </div>

              <form onSubmit={handleSearch} className="flex-1 max-w-2xl">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="search"
                    placeholder={t('common.search_placeholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-full"
                  />
                </div>
              </form>
            </div>

            <div className="flex items-center space-x-2 md:space-x-4 ml-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-gray-600">
                    <Globe className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setLanguage('bs')} className={language === 'bs' ? 'bg-blue-50' : ''}>
                    🇧🇦 Bosnian
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLanguage('en')} className={language === 'en' ? 'bg-blue-50' : ''}>
                    🇺🇸 English
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <NotificationsBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2 p-1 md:p-2">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <span className="hidden md:inline text-sm font-medium">{profile?.full_name}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{profile?.full_name}</p>
                      <p className="text-xs text-gray-500">{profile?.email}</p>
                      <p className="text-xs text-blue-600">{profile?.role}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push('/app/profile')}>
                    <User className="mr-2 h-4 w-4" />
                    {t('nav.profile')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    {t('nav.sign_out')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <LanguageProvider>
      <InnerAppLayout>{children}</InnerAppLayout>
    </LanguageProvider>
  );
}
