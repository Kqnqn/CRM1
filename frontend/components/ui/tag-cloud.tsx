'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tag as TagIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n/language-context';

interface TagCloudProps {
    allTags: string[];
    selectedTags: string[];
    onTagClick: (tag: string) => void;
    onClear: () => void;
    className?: string;
}

export function TagCloud({ allTags, selectedTags, onTagClick, onClear, className }: TagCloudProps) {
    const { t } = useLanguage();

    if (allTags.length === 0 && selectedTags.length === 0) {
        return (
            <div className={cn('p-6 text-center text-sm text-muted-foreground whitespace-nowrap', className)}>
                {t('common.no_tags')}
            </div>
        );
    }

    return (
        <div className={cn('flex flex-wrap items-center gap-2 p-3 bg-muted/30 rounded-lg border border-dashed border-border mb-4', className)}>
            <div className="flex items-center gap-2 mr-2 text-muted-foreground">
                <TagIcon className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Oznake:</span>
            </div>

            {allTags.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                    <Badge
                        key={tag}
                        variant={isSelected ? 'default' : 'outline'}
                        className={cn(
                            'cursor-pointer transition-all hover:scale-105',
                            isSelected
                                ? 'bg-primary shadow-glow'
                                : 'hover:border-primary/50 hover:bg-primary/5'
                        )}
                        onClick={() => onTagClick(tag)}
                    >
                        {tag}
                    </Badge>
                );
            })}

            {selectedTags.length > 0 && (
                <button
                    onClick={onClear}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors ml-auto pl-2 border-l border-border"
                >
                    <X className="h-3 w-3" />
                    Clear all
                </button>
            )}
        </div>
    );
}
