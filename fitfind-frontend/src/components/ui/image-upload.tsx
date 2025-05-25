"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, Camera, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import type { UploadedImage } from "@/types";

interface ImageUploadProps {
  onImageSelect: (image: UploadedImage) => void;
  onImageRemove: () => void;
  uploadedImage: UploadedImage | null;
  className?: string;
  disabled?: boolean;
}

export function ImageUpload({ 
  onImageSelect, 
  onImageRemove, 
  uploadedImage, 
  className,
  disabled = false 
}: ImageUploadProps) {
  const [dragActive, setDragActive] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const preview = URL.createObjectURL(file);
      onImageSelect({
        file,
        preview,
        uploaded: false
      });
    }
  }, [onImageSelect]);

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
    disabled,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
  });

  const hasError = fileRejections.length > 0;

  if (uploadedImage) {
    return (
      <div className={cn("relative", className)}>
        <div className="relative rounded-xl overflow-hidden border-2 border-border bg-card">
          <img
            src={uploadedImage.preview}
            alt="Uploaded outfit"
            className="w-full h-auto max-h-96 object-contain"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={onImageRemove}
                className="bg-white/90 text-gray-900 hover:bg-white"
              >
                <X className="h-4 w-4" />
                Remove
              </Button>
              <Button
                variant="secondary"
                size="sm"
                {...getRootProps()}
                className="bg-white/90 text-gray-900 hover:bg-white"
              >
                <Camera className="h-4 w-4" />
                Replace
                <input {...getInputProps()} />
              </Button>
            </div>
          </div>
        </div>
        <div className="mt-3 text-center">
          <p className="text-sm text-muted-foreground">
            Your outfit photo is ready for analysis
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <div
        {...getRootProps()}
        className={cn(
          "relative cursor-pointer rounded-xl border-2 border-dashed transition-colors duration-200",
          isDragActive || dragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50",
          hasError && "border-destructive bg-destructive/5",
          disabled && "cursor-not-allowed opacity-50",
          "p-8 text-center"
        )}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center gap-4">
          <div className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center",
            isDragActive || dragActive 
              ? "bg-primary text-primary-foreground" 
              : "bg-muted text-muted-foreground",
            hasError && "bg-destructive text-destructive-foreground"
          )}>
            {hasError ? (
              <AlertCircle className="h-8 w-8" />
            ) : (
              <Upload className="h-8 w-8" />
            )}
          </div>
          
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">
              {isDragActive ? "Drop your outfit photo here" : "Upload your outfit photo"}
            </h3>
            <p className="text-sm text-muted-foreground">
              Drag and drop an image, or click to browse
            </p>
            <p className="text-xs text-muted-foreground">
              Supports JPG, PNG, WEBP (max 10MB)
            </p>
          </div>
          
          <Button 
            variant="outline" 
            size="sm"
            disabled={disabled}
            className="mt-2"
          >
            Choose File
          </Button>
        </div>
        
        {hasError && (
          <div className="mt-4 text-sm text-destructive">
            {fileRejections[0]?.errors[0]?.message || "File upload failed"}
          </div>
        )}
      </div>
    </div>
  );
} 