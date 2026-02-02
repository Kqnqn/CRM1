import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';

interface RecordHeaderProps {
  title: string;
  status?: string;
  statusVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
  fields?: Array<{ label: string; value: string | number }>;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'default' | 'destructive' | 'outline';
  }>;
  moreActions?: Array<{ label: string; onClick: () => void }>;
}

export function RecordHeader({
  title,
  status,
  statusVariant = 'default',
  fields = [],
  actions = [],
  moreActions = [],
}: RecordHeaderProps) {
  return (
    <div className="bg-card border-b border-border">
      <div className="px-6 py-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-semibold">{title}</h1>
              {status && (
                <Badge variant={statusVariant}>{status}</Badge>
              )}
            </div>
            {fields.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-4">
                {fields.map((field, index) => (
                  <div key={index} className="text-sm">
                    <span className="text-muted-foreground">{field.label}:</span>{' '}
                    <span className="font-medium">{field.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {actions.map((action, index) => (
              <Button
                key={index}
                onClick={action.onClick}
                variant={action.variant || 'default'}
                size="sm"
              >
                {action.label}
              </Button>
            ))}
            {moreActions.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {moreActions.map((action, index) => (
                    <DropdownMenuItem key={index} onClick={action.onClick}>
                      {action.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
