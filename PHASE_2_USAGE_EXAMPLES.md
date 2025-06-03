# Phase 2 Usage Examples: Enhanced useSearchHistory Hook

## Overview
These examples demonstrate how to integrate the enhanced `useSearchHistory` hook with its new delete functionality into React components.

## Basic Usage Example

```typescript
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { SearchHistoryCard } from '@/components/history/SearchHistoryCard';

function SearchHistoryPage() {
  const {
    // Data
    filteredHistory,
    totalCount,
    
    // State
    loading,
    error,
    deletingItems,
    
    // Actions
    deleteHistoryItem,
    isItemDeleting,
    refresh
  } = useSearchHistory();

  const handleDelete = async (historyId: string) => {
    // Show confirmation dialog
    if (!confirm('Are you sure you want to delete this search?')) return;
    
    // Delete with automatic optimistic updates
    const result = await deleteHistoryItem(historyId);
    
    if (result.success) {
      // Success! Item already removed from UI
      console.log('Search deleted successfully');
    } else {
      // Error occurred, item automatically restored
      alert(`Delete failed: ${result.error}`);
    }
  };

  if (loading.isLoading && filteredHistory.length === 0) {
    return <div>Loading search history...</div>;
  }

  return (
    <div>
      <h1>Search History ({totalCount} items)</h1>
      
      {error.hasError && (
        <div className="error-banner">
          Error: {error.message}
        </div>
      )}
      
      {/* Show global deleting status */}
      {deletingItems.size > 0 && (
        <div className="deleting-banner">
          Deleting {deletingItems.size} items...
        </div>
      )}
      
      <div className="history-grid">
        {filteredHistory.map(item => (
          <SearchHistoryCard
            key={item.id}
            item={item}
            onDelete={() => handleDelete(item.id)}
            isDeleting={isItemDeleting(item.id)}
          />
        ))}
      </div>
      
      <button onClick={refresh}>
        Refresh History
      </button>
    </div>
  );
}
```

## Advanced Integration with Toast Notifications

```typescript
import { useState } from 'react';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { toast } from 'react-hot-toast';

function AdvancedSearchHistory() {
  const {
    filteredHistory,
    deleteHistoryItem,
    isItemDeleting,
    error
  } = useSearchHistory();

  const [showConfirmDialog, setShowConfirmDialog] = useState<string | null>(null);

  const handleDeleteWithToast = async (historyId: string, itemName: string) => {
    // Show loading toast
    const loadingToast = toast.loading('Deleting search...');
    
    try {
      const result = await deleteHistoryItem(historyId);
      
      if (result.success) {
        toast.success(`"${itemName}" deleted successfully`, {
          id: loadingToast
        });
      } else {
        toast.error(result.error || 'Delete failed', {
          id: loadingToast
        });
      }
    } catch (error) {
      toast.error('Unexpected error occurred', {
        id: loadingToast
      });
    }
  };

  const confirmDelete = (historyId: string, itemName: string) => {
    setShowConfirmDialog(null);
    handleDeleteWithToast(historyId, itemName);
  };

  return (
    <div>
      {filteredHistory.map(item => {
        const itemName = item.search_sessions.image_filename;
        const isDeleting = isItemDeleting(item.id);
        
        return (
          <div key={item.id} className="history-item">
            <img src={item.search_sessions.image_url} alt={itemName} />
            <span>{itemName}</span>
            
            <button
              onClick={() => setShowConfirmDialog(item.id)}
              disabled={isDeleting}
              className={isDeleting ? 'deleting' : ''}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        );
      })}
      
      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <ConfirmDialog
          message="Are you sure you want to delete this search?"
          onConfirm={() => {
            const item = filteredHistory.find(h => h.id === showConfirmDialog);
            if (item) {
              confirmDelete(item.id, item.search_sessions.image_filename);
            }
          }}
          onCancel={() => setShowConfirmDialog(null)}
        />
      )}
    </div>
  );
}
```

## Bulk Operations Example

```typescript
import { useState } from 'react';
import { useSearchHistory } from '@/hooks/useSearchHistory';

function BulkOperationsExample() {
  const {
    filteredHistory,
    deleteHistoryItem,
    deletingItems,
    isItemDeleting
  } = useSearchHistory();

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    
    try {
      // Delete items in parallel
      const deletePromises = Array.from(selectedItems).map(historyId =>
        deleteHistoryItem(historyId)
      );
      
      const results = await Promise.allSettled(deletePromises);
      
      // Count successes and failures
      const successes = results.filter(r => 
        r.status === 'fulfilled' && r.value.success
      ).length;
      const failures = results.length - successes;
      
      if (failures === 0) {
        toast.success(`Successfully deleted ${successes} items`);
      } else {
        toast.warning(`Deleted ${successes} items, ${failures} failed`);
      }
      
      setSelectedItems(new Set());
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const toggleSelection = (historyId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(historyId)) {
        newSet.delete(historyId);
      } else {
        newSet.add(historyId);
      }
      return newSet;
    });
  };

  return (
    <div>
      <div className="bulk-controls">
        <button
          onClick={handleBulkDelete}
          disabled={selectedItems.size === 0 || isBulkDeleting}
        >
          {isBulkDeleting 
            ? 'Deleting...' 
            : `Delete Selected (${selectedItems.size})`
          }
        </button>
        
        {deletingItems.size > 0 && (
          <span>Deleting {deletingItems.size} items...</span>
        )}
      </div>
      
      {filteredHistory.map(item => (
        <div key={item.id} className="history-item">
          <input
            type="checkbox"
            checked={selectedItems.has(item.id)}
            onChange={() => toggleSelection(item.id)}
            disabled={isItemDeleting(item.id)}
          />
          
          <span className={isItemDeleting(item.id) ? 'deleting' : ''}>
            {item.search_sessions.image_filename}
          </span>
          
          {isItemDeleting(item.id) && <span>Deleting...</span>}
        </div>
      ))}
    </div>
  );
}
```

## Error Handling and Recovery

```typescript
function ErrorHandlingExample() {
  const {
    filteredHistory,
    deleteHistoryItem,
    error,
    clearError // This would need to be added to the hook interface
  } = useSearchHistory();

  const handleDeleteWithRetry = async (historyId: string, maxRetries = 3) => {
    let attempt = 0;
    
    while (attempt < maxRetries) {
      try {
        const result = await deleteHistoryItem(historyId);
        
        if (result.success) {
          toast.success('Successfully deleted');
          return;
        } else if (result.error?.includes('not found')) {
          // Item already deleted, no need to retry
          toast.info('Item was already deleted');
          return;
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        attempt++;
        
        if (attempt < maxRetries) {
          toast.loading(`Retry attempt ${attempt}...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        } else {
          toast.error(`Failed after ${maxRetries} attempts`);
        }
      }
    }
  };

  return (
    <div>
      {error.hasError && (
        <div className="error-banner">
          <span>Error: {error.message}</span>
          <button onClick={() => window.location.reload()}>
            Reload Page
          </button>
        </div>
      )}
      
      {filteredHistory.map(item => (
        <div key={item.id}>
          <span>{item.search_sessions.image_filename}</span>
          <button onClick={() => handleDeleteWithRetry(item.id)}>
            Delete with Retry
          </button>
        </div>
      ))}
    </div>
  );
}
```

## Performance Monitoring

```typescript
function PerformanceMonitoringExample() {
  const hook = useSearchHistory();
  const [deleteStats, setDeleteStats] = useState({
    totalDeletes: 0,
    successfulDeletes: 0,
    failedDeletes: 0,
    averageDeleteTime: 0
  });

  const monitoredDelete = async (historyId: string) => {
    const startTime = performance.now();
    
    try {
      const result = await hook.deleteHistoryItem(historyId);
      const duration = performance.now() - startTime;
      
      setDeleteStats(prev => ({
        totalDeletes: prev.totalDeletes + 1,
        successfulDeletes: result.success 
          ? prev.successfulDeletes + 1 
          : prev.successfulDeletes,
        failedDeletes: !result.success 
          ? prev.failedDeletes + 1 
          : prev.failedDeletes,
        averageDeleteTime: (prev.averageDeleteTime + duration) / 2
      }));
      
      return result;
    } catch (error) {
      setDeleteStats(prev => ({
        ...prev,
        totalDeletes: prev.totalDeletes + 1,
        failedDeletes: prev.failedDeletes + 1
      }));
      throw error;
    }
  };

  return (
    <div>
      <div className="stats-panel">
        <h3>Delete Statistics</h3>
        <p>Total: {deleteStats.totalDeletes}</p>
        <p>Successful: {deleteStats.successfulDeletes}</p>
        <p>Failed: {deleteStats.failedDeletes}</p>
        <p>Avg Time: {deleteStats.averageDeleteTime.toFixed(2)}ms</p>
        <p>Currently Deleting: {hook.deletingItems.size}</p>
      </div>
      
      {hook.filteredHistory.map(item => (
        <button
          key={item.id}
          onClick={() => monitoredDelete(item.id)}
          disabled={hook.isItemDeleting(item.id)}
        >
          Delete {item.search_sessions.image_filename}
        </button>
      ))}
    </div>
  );
}
```

## Key Integration Patterns

### 1. **Optimistic UI Pattern**
- Items disappear immediately when delete is clicked
- Automatic rollback if operation fails
- No manual UI state management required

### 2. **Loading State Management**
- Use `isItemDeleting(id)` for individual item loading states
- Use `deletingItems.size` for global operation count
- Disable interactions during deletion

### 3. **Error Handling**
- Hook automatically handles API errors
- Components receive simple success/error responses
- Error details available through hook's error state

### 4. **User Experience**
- Immediate feedback through optimistic updates
- Clear loading indicators
- Graceful error recovery
- Prevention of duplicate operations

These patterns ensure a smooth, professional user experience while maintaining code simplicity and robustness. 