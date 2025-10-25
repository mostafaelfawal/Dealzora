"use client";

import { useState } from "react";
import { validateImage } from "../utils/validateImage";

export function useProductImage(
  onImageChange: (url: string) => void,
  initialImage: string
) {
  const [previewImage, setPreviewImage] = useState<string | null>(
    initialImage || null
  );
  const [isDragging, setIsDragging] = useState(false);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleFileUpload = (file: File) => {
    if (!validateImage(file)) return;
    const imageUrl = URL.createObjectURL(file);
    setPreviewImage(imageUrl);
    onImageChange(imageUrl);
  };

  const handleDeleteImage = () => {
    setPreviewImage(null);
    onImageChange("");
  };

  const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  return {
    previewImage,
    isDragging,
    handleImageChange,
    handleDeleteImage,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}
