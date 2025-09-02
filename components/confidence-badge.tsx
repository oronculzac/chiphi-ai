'use client';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertCircle, Info, CheckCircle } from 'lucide-react';

interface ConfidenceBadgeProps {
  confidence: number;
  explanation?: string;
  showIcon?: boolean;
  size?: 'sm' | 'default' | 'lg';
}

export function ConfidenceBadge({ 
  confidence, 
  explanation, 
  showIcon = true,
  size = 'default' 
}: ConfidenceBadgeProps) {
  // Determine badge variant and icon based on confidence level
  const getBadgeProps = (confidence: number) => {
    if (confidence >= 80) {
      return {
        variant: 'default' as const,
        icon: <CheckCircle className="w-3 h-3" />,
        label: 'High Confidence',
        color: 'text-green-600'
      };
    }
    if (confidence >= 60) {
      return {
        variant: 'secondary' as const,
        icon: <Info className="w-3 h-3" />,
        label: 'Medium Confidence',
        color: 'text-yellow-600'
      };
    }
    return {
      variant: 'destructive' as const,
      icon: <AlertCircle className="w-3 h-3" />,
      label: 'Low Confidence',
      color: 'text-red-600'
    };
  };

  const badgeProps = getBadgeProps(confidence);

  const badgeContent = (
    <Badge variant={badgeProps.variant} className="cursor-help">
      {showIcon && badgeProps.icon}
      <span className={showIcon ? 'ml-1' : ''}>{confidence}%</span>
    </Badge>
  );

  // If no explanation provided, return badge without tooltip
  if (!explanation) {
    return badgeContent;
  }

  // Return badge with tooltip explanation
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badgeContent}
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">{badgeProps.label}</p>
            <p className="text-sm">{explanation}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}