import { IconType } from "react-icons";

export default function HeaderPage({
  Icon,
  title,
}: {
  Icon: IconType;
  title: string;
}) {
  return (
    <div className="flex items-center justify-center gap-3 mb-6">
      <Icon className="text-blue-600 text-3xl" />
      <h1 className="text-2xl font-semibold text-gray-800">{title}</h1>
    </div>
  );
}
