import { createAsyncThunk } from "@reduxjs/toolkit";

export const fetchedSuppliers = createAsyncThunk(
  "suppliers/fetchSuppliers",
  async () => {}
);
