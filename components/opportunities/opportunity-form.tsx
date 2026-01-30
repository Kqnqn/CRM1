'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, Opportunity } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Check, ChevronsUpDown } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n/language-context';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';

interface OpportunityFormProps {
    initialData?: Opportunity;
    initialAccountId?: string;
}

export function OpportunityForm({ initialData, initialAccountId }: OpportunityFormProps) {
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [accounts, setAccounts] = useState<Array<{ id: string; name: string; city?: string; industry?: string }>>([]);
    const [contacts, setContacts] = useState<Array<{ id: string; first_name: string; last_name: string }>>([]);
    const [accountSearchOpen, setAccountSearchOpen] = useState(false);
    const { t } = useLanguage();

    const [formData, setFormData] = useState({
        account_id: initialData?.account_id || initialAccountId || '',
        contact_id: initialData?.contact_id || '',
        name: initialData?.name || '',
        stage: initialData?.stage || 'PROSPECTING',
        amount: initialData?.amount?.toString() || '',
        close_date: initialData?.close_date ? new Date(initialData.close_date).toISOString().split('T')[0] : '',
        probability: initialData?.probability?.toString() || '50',
        description: initialData?.description || '',
    });

    useEffect(() => {
        const fetchData = async () => {
            const { data: accountsData } = await supabase
                .from('accounts')
                .select('id, name, city, industry')
                .eq('stage', 'OPEN')
                .order('name');
            if (accountsData) setAccounts(accountsData);
        };
        fetchData();
    }, []);

    const selectedAccount = accounts.find((a) => a.id === formData.account_id);

    useEffect(() => {
        if (formData.account_id) {
            const fetchContacts = async () => {
                const { data } = await supabase
                    .from('contacts')
                    .select('id, first_name, last_name')
                    .eq('account_id', formData.account_id);
                if (data) setContacts(data);
            };

            // Only fetch if it's a different account or we're loading initial data
            fetchContacts();
        } else {
            setContacts([]);
        }
    }, [formData.account_id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const opportunityData = {
                account_id: formData.account_id,
                contact_id: formData.contact_id || null,
                name: formData.name,
                stage: formData.stage,
                amount: parseFloat(formData.amount) || 0,
                close_date: formData.close_date || null,
                probability: parseInt(formData.probability),
                description: formData.description || null,
                owner_id: user?.id,
            };

            let result;
            if (initialData) {
                result = await supabase
                    .from('opportunities')
                    .update(opportunityData)
                    .eq('id', initialData.id);
            } else {
                result = await supabase
                    .from('opportunities')
                    .insert(opportunityData);
            }

            const { error: opError } = result;

            if (opError) throw opError;

            router.push(initialData ? `/app/opportunities/${initialData.id}` : '/app/opportunities');
            router.refresh();
        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    const updateFormData = (field: string, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    return (
        <div className="p-6 max-w-3xl mx-auto">
            <div className="mb-6">
                <Link
                    href={initialData ? `/app/opportunities/${initialData.id}` : "/app/opportunities"}
                    className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
                >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    {t('common.back')}
                </Link>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{initialData ? t('common.edit') : t('opportunities.new_opportunity')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <Alert variant="destructive">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="name">
                                    {t('opportunities.table.name')} <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) => updateFormData('name', e.target.value)}
                                    required
                                />
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="account_id">
                                    {t('opportunities.table.account')} <span className="text-red-500">*</span>
                                </Label>
                                <Popover open={accountSearchOpen} onOpenChange={setAccountSearchOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={accountSearchOpen}
                                            className="w-full justify-between"
                                            id="account_id"
                                        >
                                            {selectedAccount ? (
                                                <span>
                                                    {selectedAccount.name}
                                                    {selectedAccount.city && (
                                                        <span className="text-gray-500 ml-2">({selectedAccount.city})</span>
                                                    )}
                                                </span>
                                            ) : (
                                                t('common.select_account')
                                            )}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[400px] p-0">
                                        <Command>
                                            <CommandInput placeholder={t('common.search') + '...'} />
                                            <CommandList>
                                                <CommandEmpty>{t('common.no_results') || 'No results found.'}</CommandEmpty>
                                                <CommandGroup>
                                                    {accounts.map((account) => (
                                                        <CommandItem
                                                            key={account.id}
                                                            value={account.id}
                                                            onSelect={(currentValue) => {
                                                                updateFormData('account_id', currentValue === formData.account_id ? '' : currentValue);
                                                                setAccountSearchOpen(false);
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    formData.account_id === account.id ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            <div className="flex flex-col">
                                                                <span>{account.name}</span>
                                                                {(account.city || account.industry) && (
                                                                    <span className="text-xs text-gray-500">
                                                                        {[account.city, account.industry].filter(Boolean).join(' • ')}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                                {!formData.account_id && (
                                    <p className="text-sm text-red-500">{t('common.required_field')}</p>
                                )}
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="contact_id">{t('nav.contacts')}</Label>
                                <Select
                                    value={formData.contact_id}
                                    onValueChange={(value) => updateFormData('contact_id', value)}
                                >
                                    <SelectTrigger id="contact_id">
                                        <SelectValue placeholder={`${t('common.view')} ${t('nav.contacts').toLowerCase()} (${t('common.optional')})`} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {contacts.map((contact) => (
                                            <SelectItem key={contact.id} value={contact.id}>
                                                {contact.first_name} {contact.last_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="stage">{t('opportunities.table.stage')}</Label>
                                <Select
                                    value={formData.stage}
                                    onValueChange={(value) => updateFormData('stage', value)}
                                >
                                    <SelectTrigger id="stage">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="PROSPECTING">{t('stage.prospecting')}</SelectItem>
                                        <SelectItem value="QUALIFIED">{t('stage.qualified')}</SelectItem>
                                        <SelectItem value="PROPOSAL">{t('stage.proposal')}</SelectItem>
                                        <SelectItem value="NEGOTIATION">{t('stage.negotiation')}</SelectItem>
                                        <SelectItem value="CLOSED_WON">{t('status.closed_won')}</SelectItem>
                                        <SelectItem value="CLOSED_LOST">{t('status.closed_lost')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="probability">{t('opportunities.table.probability')} (%)</Label>
                                <Input
                                    id="probability"
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={formData.probability}
                                    onChange={(e) => updateFormData('probability', e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="amount">{t('opportunities.table.amount')}</Label>
                                <Input
                                    id="amount"
                                    type="number"
                                    step="0.01"
                                    value={formData.amount}
                                    onChange={(e) => updateFormData('amount', e.target.value)}
                                    placeholder="0.00"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="close_date">{t('opportunities.table.close_date')}</Label>
                                <Input
                                    id="close_date"
                                    type="date"
                                    value={formData.close_date}
                                    onChange={(e) => updateFormData('close_date', e.target.value)}
                                />
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="description">{t('common.description')}</Label>
                                <Textarea
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) => updateFormData('description', e.target.value)}
                                    rows={4}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end space-x-3 pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => router.back()}
                            >
                                {t('common.cancel')}
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? t('common.creating') : initialData ? t('common.update') : t('common.create')}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
