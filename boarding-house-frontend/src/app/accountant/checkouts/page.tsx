import { Suspense } from "react";
import { CheckoutWorkspace } from "@/components/admin/lifecycle/checkout-workspace";
export default function Page() {
  return (
    <Suspense>
      <CheckoutWorkspace portal="accountant" />
    </Suspense>
  );
}
