'use client';

import { useEffect, useState } from 'react';
import { supabase, Contact } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Search,
  Users,
  MoreHorizontal,
  Mail,
  Phone,
  Building2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { canViewAll } from '@/lib/auth/permissions';
import { useLanguage } from '@/lib/i18n/language-context';
import { auditLogger } from '@/lib/audit/audit-logger';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] as const },
  },
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { profile, user } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();
  const { toast } = useToast();

  const handleDelete = async (contact: Contact) => {
    if (!confirm(t('common.delete_confirm_record'))) return;

    const { error } = await supabase
      .from('contacts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', contact.id);

    if (!error) {
      await auditLogger.logChange('CONTACT', contact.id, 'DELETE', 'Status', 'Active', 'Deleted');
      toast({
        title: t('message.contact_deleted'),
        description: t('message.contact_deleted_desc')
      });
      fetchContacts();
    } else {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const fetchContacts = async () => {
    setLoading(true);
    let query = supabase
      .from('contacts')
      .select('*, account:accounts!contacts_account_id_fkey(*), owner:profiles!contacts_owner_id_fkey(*)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (profile && !canViewAll(profile.role)) {
      query = query.eq('owner_id', user?.id);
    }

    const { data, error } = await query;

    if (data && !error) {
      let filtered = data;
      if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase();
        filtered = data.filter(
          (contact) =>
            contact.first_name?.toLowerCase().includes(lowerQuery) ||
            contact.last_name?.toLowerCase().includes(lowerQuery) ||
            contact.email?.toLowerCase().includes(lowerQuery)
        );
      }
      setContacts(filtered);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchContacts();
  }, [profile]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (profile) fetchContacts();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="page-container"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-glow">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{t('contacts.title')}</h1>
                <p className="text-sm text-muted-foreground">{t('subtitle.manage_contacts')}</p>
              </div>
            </div>
          </div>
          <Button
            onClick={() => router.push('/app/contacts/new')}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            {t('contacts.new_contact')}
          </Button>
        </div>
      </motion.div>

      {/* Search */}
      <motion.div variants={itemVariants} className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('contacts.search_placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </motion.div>

      {/* Table */}
      <motion.div variants={itemVariants}>
        <Card className="overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1 text-foreground">{t('contacts.no_contacts')}</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Get started by creating your first contact.
              </p>
              <Button className="mt-6" onClick={() => router.push('/app/contacts/new')}>
                <Plus className="h-4 w-4 mr-2" />
                New Contact
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border">
                  <TableHead className="w-[250px]">{t('contacts.table.name')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('contacts.table.account')}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t('contacts.table.title')}</TableHead>
                  <TableHead className="hidden xl:table-cell">{t('contacts.table.email')}</TableHead>
                  <TableHead className="hidden xl:table-cell">{t('contacts.table.phone')}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t('contacts.table.owner')}</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact, index) => (
                  <motion.tr
                    key={contact.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="group cursor-pointer hover:bg-muted/50 transition-colors border-border"
                    onClick={() => router.push(`/app/contacts/${contact.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center">
                          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                            {contact.first_name?.charAt(0).toUpperCase()}{contact.last_name?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-primary">{contact.first_name} {contact.last_name}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {contact.account ? (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Building2 className="h-3.5 w-3.5" />
                          <span>{contact.account.name}</span>
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {contact.title || '-'}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      {contact.email ? (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Mail className="h-3.5 w-3.5" />
                          <span>{contact.email}</span>
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      {contact.phone ? (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Phone className="h-3.5 w-3.5" />
                          <span>{contact.phone}</span>
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-gradient-to-br from-primary to-primary-600 flex items-center justify-center text-[10px] font-medium text-primary-foreground">
                          {contact.owner?.full_name?.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm text-muted-foreground">{contact.owner?.full_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/app/contacts/${contact.id}`)}>
                            View details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/app/contacts/${contact.id}/edit`)}>
                            Edit contact
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(contact);
                            }}
                            className="text-red-600 focus:text-red-600"
                          >
                            {t('common.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </motion.div>

      {/* Results count */}
      {!loading && contacts.length > 0 && (
        <motion.p
          variants={itemVariants}
          className="mt-4 text-sm text-muted-foreground"
        >
          Showing {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
        </motion.p>
      )}
    </motion.div>
  );
}
