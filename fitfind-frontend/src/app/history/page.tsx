"use client";

import { History, Clock, Search } from "lucide-react";

export default function HistoryPage() {
  return (
    <div className="h-full p-8 bg-gradient-to-br from-muted/30 to-primary/5">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Search History</h1>
          <p className="text-muted-foreground">
            View your previous outfit searches and recommendations
          </p>
        </div>

        <div className="h-96 flex items-center justify-center">
          <div className="text-center">
            <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4 mx-auto">
              <History className="w-12 h-12 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">No search history yet</h3>
            <p className="text-muted-foreground mb-4">
              Start uploading outfit photos to build your search history
            </p>
            <a 
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Search className="h-4 w-4" />
              Start Searching
            </a>
          </div>
        </div>
      </div>
    </div>
  );
} 