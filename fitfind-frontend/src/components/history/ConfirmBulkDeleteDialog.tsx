"use client";

import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface ConfirmBulkDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemCount: number;
  onConfirm: () => void;
  loading?: boolean;
}

export function ConfirmBulkDeleteDialog({
  open,
  onOpenChange,
  itemCount,
  onConfirm,
  loading = false
}: ConfirmBulkDeleteDialogProps) {
  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-8">
        <DialogHeader className="pb-8 text-center">
          <DialogTitle className="flex items-center justify-center gap-2 text-destructive text-lg font-semibold">
            <AlertTriangle className="w-5 h-5" />
            Delete Multiple Items
          </DialogTitle>
          <DialogDescription className="text-center pt-3 text-muted-foreground leading-relaxed">
            Are you sure you want to delete {itemCount} search history {itemCount === 1 ? 'item' : 'items'}? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {/* Action buttons */}
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
                Delete {itemCount} {itemCount === 1 ? 'item' : 'items'}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 