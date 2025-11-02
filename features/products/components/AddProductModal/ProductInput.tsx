import { useState, useEffect } from "react";
import { FieldErrors } from "react-hook-form";
import { motion } from "framer-motion";
import {
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  SelectChangeEvent,
  Autocomplete,
  TextField,
} from "@mui/material";
import { FaUserPlus } from "react-icons/fa";

import RequiredMark from "@/components/RequiredMark";
import Tooltip from "@/components/Tooltip";
import { SupplierType } from "@/features/suppliers/types/SupplierType";
import Link from "next/link";

type ProductInputProps = {
  label: string;
  register: any;
  errors: FieldErrors;
  required?: boolean;
  type: "category" | "suppliers";
  categories?: string[];
  suppliers?: SupplierType[];
  icon: React.ReactElement;
};

export default function ProductInput({
  label,
  register,
  errors,
  required = false,
  type,
  categories = [],
  suppliers = [],
  icon,
}: ProductInputProps) {
  const { name: fieldName, value, onChange } = register;
  const fieldError = errors[fieldName]?.message as string | undefined;

  const [selectedValue, setSelectedValue] = useState(value || "");

  /**  تحديث قيمة الحقل داخل form و state */
  const updateFieldValue = (newValue: string) => {
    setSelectedValue(newValue);
    onChange({ target: { name: fieldName, value: newValue } });
  };

  /**  تغيير قيمة الـ Select */
  const handleSelectChange = (event: SelectChangeEvent) => {
    updateFieldValue(event.target.value);
  };

  /**  تحديث القيمة إذا تم تغييرها من الخارج */
  useEffect(() => {
    setSelectedValue(value || "");
  }, [value]);

  return (
    <div className="flex flex-col gap-1">
      {/*  Label */}
      <label className="flex items-center gap-2 font-medium text-gray-700">
        {icon}
        <span>
          {label} {required && <RequiredMark />}
        </span>
      </label>

      <div className="flex gap-2 items-center">
        <FormControl fullWidth size="small">
          {type === "suppliers" && (
            <InputLabel id={`${fieldName}-label`}>اختر المورد</InputLabel>
          )}

          {type === "category" ? (
            /*  Autocomplete للفئات */
            <Autocomplete
              freeSolo
              options={categories}
              value={selectedValue}
              onChange={(_, newVal) => updateFieldValue(newVal || "")}
              onInputChange={(_, newInput) => updateFieldValue(newInput || "")}
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}
                />
              )}
            />
          ) : (
            /*  Select للموردين */
            <Select
              labelId={`${fieldName}-label`}
              id={fieldName}
              value={selectedValue}
              label="اختر المورد"
              onChange={handleSelectChange}
              sx={{
                borderRadius: "8px",
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#d1d5db",
                },
                "&:hover .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#3b82f6",
                },
                "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#3b82f6",
                  borderWidth: "2px",
                },
              }}
            >
              <MenuItem value="">
                <em>اختر مورد</em>
              </MenuItem>
              {suppliers.map((supplier) => (
                <MenuItem key={supplier.id} value={supplier.id}>
                  <p className="flex flex-col">
                    {supplier.name}
                    <span className="text-gray-500 -mt-1">
                      {supplier.companyName}
                    </span>
                  </p>
                </MenuItem>
              ))}
            </Select>
          )}
        </FormControl>

        {/*  زر إضافة مورد */}
        {type === "suppliers" && (
          <Tooltip message="إضافة مورد جديد" side="bottom">
            <Link
              href="/dealzora/suppliers/add-supplier"
              type="button"
              className="flex items-center justify-center bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg transition"
            >
              <FaUserPlus className="text-lg" />
            </Link>
          </Tooltip>
        )}
      </div>

      {/*  عرض الأخطاء */}
      {fieldError && (
        <motion.p
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="text-red-500 font-semibold text-sm mt-1"
        >
          {fieldError}
        </motion.p>
      )}
    </div>
  );
}
