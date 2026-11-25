/* eslint-disable @typescript-eslint/no-require-imports */
const React = require("react"),
  { createRoot } = require("react-dom/client");
const { RoomAssetsEditor } = require("assets"),
  { RoomMeterManagement } = require("management"),
  { ContractMeterReadiness } = require("readiness");
function App() {
  const [assets, setAssets] = React.useState([]),
    [meters, setMeters] = React.useState([]),
    [events, setEvents] = React.useState([]);
  window.assetDrafts = assets;
  window.roomDetail = {
    room: { id: 9 },
    meters,
    meterManagement: {
      canInstall: meters.length < 2,
      installableTypes: ["ELECTRICITY", "WATER"].filter(
        (type) => !meters.some((m) => m.meterType === type),
      ),
      reason: null,
      events,
    },
  };
  window.refreshMeters = async () => {
    const call = window.calls.at(-1);
    if (!call) return;
    setMeters((old) => [
      ...old,
      {
        id: old.length + 1,
        meterType: call.payload.type,
        meterCode: call.payload.code,
        currentReading: call.payload.reading,
        readingDate: "2026-11-04",
        status: "ACTIVE",
      },
    ]);
    setEvents((old) => [
      ...old,
      {
        id: old.length + 1,
        meter_type: call.payload.type,
        old_code: "INITIAL",
        new_code: call.payload.code,
        old_reading: 0,
        new_reading: call.payload.reading,
        reason: call.payload.reason,
        evidence_reference: call.payload.reference,
        occurred_at: "2026-11-04",
        actor_name: "Fixture owner",
      },
    ]);
  };
  React.useEffect(() => {
    window.onboardingReady = true;
  });
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      "form",
      {
        id: "assets-form",
        onSubmit: (e) => {
          e.preventDefault();
          window.savedAssets = assets;
        },
      },
      React.createElement(RoomAssetsEditor, { assets, onChange: setAssets }),
      React.createElement("button", { type: "submit" }, "Save assets"),
    ),
    React.createElement(RoomMeterManagement, { detail: window.roomDetail }),
    React.createElement(ContractMeterReadiness, {
      roomId: 9,
      requiredTypes: ["ELECTRICITY", "WATER"],
    }),
  );
}
window.calls = [];
createRoot(document.getElementById("root")).render(React.createElement(App));
