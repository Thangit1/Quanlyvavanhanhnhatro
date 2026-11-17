/* eslint-disable @typescript-eslint/no-require-imports */
// Isolated React fixture; no application API, accounts or real personal data.
const React = require("react");
const { createRoot } = require("react-dom/client");
const { OnboardingIdentityProfile } = require("identity");
const { OnboardingHandoverEditor } = require("handover");
const { OnboardingProcedures } = require("procedures");
function App() {
  const [profile, setProfile] = React.useState({
    fields: [
      { key: "permanent_address", label: "Địa chỉ thường trú", present: false },
      { key: "identity_number", label: "Số giấy tờ tùy thân", present: true },
    ],
    complete: false,
    canEdit: true,
    dataHash: "a".repeat(64),
    full_name: "Test renter",
    date_of_birth: "2000-01-01",
    phone: "0901234567",
    identity_type: "CCCD",
    identity_number: "••••1234",
    permanent_address: null,
    verification: null,
  });
  const [verified, setVerified] = React.useState(false);
  React.useEffect(() => {
    window.onboardingReady = true;
  });
  window.changeProfile = () =>
    setProfile((p) => ({ ...p, dataHash: "c".repeat(64) }));
  window.calls = window.calls || [];
  const d = {
    identityProfile: profile,
    identityVerified: verified,
    progress: { canVerifyIdentity: !verified, ownParty: "LANDLORD" },
    checkin: {
      id: 1,
      version: 0,
      scheduled_date: "2026-11-03",
      keys_cards_count: 0,
      electricity_reading: null,
      water_reading: null,
    },
    draft: { start_date: "2026-01-01", end_date: "2027-01-01" },
    context: {
      property_name: "Test house",
      room_code: "A1",
      tenant_name: "Test renter",
    },
    assets: [
      {
        room_asset_id: 1,
        asset_name: "Actual desk",
        quantity: 1,
        condition_status: "GOOD",
        note: null,
      },
    ],
    utilityRates: [
      { code: "ELECTRICITY", name: "Điện", calculation_method: "METER" },
      { code: "WATER", name: "Nước", calculation_method: "METER" },
    ],
    meters: [
      {
        meter_type: "ELECTRICITY",
        meter_code: "E1250",
        current_reading: 1250,
        status: "ACTIVE",
      },
      {
        meter_type: "WATER",
        meter_code: "W50",
        current_reading: 50,
        status: "ACTIVE",
      },
    ],
    financialSummary: {
      rentEstimate: 3000000,
      depositRequired: 2000000,
      depositCollected: 0,
      depositSatisfied: false,
      initialPaymentRequired: false,
      initialPolicySatisfied: true,
      recordedInvoices: [],
      recordedItems: [],
    },
    serviceEstimate: { recurringEstimate: 100000, onceEstimate: 50000 },
    nextAction: "UPDATE_PROFILE",
    procedureSteps: [
      {
        key: "IDENTITY",
        label: "Xác minh hồ sơ định danh",
        status: "NEEDS_INFORMATION",
        description: "Bổ sung hồ sơ",
        anchor: "identity-profile",
      },
    ],
  };
  async function act(path, payload, put) {
    window.calls.push({ path, payload, put });
    if (path === "identity-profile")
      setProfile((p) => ({
        ...p,
        permanent_address: payload.permanentAddress,
        complete: true,
        dataHash: "b".repeat(64),
        fields: p.fields.map((f) => ({ ...f, present: true })),
      }));
    if (path === "identity-verification") setVerified(true);
    return true;
  }
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(OnboardingProcedures, { detail: d, contractId: 1 }),
    React.createElement(OnboardingIdentityProfile, {
      key: profile.dataHash,
      detail: d,
      portal: "admin",
      busy: false,
      act,
    }),
    React.createElement(OnboardingHandoverEditor, {
      detail: d,
      busy: false,
      act,
    }),
  );
}
createRoot(document.getElementById("root")).render(React.createElement(App));
