import { isAxiosError } from "axios";

// Only use for the overview/list endpoints: a detail 404 can mean a missing record.
export function isMissingCoOccupantResidence(error: unknown) {
  if (!isAxiosError(error)) return false;
  const data = error.response?.data as { errorCode?: string } | undefined;
  return (
    error.response?.status === 404 &&
    data?.errorCode === "CO_OCCUPANT_NOT_FOUND"
  );
}
