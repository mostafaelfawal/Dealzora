import { Box, InputAdornment, TextField } from "@mui/material";
import { FaSearch } from "react-icons/fa";

export default function SearchInput({
  label,
  change,
}: {
  label: string;
  change: (value: string) => void;
}) {
  return (
    <TextField
      fullWidth
      placeholder={`ابحث عن ${label}...`}
      onChange={(e) => change(e.target.value)}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <Box
              sx={{
                color: "grey.400",
                ".Mui-focused &": {
                  color: "primary.main",
                }
              }}
            >
              <FaSearch />
            </Box>
          </InputAdornment>
        ),
        sx: {
          borderRadius: "16px",
          backgroundColor: "white",
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "#e5e7eb",
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "#d1d5db",
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#3b82f6",
            borderWidth: "2px",
          },
          // إضافة transition للون
          "& .MuiInputAdornment-root svg": {
            transition: "color 0.2s ease-in-out",
          },
        },
      }}
      variant="outlined"
      size="small"
    />
  );
}
