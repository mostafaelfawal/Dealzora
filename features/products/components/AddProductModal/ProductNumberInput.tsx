import RequiredMark from "@/components/RequiredMark";

export default function ProductNumberInput({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="font-medium text-gray-700">
        {label} {required && <RequiredMark />}
      </label>
      <input
        type="number"
        className="transition-shadow duration-200 rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-400"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}
