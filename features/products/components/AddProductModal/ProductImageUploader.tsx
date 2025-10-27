"use client";

import { FaImage } from "react-icons/fa";
import Image from "next/image";
import { CgClose } from "react-icons/cg";
import Tooltip from "@/components/Tooltip";

interface ProductImageUploaderProps {
  previewImage: string | null;
  isDragging: boolean;
  handleDragOver: (event: React.DragEvent<HTMLLabelElement>) => void;
  handleDragLeave: (event: React.DragEvent<HTMLLabelElement>) => void;
  handleDrop: (event: React.DragEvent<HTMLLabelElement>) => void;
  handleDeleteImage: () => void;
  handleImageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function ProductImageUploader({
  previewImage,
  isDragging,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleDeleteImage,
  handleImageChange,
}: ProductImageUploaderProps) {
  return (
    <>
      <label
        htmlFor="imageUpload"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`text-gray-500 rounded-xl flex flex-col items-center gap-2 p-6 border-2 cursor-pointer border-dashed transition-colors duration-300 relative overflow-hidden ${
          isDragging
            ? "border-blue-400 text-blue-400 bg-blue-50"
            : "border-gray-300 hover:border-blue-400 hover:text-blue-400"
        }`}
      >
        {previewImage ? (
          <div className="relative w-40 h-40">
            <Tooltip message="مسح الصوره">
              <button
                type="button"
                onClick={handleDeleteImage}
                className="absolute -top-1 -left-3 z-3 rounded-full flex justify-center items-center size-6 bg-red-500 text-white hover:bg-red-700 duration-200 transition-colors"
              >
                <CgClose />
              </button>
            </Tooltip>
            <Image
              src={previewImage}
              alt="Preview"
              fill
              unoptimized
              className="object-cover rounded-xl"
            />
            <div className="rounded-xl absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
              <p className="text-white text-sm font-medium">تغيير الصورة</p>
            </div>
          </div>
        ) : (
          <>
            <FaImage size={40} />
            <p className="font-semibold text-center">
              {isDragging
                ? "أفلت الصورة هنا 👇"
                : "اسحب وأفلت صورة المنتج هنا أو اضغط للتحميل"}
            </p>
          </>
        )}
      </label>

      <input
        id="imageUpload"
        type="file"
        accept="image/*"
        onChange={handleImageChange}
        className="hidden"
      />
    </>
  );
}
