import { redirect } from "next/navigation";

export default function LegacyPrIndexRedirect() {
  redirect("/requisitions");
}
