"use client";

import { useState } from "react";
import axios from "axios";
import { validateImage } from "../utils/validateImage";
import toast from "react-hot-toast";

export function useProductImage(defaultImage?: string) {
  const [previewImage, setPreviewImage] = useState<string | null>(
    defaultImage || null
  );
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // اختيار صورة
  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) handleFileUpload(selectedFile);
  };

  // سحب الصورة وإفلاتها
  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const droppedFile = event.dataTransfer.files?.[0];
    if (droppedFile) handleFileUpload(droppedFile);
  };

  // عرض الصورة محليًا مؤقتًا
  const handleFileUpload = (selectedFile: File) => {
    if (!validateImage(selectedFile)) return;
    const imageUrl = URL.createObjectURL(selectedFile);
    setPreviewImage(imageUrl);
    setFile(selectedFile);
  };

  // رفع الصورة إلى ImgBB
  const handleUploadImgBB = async (
    fileToUpload: File | null
  ): Promise<string | null> => {
    const uploadFile = fileToUpload || file;

    if (!uploadFile) {
      return null;
    }

    try {
      const formData = new FormData();
      formData.append("image", uploadFile);

      const response = await axios.post(
        "https://api.imgbb.com/1/upload?key=eae8a44e90f6075a5fc2f3e096d89a58",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      const uploadedUrl = response.data.data.url;
      return uploadedUrl;
    } catch (error) {
      console.error(error);
      toast.error("فشل رفع الصورة");
      return null;
    }
  };

  const handleDeleteImage = () => {
    setPreviewImage(null);
    setFile(null);
  };

  const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  return {
    previewImage,
    file,
    isDragging,
    handleUploadImgBB,
    handleImageChange,
    handleDeleteImage,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    setFile,
    setPreviewImage,
  };
}
