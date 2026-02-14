'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTheme } from 'next-themes';
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
  LogOut,
  User,
  FileText,
  Wrench,
  Menu,
  Globe,
  Sun,
  Moon,
  ChevronRight,
  Bell,
  Command,
} from 'lucide-react';
import { NotificationsBell } from '@/components/shared/notifications-bell';
import { LanguageProvider, useLanguage } from '@/lib/i18n/language-context';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { nameKey: 'nav.home', href: '/app', icon: Home },
  { nameKey: 'nav.leads', href: '/app/leads', icon: Users },
  { nameKey: 'nav.accounts', href: '/app/accounts', icon: Building2 },
  { nameKey: 'nav.contacts', href: '/app/contacts', icon: Contact },
  { nameKey: 'nav.activities', href: '/app/activities', icon: CheckSquare },
  { nameKey: 'nav.services', href: '/app/services', icon: Wrench },
  { nameKey: 'nav.reports', href: '/app/reports', icon: BarChart3 },
  { nameKey: 'nav.files', href: '/app/files', icon: FileText },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="h-9 w-9 rounded-lg"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}

function NavItem({
  item,
  isActive,
  isCollapsed,
  onClick,
}: {
  item: (typeof navigation)[0];
  isActive: boolean;
  isCollapsed: boolean;
  onClick?: () => void;
}) {
  const { t } = useLanguage();

  const content = (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ease-out',
        isActive
          ? 'bg-primary text-primary-foreground shadow-soft'
          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
      )}
    >
      <item.icon
        className={cn(
          'h-5 w-5 transition-transform duration-200',
          isActive ? '' : 'group-hover:scale-110'
        )}
      />
      {!isCollapsed && <span>{t(item.nameKey)}</span>}
      {isActive && !isCollapsed && (
        <motion.div
          layoutId="activeNavIndicator"
          className="ml-auto"
          transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
        >
          <ChevronRight className="h-4 w-4 opacity-50" />
        </motion.div>
      )}
    </Link>
  );

  if (isCollapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          {t(item.nameKey)}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

function Sidebar({
  isCollapsed,
  setIsCollapsed,
}: {
  isCollapsed: boolean;
  setIsCollapsed: (value: boolean) => void;
}) {
  const { profile } = useAuth();
  const pathname = usePathname();
  const { t } = useLanguage();
  const router = useRouter();

  return (
    <TooltipProvider delayDuration={0}>
      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? 80 : 260 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
        className="fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-sidebar-border bg-sidebar"
      >
        {/* Logo */}
        <div className="flex h-16 items-center border-b border-sidebar-border px-4">
          <Link
            href="/app"
            className="flex items-center gap-3 overflow-hidden"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-600 text-primary-foreground shadow-glow">
              <Building2 className="h-5 w-5" />
            </div>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="whitespace-nowrap text-lg font-bold text-sidebar-foreground"
              >
                Sales Cloud
              </motion.span>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3 scrollbar-thin">
          {navigation.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/app' && pathname?.startsWith(item.href));

            return (
              <NavItem
                key={item.nameKey}
                item={item}
                isActive={isActive}
                isCollapsed={isCollapsed}
              />
            );
          })}
        </nav>

        {/* Admin Link */}
        {profile?.role === 'ADMIN' && (
          <div className="border-t border-sidebar-border p-3">
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Link
                  href="/app/admin/users"
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                    pathname?.startsWith('/app/admin')
                      ? 'bg-primary text-primary-foreground shadow-soft'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                  )}
                >
                  <Settings className="h-5 w-5" />
                  {!isCollapsed && <span>{t('nav.admin')}</span>}
                </Link>
              </TooltipTrigger>
              {isCollapsed && (
                <TooltipContent side="right" className="font-medium">
                  {t('nav.admin')}
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        )}

        {/* Collapse Toggle */}
        <div className="border-t border-sidebar-border p-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-full justify-center text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <motion.div
              animate={{ rotate: isCollapsed ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronRight className="h-4 w-4" />
            </motion.div>
          </Button>
        </div>
      </motion.aside>
    </TooltipProvider>
  );
}

function TopBar({
  isCollapsed,
  setIsMobileOpen,
}: {
  isCollapsed: boolean;
  setIsMobileOpen: (value: boolean) => void;
}) {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/app/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border/50 bg-background/80 px-4 backdrop-blur-xl lg:px-6">
      {/* Mobile Menu Trigger */}
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setIsMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <div className="flex h-full flex-col bg-sidebar">
            {/* Mobile Sidebar Content */}
            <div className="flex h-16 items-center border-b border-sidebar-border px-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-600 text-primary-foreground">
                <Building2 className="h-5 w-5" />
              </div>
              <span className="ml-3 text-lg font-bold text-sidebar-foreground">
                Sales Cloud
              </span>
            </div>
            <nav className="flex-1 space-y-1 p-3">
              {navigation.map((item) => (
                <Link
                  key={item.nameKey}
                  href={item.href}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-all hover:bg-sidebar-accent hover:text-sidebar-foreground"
                >
                  <item.icon className="h-5 w-5" />
                  {t(item.nameKey)}
                </Link>
              ))}
            </nav>
          </div>
        </SheetContent>
      </Sheet>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex-1 max-w-xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t('common.search_placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-12 bg-muted/50 border-0 focus:bg-background"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1 text-xs text-muted-foreground bg-muted/80 px-1.5 py-0.5 rounded">
            <Command className="h-3 w-3" />
            <span>K</span>
          </div>
        </div>
      </form>

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        {/* Language Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg">
              <Globe className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem
              onClick={() => setLanguage('bs')}
              className={cn(
                'cursor-pointer',
                language === 'bs' && 'bg-accent'
              )}
            >
              <span className="mr-2">🇧🇦</span> Bosanski
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setLanguage('en')}
              className={cn(
                'cursor-pointer',
                language === 'en' && 'bg-accent'
              )}
            >
              <span className="mr-2">🇺🇸</span> English
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <NotificationsBell />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 pl-2 pr-3 h-9 rounded-full hover:bg-accent"
            >
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary-600 text-primary-foreground text-xs font-medium">
                  {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="hidden md:inline text-sm font-medium">
                {profile?.full_name?.split(' ')[0]}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56" sideOffset={8}>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{profile?.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {profile?.email}
                </p>
                <Badge variant="soft" className="w-fit mt-1">
                  {profile?.role}
                </Badge>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => router.push('/app/profile')}
              className="cursor-pointer"
            >
              <User className="mr-2 h-4 w-4" />
              {t('nav.profile')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={signOut}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              {t('nav.sign_out')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function InnerAppLayout({ children }: AppLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block">
          <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
        </div>

        {/* Main Content */}
        <main
          className={cn(
            'flex-1 transition-all duration-300 ease-in-out',
            isCollapsed ? 'lg:ml-20' : 'lg:ml-[260px]'
          )}
        >
          <TopBar
            isCollapsed={isCollapsed}
            setIsMobileOpen={setIsMobileOpen}
          />
          <div className="p-4 lg:p-8">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              {children}
            </motion.div>
          </div>
        </main>
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
