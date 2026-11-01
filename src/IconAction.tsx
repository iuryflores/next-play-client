import type { ComponentProps } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
export default function IconAction({
  label,
  icon: Icon,
  ...props
}: Omit<ComponentProps<typeof Button>, 'children'> & {
  label: string;
  icon: LucideIcon;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              {...props}
              type={props.type || 'button'}
              size="icon"
              aria-label={label}
            />
          }
        >
          <Icon aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
