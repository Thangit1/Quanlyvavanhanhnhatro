/* eslint-disable @typescript-eslint/no-require-imports */
const React = require("react"),
  { createRoot } = require("react-dom/client"),
  { HandoverDocumentPanel } = require("documents");
const snapshot = (old) => ({
  schemaVersion: 2,
  general: {
    contractId: 8,
    contractCode: "HĐ-THỰC-TẾ",
    propertyName: "Nhà trọ Yên Nghĩa",
    roomCode: "A101",
    landlordName: "Chủ nhà Nguyễn",
    tenantName: "Nguyễn Thị Hòa 🏠",
    scheduledDate: "2026-11-04",
    reference: old ? "BB-CŨ" : "BB-MỚI",
    roomCondition: "Phòng sạch, đã kiểm tra",
    note: "Đã đối chiếu thực tế",
  },
  readings: { ELECTRICITY: old ? 1250 : 1300, WATER: 50 },
  keysCardsCount: old ? 1 : 2,
  assets: [
    {
      room_asset_id: 1,
      asset_name: old ? "Bàn học cũ" : "Bàn học mới",
      quantity: 1,
      condition_status: "GOOD",
      note: "Ảnh kiểm kê thực tế",
    },
  ],
  meters: [
    {
      id: 11,
      meter_type: "ELECTRICITY",
      meter_code: old ? "E-OLD" : "E-NEW",
      status: "ACTIVE",
    },
    { id: 12, meter_type: "WATER", meter_code: "W-REAL", status: "ACTIVE" },
  ],
  utilities: [
    { code: "ELECTRICITY", calculation_method: "METER" },
    { code: "WATER", calculation_method: "FIXED" },
  ],
});
const confirmation = (party) => ({
  party,
  actor_id: party === "LANDLORD" ? 1 : 5,
  actor_name: party === "LANDLORD" ? "Chủ nhà Nguyễn" : "Nguyễn Thị Hòa",
  confirmed_at: "2026-11-04T10:00:00",
});
const old = {
  id: 1,
  version: 1,
  code: "BBBG-8-1",
  contentHash: "a".repeat(64),
  createdAt: "2026-11-04",
  current: false,
  latest: false,
  integrityValid: true,
  liveHash: "c".repeat(64),
  status: "SUPERSEDED",
  changes: [],
  confirmations: [confirmation("LANDLORD"), confirmation("TENANT")],
  snapshot: snapshot(true),
};
const frameGetter = Object.getOwnPropertyDescriptor(
  HTMLIFrameElement.prototype,
  "contentWindow",
).get;
Object.defineProperty(HTMLIFrameElement.prototype, "contentWindow", {
  get() {
    const win = frameGetter.call(this);
    if (win)
      win.print = () => {
        window.printedText = win.document.body.textContent;
      };
    return win;
  },
});
window.confirm = () => true;
window.confirmationRequests = [];
function App() {
  const [role, setRole] = React.useState("TENANT");
  const [latest, setLatest] = React.useState({
    id: 2,
    version: 2,
    code: "BBBG-8-2",
    contentHash: "b".repeat(64),
    createdAt: "2026-11-04",
    current: true,
    latest: true,
    integrityValid: true,
    liveHash: "d".repeat(64),
    status: "WAITING_CONFIRMATION",
    changes: [],
    confirmations: [confirmation("LANDLORD")],
    snapshot: snapshot(false),
  });
  window.fixtureUser = { id: role === "OWNER" ? 1 : 5, activeRole: role };
  window.fixtureLatest = latest;
  window.fixtureOld = old;
  window.changeMeter = () =>
    setLatest((x) => ({
      ...x,
      current: false,
      status: "CHANGED",
      liveHash: "e".repeat(64),
      changes: [
        { key: "meters", label: "Công tơ hoặc lịch sử thay/reset công tơ" },
      ],
    }));
  window.switchOwner = () => setRole("OWNER");
  window.publishRestoredVersion = () =>
    setLatest((x) => ({
      ...x,
      id: 3,
      version: 3,
      code: "BBBG-8-3",
      status: "WAITING_CONFIRMATION",
      confirmations: [confirmation("LANDLORD")],
    }));
  React.useEffect(() => {
    window.onboardingReady = true;
  });
  const detail = {
    handoverDocument: latest,
    progress: {
      ownParty: role === "OWNER" ? "LANDLORD" : "TENANT",
      canManageHandover: role === "OWNER",
    },
    checkin: { status: "READY" },
    draft: { status: "PENDING_CONFIRMATION" },
  };
  return React.createElement(HandoverDocumentPanel, {
    detail,
    portal: role === "OWNER" ? "admin" : "tenant",
    contractId: 8,
    busy: false,
    onConfirm: (r) => {
      window.confirmationRequests.push(r);
      setLatest((x) => ({
        ...x,
        status: "BOTH_CONFIRMED",
        confirmations: [...x.confirmations, confirmation("TENANT")],
      }));
    },
  });
}
createRoot(document.getElementById("root")).render(React.createElement(App));
