import type { TransferApproval } from "@/api/types";

import { approvalBusy, approvalText, formatQty, parseQty, transferSummary } from "../transferText";

const approval = (over: Partial<TransferApproval>): TransferApproval => ({
  id: "c", action: "approve", status: "pending", requested_by: "owner", device_name: "Pixel",
  created_at: "2026-11-15T10:00:00Z", claimed_at: null, resolved_at: null, error_message: null, ...over,
});

describe("الكميات (× 1000)", () => {
  test("formatQty", () => {
    expect(formatQty(20_000)).toBe("20");
    expect(formatQty(1_500)).toBe("1.5");
    expect(formatQty(250)).toBe("0.25");
  });
  test("parseQty يقبل الأرقام العربية ويرفض الأكبر من المطلوب", () => {
    expect(parseQty("15", 20_000)).toBe(15_000);
    expect(parseQty("١٢٫٥", 20_000)).toBe(12_500);
    expect(parseQty("", 20_000)).toBe(0);
    expect(parseQty("21", 20_000)).toBeNull();
    expect(parseQty("1.2345", 20_000)).toBeNull();
    expect(parseQty("abc", 20_000)).toBeNull();
  });
});

describe("موافقة الهاتف", () => {
  test("النصوص", () => {
    expect(approvalText(null, "requested")).toBeNull();
    expect(approvalText(approval({}), "requested")).toBe("وافق owner من الهاتف، وتنتظر تنفيذ الفرع");
    expect(approvalText(approval({ status: "failed", error_message: "الكمية المتاحة من «لبن» أقل" }), "requested")).toBe(
      "تعذّر على الفرع التنفيذ: الكمية المتاحة من «لبن» أقل",
    );
    expect(approvalText(approval({ status: "done" }), "sent")).toBe("وافق owner من الهاتف");
  });
  test("approvalBusy", () => {
    expect(approvalBusy(approval({ status: "pending" }))).toBe(true);
    expect(approvalBusy(approval({ status: "executing" }))).toBe(true);
    expect(approvalBusy(approval({ status: "failed" }))).toBe(false);
    expect(approvalBusy(null)).toBe(false);
  });
});

test("transferSummary", () => {
  expect(transferSummary({ from_branch_name: "المعادي", to_branch_name: "الدقي", status: "requested" })).toBe("الدقي يطلب من المعادي");
  expect(transferSummary({ from_branch_name: "المعادي", to_branch_name: "الدقي", status: "sent" })).toBe("من المعادي إلى الدقي");
});
