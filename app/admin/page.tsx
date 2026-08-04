import { getDashboardData, getAllCountryTargets, getUsers, findUser, getCountryTargets, filterDashboardForCountries } from "@/lib/data";
import { getServerSession } from "@/lib/auth";
import AdminClient from "@/components/AdminClient";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [session, data] = await Promise.all([
    getServerSession(),
    getDashboardData(),
  ]);

  if (!session) redirect("/login");
  if (session.role === "observer") redirect("/");

  const currentUser = await findUser(session.username);
  const displayName = currentUser?.displayName ?? session.username;
  const userCountry = currentUser?.country?.trim() || undefined;
  const userCountries = currentUser?.countries?.length ? currentUser.countries : undefined;

  // Load filtered targets based on role
  let initialData = data;
  if (userCountries) {
    // RSOO: filter dashboard to their assigned countries
    const allCountryTargets = await getAllCountryTargets();
    initialData = filterDashboardForCountries(data, allCountryTargets, userCountries);
  } else if ((session.role === "expert" || session.role === "focal_point") && userCountry) {
    initialData = { ...data, targets: await getCountryTargets(userCountry) };
  }

  const allUsers = await getUsers();
  const isMasterAdmin = ["admin", "mohamed.wade"].includes(session.username);
  const users = isMasterAdmin ? allUsers : [];

  return <AdminClient initialData={initialData} username={session.username} displayName={displayName} role={session.role} users={users} isMasterAdmin={isMasterAdmin} userCountry={userCountry} />;
}
