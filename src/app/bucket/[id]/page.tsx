import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getBucketSummary } from "@/app/actions";
import BucketClient from "./_components/BucketClient";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BucketPage({ params }: Props) {
  const [session, { id }] = await Promise.all([auth(), params]);
  if (!session?.user?.id) redirect("/auth/signin");

  const summary = await getBucketSummary(id);

  return <BucketClient summary={summary} currentUserId={session.user.id} />;
}
