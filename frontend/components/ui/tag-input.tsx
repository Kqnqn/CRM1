'use client';

import React, { useState, KeyboardEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { X, Tag as TagIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TagInputProps {
    tags: string[];
    onChange: (tags: string[]) => void;
    placeholder?: string;
    className?: string;
}

export function TagInput({ tags, onChange, placeholder = 'Add tag...', className }: TagInputProps) {
    const [inputValue, setInputValue] = useState('');

    const addTag = () => {
        const newTag = inputValue.trim().toLowerCase();
        if (newTag && !tags.includes(newTag)) {
            onChange([...tags, newTag]);
            setInputValue('');
        } else {
            setInputValue('');
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag();
        } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
            onChange(tags.slice(0, -1));
        }
    };

    const removeTag = (tagToRemove: string) => {
        onChange(tags.filter((tag) => tag !== tagToRemove));
    };

    return (
        <div className={cn('space-y-2', className)}>
            <div className="flex flex-wrap gap-2 min-h-[2rem] p-1 items-center">
                {tags.map((tag) => (
                    <Badge
                        key={tag}
                        variant="soft"
                        className="flex items-center gap-1 pl-2 pr-1 py-1 bg-primary/10 text-primary border-primary/20"
                    >
                        <TagIcon className="h-3 w-3" />
                        {tag}
                        <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="hover:bg-primary/20 rounded-full p-0.5 transition-colors"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </Badge>
                ))}
            </div>
            <Input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={addTag}
                placeholder={tags.length === 0 ? placeholder : ''}
                className="h-9"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
                Pritisnite Enter ili zarez da dodate oznaku
            </p>
        </div>
    );
}
