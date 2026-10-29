import { redirect } from "next/navigation";

export default function SendRemindersPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const filter = searchParams?.filter ? `?filter=${searchParams.filter}` : "";
  redirect(`/recovery/customer-reminders${filter}`);
}

