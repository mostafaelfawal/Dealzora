"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CgClose } from "react-icons/cg";

type ModalProps = {
  title: string;
  closeModal: VoidFunction;
  children: React.ReactNode;
};

export default function Modal({ title, closeModal, children }: ModalProps) {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-5"
        onClick={closeModal}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* منع إغلاق المودال عند الضغط داخله */}
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-y-auto max-h-screen bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4 relative"
        >
          {/* رأس المودال */}
          <div className="flex justify-between items-center mb-6  pb-2 border-b border-b-gray-300">
            <h2 className="text-xl font-semibold text-gray-800 w-full text-center">{title}</h2>
            <button
              onClick={closeModal}
              className="text-gray-400 hover:text-gray-700 transition-colors"
            >
              <CgClose size={22} />
            </button>
          </div>

          {/* محتوى المودال */}
          <div className="text-gray-700">{children}</div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
