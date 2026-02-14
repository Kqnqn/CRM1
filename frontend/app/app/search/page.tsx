'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase, Lead, Account, Contact } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search,
  Users,
  Building2,
  UserCircle,
  ArrowRight,
  FileSearch,
} from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n/language-context';

interface SearchResults {
  leads: Lead[];
  accounts: Account[];
  contacts: Contact[];
}

export default function SearchPage() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResults>({
    leads: [],
    accounts: [],
    contacts: [],
  });
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { t } = useLanguage();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(searchQuery);
  };

  useEffect(() => {
    if (!query.trim() || !user) return;

    const performSearch = async () => {
      setLoading(true);
      const lowerQuery = query.toLowerCase();

      try {
        // Search leads
        const { data: leadsData } = await supabase
          .from('leads')
          .select('*')
          .or(
            `company_name.ilike.%${lowerQuery}%,contact_person_name.ilike.%${lowerQuery}%,email.ilike.%${lowerQuery}%,phone.ilike.%${lowerQuery}%`
          )
          .limit(20);

        // Search accounts
        const { data: accountsData } = await supabase
          .from('accounts')
          .select('*')
          .or(
            `name.ilike.%${lowerQuery}%,industry.ilike.%${lowerQuery}%,city.ilike.%${lowerQuery}%,phone.ilike.%${lowerQuery}%`
          )
          .limit(20);

        // Search contacts
        const { data: contactsData } = await supabase
          .from('contacts')
          .select('*, account:accounts(id, name)')
          .or(
            `first_name.ilike.%${lowerQuery}%,last_name.ilike.%${lowerQuery}%,email.ilike.%${lowerQuery}%,phone.ilike.%${lowerQuery}%,mobile.ilike.%${lowerQuery}%`
          )
          .limit(20);

        setResults({
          leads: leadsData || [],
          accounts: accountsData || [],
          contacts: contactsData || [],
        });
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setLoading(false);
      }
    };

    performSearch();
  }, [query, user]);

  const totalResults =
    results.leads.length +
    results.accounts.length +
    results.contacts.length;

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      NEW: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
      CONTACTED: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
      QUALIFIED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
      CONVERTED: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
      ARCHIVED: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400',
      ACTIVE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
      PAUSED: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
      CLOSED: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400',
      OPEN: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
      NEGOTIATION: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
    };
    return colors[status] || 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400';
  };

  if (!query.trim()) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t('common.search') || 'Pretraga'}
          </h1>
          <p className="text-muted-foreground">
            Pretražite lidove, klijente i kontakte
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t('common.search_placeholder') || 'Pretraži lidove, klijente, kontakte...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button type="submit">
            <Search className="mr-2 h-4 w-4" />
            Pretraži
          </Button>
        </form>

        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileSearch className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Unesite pojam za pretragu</p>
            <p className="text-sm text-muted-foreground">
              Pretražujte po nazivu, emailu, telefonu ili drugim podacima
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {t('common.search') || 'Pretraga'}
        </h1>
        <p className="text-muted-foreground">
          {loading
            ? 'Pretraživanje...'
            : `Pronađeno ${totalResults} rezultata za "${query}"`}
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t('common.search_placeholder') || 'Pretraži lidove, klijente, kontakte...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button type="submit">
          <Search className="mr-2 h-4 w-4" />
          Pretraži
        </Button>
      </form>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      ) : totalResults === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileSearch className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Nema rezultata</p>
            <p className="text-sm text-muted-foreground">
              Pokušajte s drugačijim pojmom za pretragu
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">
              Svi ({totalResults})
            </TabsTrigger>
            <TabsTrigger value="leads">
              <Users className="mr-2 h-4 w-4" />
              Lidovi ({results.leads.length})
            </TabsTrigger>
            <TabsTrigger value="accounts">
              <Building2 className="mr-2 h-4 w-4" />
              Klijenti ({results.accounts.length})
            </TabsTrigger>
            <TabsTrigger value="contacts">
              <UserCircle className="mr-2 h-4 w-4" />
              Kontakti ({results.contacts.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {results.leads.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Lidovi
                </h3>
                <div className="grid gap-3">
                  {results.leads.map((lead) => (
                    <Link key={lead.id} href={`/app/leads/${lead.id}`}>
                      <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                        <CardContent className="p-4 flex items-center justify-between">
                          <div>
                            <p className="font-medium">{lead.company_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {lead.contact_person_name} • {lead.email}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge className={getStatusColor(lead.status)}>
                              {lead.status}
                            </Badge>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {results.accounts.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Klijenti
                </h3>
                <div className="grid gap-3">
                  {results.accounts.map((account) => (
                    <Link key={account.id} href={`/app/accounts/${account.id}`}>
                      <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                        <CardContent className="p-4 flex items-center justify-between">
                          <div>
                            <p className="font-medium">{account.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {account.industry && `${account.industry} • `}
                              {account.city || 'Nema lokacije'}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge className={getStatusColor(account.stage)}>
                              {account.stage === 'OPEN'
                                ? 'Otvoren'
                                : account.stage === 'CLOSED_WON'
                                  ? 'Dobijen'
                                  : account.stage === 'CLOSED_LOST'
                                    ? 'Izgubljen'
                                    : account.stage}
                            </Badge>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {results.contacts.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <UserCircle className="h-4 w-4" />
                  Kontakti
                </h3>
                <div className="grid gap-3">
                  {results.contacts.map((contact) => (
                    <Link key={contact.id} href={`/app/contacts/${contact.id}`}>
                      <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                        <CardContent className="p-4 flex items-center justify-between">
                          <div>
                            <p className="font-medium">
                              {contact.first_name} {contact.last_name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {contact.account?.name && `${contact.account.name} • `}
                              {contact.email || contact.phone || 'Nema kontakta'}
                            </p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}

          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
