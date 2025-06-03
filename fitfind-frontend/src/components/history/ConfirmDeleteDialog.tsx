import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { SearchHistoryItem } from '@/types';

interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: SearchHistoryItem | null;
  onConfirm: () => void;
  loading?: boolean;
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  item,
  onConfirm,
  loading = false
}: ConfirmDeleteDialogProps) {
  if (!item) return null;

  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-8">
        <DialogHeader className="pb-8 text-center">
          <DialogTitle className="flex items-center justify-center gap-2 text-destructive text-lg font-semibold">
            <AlertTriangle className="w-5 h-5" />
            Delete Search History
          </DialogTitle>
          <DialogDescription className="text-center pt-3 text-muted-foreground leading-relaxed">
            Are you sure you want to delete this search? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {/* Symmetrical action buttons - longer width */}
        <div className="flex gap-4 justify-center">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="w-42 h-9 font-medium"
          >
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            size="sm"
            onClick={handleConfirm}
            disabled={loading}
            className="w-42 h-9 font-medium gap-2"
          >
            {loading ? (
              <>
                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span className="text-xs">Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3 h-3" />
                Delete
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 