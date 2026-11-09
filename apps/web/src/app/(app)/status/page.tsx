import type { Metadata } from "next";
import { Frame } from "@/components/layout/Frame";
import { StatusView } from "./StatusView";

export const metadata: Metadata = { title: "Protocol Status" };

export default function StatusPage() {
  return (
    <Frame>
      <StatusView />
    </Frame>
  );
}
