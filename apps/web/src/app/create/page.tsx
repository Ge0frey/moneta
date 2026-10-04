import type { Metadata } from "next";
import { Frame } from "@/components/layout/Frame";
import { CreateWizard } from "./CreateWizard";

export const metadata: Metadata = {
  title: "Create a Raise",
  description:
    "Open a permissionless raise on Moneta: one price for everyone, refunds below the minimum, and a treasury governed by markets.",
};

export default function CreatePage() {
  return (
    <Frame variant="narrative">
      <CreateWizard />
    </Frame>
  );
}
