import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserBuckets, getUnreadNotifications } from "@/app/actions";
import DashboardClient from "./_components/DashboardClient";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const [buckets, notifications] = await Promise.all([
    getUserBuckets(),
    getUnreadNotifications(),
  ]);

  return (
    <DashboardClient
      buckets={buckets}
      notifications={notifications}
      user={session.user}
    />
  );
}
